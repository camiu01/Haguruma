/**
 * @file accel-math.ts
 * @brief Time-step simulation of standing-start acceleration (0-100 km/h and 1/4 mile).
 *
 * Forward-Euler integration at fixed dt = 0.01 s in strict SI units. Upshifts
 * fire at min(redline, optimalShiftRpm) with an optional torque-interruption
 * window (shiftTimeS) during which drive force is zero. Rotating driveline
 * inertia is reflected through the currently engaged gear via
 * equivalentRotatingMassKg when physical inertias are supplied, otherwise the
 * static rotatingMassKg fallback is used (m_eff = massKg + rotatingMass).
 * An optional launchRpm holds engine speed during clutch slip so launch torque
 * does not collapse to idle. Invalid inputs yield a null-result object; the
 * solver never throws.
 */

import { dragForce, gradeForce, rollingForce } from './aero-math';
import { maxDriveForceAtSpeed } from './dynamics-math';
import { equivalentRotatingMassKg } from './inertia-math';
import { rpmFromKmh } from './speed-math';
import {
	CURVE_MIN_RPM,
	dynamicRadiusM,
	optimalShiftFor,
	tractiveForceAt,
	validateCurve,
	type EngineCurve,
} from './traction-math';
import type { RunningGear } from '../models';

/** One quarter mile in metres (statute mile / 4). */
export const QUARTER_MILE_M = 402.33928;

/** Fixed integration step in seconds. */
const SIM_DT = 0.01;

/** Hard time cap so pathological inputs cannot hang the UI. */
const SIM_MAX_TIME_S = 60;

/** Speed ceiling above which the run is treated as divergent. */
const SIM_MAX_SPEED_KMH = 500;

/**
 * Inputs for one acceleration run.
 * @brief Everything the integrator needs; road loads and launch/inertia are optional.
 */
export interface SimInput {
	/** Curb mass in kilograms (excludes rotating inertia). */
	massKg: number;
	/** Forward gear ratios from first to top gear. */
	gears: number[];
	/** Differential ratio. */
	fd: number;
	/** Effective rolling circumference in metres. */
	circM: number;
	/** Engine curve anchors (null forces a null result). */
	curve: EngineCurve | null;
	/** Drivetrain efficiency between 0 and 1. */
	drivetrainEff: number;
	/** Static equivalent rotating mass in kilograms (fallback when inertias absent). */
	rotatingMassKg?: number;
	/** Crank/flywheel moment of inertia in kg·m² (enables per-gear reflection). */
	engineInertiaKgM2?: number;
	/** Per-wheel moment of inertia in kg·m² (enables per-gear reflection). */
	wheelInertiaKgM2?: number;
	/** Hold engine RPM at this value while wheel-implied RPM is lower (clutch slip). */
	launchRpm?: number;
	/** Torque-interruption duration per upshift in seconds. */
	shiftTimeS?: number;
	/** Chassis grip setup; traction clamp skipped when absent. */
	runningGear?: RunningGear;
	/** Aerodynamic drag coefficient (0 disables drag). */
	dragCd?: number;
	/** Frontal area in square metres (0 disables drag). */
	frontalAreaM2?: number;
	/** Rolling-resistance coefficient (0 disables rolling). */
	rollingCrr?: number;
	/** Road slope in percent (+uphill). */
	roadGradePercent?: number;
}

/**
 * Result of one acceleration run.
 * @brief Crossed metrics are null when the event never happened in time.
 */
export interface SimResult {
	/** Seconds to reach 100 km/h, or null when never reached. */
	time0To100S: number | null;
	/** Seconds to cover the quarter mile, or null when never covered. */
	quarterMileS: number | null;
	/** Speed at the quarter-mile line in km/h, or null. */
	trapSpeedKmh: number | null;
	/** Distance travelled when the loop exited, in metres. */
	distanceM: number;
	/** Simulated time when the loop exited, in seconds. */
	timeS: number;
}

/**
 * @brief Build a result carrying only null metrics (invalid or incomplete run).
 * @return SimResult with null crossed metrics.
 */
const nullResult = (): SimResult => ({
	time0To100S: null,
	quarterMileS: null,
	trapSpeedKmh: null,
	distanceM: 0,
	timeS: 0,
});

