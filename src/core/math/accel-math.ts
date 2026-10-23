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

import { advanceAccelStep, type AccelRun } from './accel-step';
import {
	CURVE_MIN_RPM,
	dynamicRadiusM,
	optimalShiftFor,
	validateCurve,
	type EngineCurve,
} from './traction-math';
import type { DrivetrainLayout, RunningGear } from '../models';

/** One quarter mile in metres (statute mile / 4). */
export const QUARTER_MILE_M = 402.33928;

/** Sixty feet in metres (drag-strip short split). */
export const SIXTY_FT_M = 18.288;

/** Sixty miles per hour in km/h (drag-strip speed split). */
export const SIXTY_MPH_KMH = 96.56064;

/** Fixed integration step in seconds. */
const SIM_DT = 0.01;

/** Hard time cap so pathological inputs cannot hang the UI. */
const SIM_MAX_TIME_S = 60;


/**
 * Inputs for one acceleration run.
 * @brief Everything the integrator needs; road loads and launch/inertia are optional.
 */
export interface SimInput {
	/** Per-departing-gear interruption overrides in seconds. */
	shiftTimesS?: number[];
	/** Gearbox delay default when no global delay is provided. */
	gearbox?: 'synchro' | 'dog';
	/** Fuel-cut behavior at the limiter. */
	limiter?: 'hard' | 'bounce';
	/** Enable normalized torque/load transmission losses. */
	efficiencyMap?: boolean;
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
	/** Reaction time in seconds added to every reported split (not simulated). */
	reactionS?: number;
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
	/** Seconds to 60 ft (18.288 m), or null when never reached. */
	t60ftS: number | null;
	/** Seconds to 60 mph (96.56 km/h), or null when never reached. */
	t060mphS: number | null;
	/** Seconds to 160 km/h, or null when never reached. */
	t0160S: number | null;
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
	t60ftS: null,
	t060mphS: null,
	t0160S: null,
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
const buildShiftTargets = (gears: number[], fd: number, circM: number, curve: EngineCurve, eff: number, layout?: DrivetrainLayout): number[] => {
	return gears.map((_, index) => {
		if (index >= gears.length - 1) {
			return Number.POSITIVE_INFINITY;
		}
		const opt = optimalShiftFor(gears, index, fd, circM, curve, eff, 'kmh', layout);
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
 * @brief Run the fixed-step acceleration solver.
 * @param input Simulation inputs (validated up front).
 * @return SimResult with whatever metrics were crossed before exit.
 */
export const simulateAcceleration = (input: SimInput): SimResult => {
	const curve = validateSimInput(input);
	if (!curve) return nullResult();
	const radius = dynamicRadiusM(input.circM);
	if (radius <= 0) return nullResult();
	const context = { input, curve, radius,
		launchRpm: resolveLaunchRpm(input.launchRpm, curve.redline),
		targets: buildShiftTargets(input.gears, input.fd, input.circM, curve, input.drivetrainEff,
			input.efficiencyMap ? input.runningGear?.drivetrainLayout ?? 'RWD' : undefined) };
	const reaction = Number.isFinite(input.reactionS as number) ? Math.min(5, Math.max(0, input.reactionS as number)) : 0;
	const run: AccelRun = { v: 0, dist: 0, t: 0, gear: 0, cooldown: 0, pendingGear: -1, cut: false };
	const result = nullResult();
	while (run.t < SIM_MAX_TIME_S) {
		const beforeSpeed = run.v * 3.6;
		const beforeDistance = run.dist;
		if (!advanceAccelStep(context, run)) return nullResult();
		recordSplits(result, run, beforeSpeed, beforeDistance);
		if (result.time0To100S !== null && result.t60ftS !== null && result.t060mphS !== null
			&& result.t0160S !== null && result.quarterMileS !== null) break;
	}
	for (const key of ['time0To100S', 't60ftS', 't060mphS', 't0160S', 'quarterMileS'] as const) {
		if (result[key] !== null) result[key]! += reaction;
	}
	result.distanceM = run.dist;
	result.timeS = run.t;
	return result;
};

/**
 * @brief Record interpolated speed/distance crossings without per-step arrays.
 * @param result Mutable split result.
 * @param run Current step state.
 * @param beforeSpeed Previous speed in km/h.
 * @param beforeDistance Previous distance in metres.
 * @return void
 */
const recordSplits = (result: SimResult, run: AccelRun, beforeSpeed: number, beforeDistance: number): void => {
	const speed = run.v * 3.6;
	if (result.time0To100S === null) result.time0To100S = crossingTime(beforeSpeed, speed, 100, run.t);
	if (result.t060mphS === null) result.t060mphS = crossingTime(beforeSpeed, speed, SIXTY_MPH_KMH, run.t);
	if (result.t0160S === null) result.t0160S = crossingTime(beforeSpeed, speed, 160, run.t);
	if (result.t60ftS === null && run.dist >= SIXTY_FT_M) result.t60ftS = crossingTime(beforeDistance, run.dist, SIXTY_FT_M, run.t);
	if (result.quarterMileS === null && run.dist >= QUARTER_MILE_M) {
		result.quarterMileS = crossingTime(beforeDistance, run.dist, QUARTER_MILE_M, run.t);
		if (result.quarterMileS !== null && run.dist > beforeDistance) {
			const fraction = (QUARTER_MILE_M - beforeDistance) / (run.dist - beforeDistance);
			result.trapSpeedKmh = beforeSpeed + fraction * (speed - beforeSpeed);
		}
	}
};