/**
 * @brief Validate simulation inputs and resolve the engine curve.
 * @param input Raw simulation input.
 * @return Validated curve, or null when any required input is unusable.
 */
const validateSimInput = (input: SimInput): EngineCurve | null => {
	if (!input || !Number.isFinite(input.massKg) || input.massKg <= 0) {
		return null;
	}
	if (!Number.isFinite(input.fd) || input.fd <= 0 || !Number.isFinite(input.circM) || input.circM <= 0) {
		return null;
	}
	if (!Number.isFinite(input.drivetrainEff) || input.drivetrainEff <= 0 || input.drivetrainEff > 1) {
		return null;
	}
	if (!Array.isArray(input.gears) || input.gears.length === 0) {
		return null;
	}
	if (input.gears.some((g) => !Number.isFinite(g) || g <= 0)) {
		return null;
	}
	return input.curve ? validateCurve(input.curve) : null;
};

/**
 * @brief Resolve rotating mass for the currently engaged gear.
 * @brief Uses per-gear inertia reflection when physical inertias are valid,
 *        otherwise falls back to the static rotatingMassKg input.
 * @param input Simulation input.
 * @param gearRatio Currently engaged gear ratio.
 * @param radius Dynamic rolling radius in metres.
 * @return Rotating equivalent mass in kilograms (>= 0).
 */
const resolveRotatingMass = (input: SimInput, gearRatio: number, radius: number): number => {
	const engineI = input.engineInertiaKgM2;
	const wheelI = input.wheelInertiaKgM2;
	const hasInertias =
		typeof engineI === 'number' &&
		Number.isFinite(engineI) &&
		engineI >= 0 &&
		typeof wheelI === 'number' &&
		Number.isFinite(wheelI) &&
		wheelI >= 0;
	if (hasInertias) {
		const reflected = equivalentRotatingMassKg({
			engineInertiaKgM2: engineI as number,
			wheelInertiaKgM2: wheelI as number,
			gearRatio,
			fd: input.fd,
			dynRadiusM: radius,
		});
		if (reflected > 0) {
			return reflected;
		}
	}
	const fallback = input.rotatingMassKg;
	return typeof fallback === 'number' && Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
};

/**
 * @brief Resolve and clamp the optional clutch-slip launch RPM.
 * @param launchRpm Candidate launch RPM from SimInput.
 * @param redline Validated rev limiter used as the upper bound.
 * @return Launch RPM within [CURVE_MIN_RPM, redline], or null when unset/invalid.
 */
const resolveLaunchRpm = (launchRpm: number | undefined, redline: number): number | null => {
	if (launchRpm === undefined || !Number.isFinite(launchRpm) || launchRpm <= 0) {
		return null;
	}
	return Math.min(redline, Math.max(CURVE_MIN_RPM, launchRpm));
};

/**
 * @brief Precompute the upshift RPM target for every gear.
 * @param gears Forward gear ratios.
 * @param fd Differential ratio.
 * @param circM Rolling circumference in metres.
 * @param curve Validated engine curve.
 * @param eff Drivetrain efficiency.
 * @return One target RPM per gear; Infinity for the top gear.
 */
const buildShiftTargets = (gears: number[], fd: number, circM: number, curve: EngineCurve, eff: number): number[] => {
	return gears.map((_, index) => {
		if (index >= gears.length - 1) {
			return Number.POSITIVE_INFINITY;
		}
		const opt = optimalShiftFor(gears, index, fd, circM, curve, eff);
		return Math.min(curve.redline, opt ? opt.shiftRpm : curve.redline);
	});
};

/**
 * @brief Interpolate the exact time an upward crossing of target occurred.
 * @param before Value at the previous step.
 * @param after Value at the current step.
 * @param target Threshold crossed.
 * @param timeNow Current sim time (already advanced by dt).
 * @return Crossing time, or null when the target was not crossed upward.
 */
const crossingTime = (before: number, after: number, target: number, timeNow: number): number | null => {
	if (!(after >= target) || !Number.isFinite(after) || after <= before) {
		return null;
	}
	const frac = (target - before) / (after - before);
	return timeNow - SIM_DT + frac * SIM_DT;
};

/**
 * @brief Engine RPM used for torque lookup in the current step.
 * @brief Holds launchRpm during clutch slip, otherwise floors at idle.
 * @param rpmRaw Wheel-implied RPM for the engaged gear.
 * @param launchRpm Resolved launch RPM, or null when slip is disabled.
 * @return RPM passed to tractiveForceAt.
 */
const torqueLookupRpm = (rpmRaw: number, launchRpm: number | null): number => {
	if (launchRpm !== null && rpmRaw < launchRpm) {
		return launchRpm;
	}
	return Math.max(rpmRaw, CURVE_MIN_RPM);
};

/**
 * @brief Run the fixed-step acceleration solver.
 * @param input Simulation inputs (validated up front).
 * @return SimResult with whatever metrics were crossed before exit.
 */
export const simulateAcceleration = (input: SimInput): SimResult => {
	const curve = validateSimInput(input);
	if (!curve) {
		return nullResult();
	}
	const radius = dynamicRadiusM(input.circM);
	if (radius <= 0) {
		return nullResult();
	}
	const shiftTime = Number.isFinite(input.shiftTimeS as number) ? Math.min(3, Math.max(0, input.shiftTimeS as number)) : 0;
	const launchRpm = resolveLaunchRpm(input.launchRpm, curve.redline);
	const targets = buildShiftTargets(input.gears, input.fd, input.circM, curve, input.drivetrainEff);

	let v = 0;
	let dist = 0;
	let t = 0;
	let gear = 0;
	let cooldown = 0;
	let pendingGear = -1;
	let t100: number | null = null;
	let tQ: number | null = null;
	let trap: number | null = null;

	while (t < SIM_MAX_TIME_S) {
		const speedBefore = v * 3.6;
		const rpmRaw = rpmFromKmh(speedBefore, input.gears[gear], input.fd, input.circM);

		let shifting = false;
		if (cooldown > 0) {
			cooldown -= SIM_DT;
			shifting = true;
			if (cooldown <= 0 && pendingGear >= 0) {
				gear = pendingGear;
				pendingGear = -1;
				cooldown = 0;
				shifting = false;
			}
		} else if (gear < input.gears.length - 1 && rpmRaw >= targets[gear]) {
			if (shiftTime <= 0) {
				gear += 1;
			} else {
				pendingGear = gear + 1;
				cooldown = shiftTime;
				shifting = true;
			}
		}

		let drive = 0;
		if (!shifting) {
			const rpm = torqueLookupRpm(rpmRaw, launchRpm);
			drive = tractiveForceAt(rpm, input.gears[gear], input.fd, radius, curve, input.drivetrainEff);
			if (input.runningGear && drive > 0) {
				const grip = maxDriveForceAtSpeed(input.runningGear, input.massKg, speedBefore, drive, 0);
				if (grip.limitN > 0 && drive > grip.limitN) {
					drive = grip.limitN;
				}
			}
		}
		const mEff = input.massKg + resolveRotatingMass(input, input.gears[gear], radius);
		const loads =
			dragForce(speedBefore, input.dragCd ?? 0, input.frontalAreaM2 ?? 0) +
			rollingForce(input.massKg, input.rollingCrr ?? 0) +
			gradeForce(input.massKg, input.roadGradePercent ?? 0);
		let accel = (drive - loads) / mEff;
		if (!Number.isFinite(accel)) {
			return nullResult();
		}
		if (v <= 0 && accel < 0) {
			accel = 0;
		}
		v = Math.max(0, v + accel * SIM_DT);
		const stepDist = v * SIM_DT;
		const distBefore = dist;
		dist += stepDist;
		t += SIM_DT;

		const speedAfter = v * 3.6;
		if (speedAfter > SIM_MAX_SPEED_KMH) {
			return nullResult();
		}
		if (t100 === null) {
			t100 = crossingTime(speedBefore, speedAfter, 100, t);
		}
		if (tQ === null && dist >= QUARTER_MILE_M) {
			tQ = crossingTime(distBefore, dist, QUARTER_MILE_M, t);
			if (tQ !== null && stepDist > 0) {
				const frac = (QUARTER_MILE_M - distBefore) / stepDist;
				trap = speedBefore + frac * (speedAfter - speedBefore);
			}
		}
		if (t100 !== null && tQ !== null) {
			break;
		}
	}

	return {
		time0To100S: t100,
		quarterMileS: tQ,
		trapSpeedKmh: trap,
		distanceM: dist,
		timeS: t,
	};
};
