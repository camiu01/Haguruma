/**
 * @file accel-step.ts
 * @brief Per-step acceleration integration with reusable gear-change state.
 */
import { dragForce, gradeForce, rollingForceAtSpeed } from './aero-math';
import { transferredDriveForce, wheelForceAt } from './drive-force';
import { gearShiftTimeS, limiterMultiplier } from './powertrain-control';
import { equivalentRotatingMassKg } from './inertia-math';
import { rpmFromKmh } from './speed-math';
import { CURVE_MIN_RPM, type EngineCurve } from './traction-math';
import type { SimInput } from './accel-math';

export interface AccelRun {
	v: number;
	dist: number;
	t: number;
	gear: number;
	cooldown: number;
	pendingGear: number;
	cut: boolean;
}

export interface AccelContext {
	input: SimInput;
	curve: EngineCurve;
	radius: number;
	launchRpm: number | null;
	targets: number[];
}

/**
 * @brief Resolve reflected rotating mass or a finite static fallback.
 * @param input Simulation settings.
 * @param gearRatio Engaged ratio.
 * @param radius Rolling radius.
 * @return Equivalent rotating mass in kilograms.
 */
const rotatingMass = (input: SimInput, gearRatio: number, radius: number): number => {
	const engineI = input.engineInertiaKgM2;
	const wheelI = input.wheelInertiaKgM2;
	if (typeof engineI === 'number' && Number.isFinite(engineI) && engineI >= 0
		&& typeof wheelI === 'number' && Number.isFinite(wheelI) && wheelI >= 0) {
		const reflected = equivalentRotatingMassKg({
			engineInertiaKgM2: engineI, wheelInertiaKgM2: wheelI,
			gearRatio, fd: input.fd, dynRadiusM: radius,
		});
		if (reflected > 0) return reflected;
	}
	const fallback = input.rotatingMassKg;
	return typeof fallback === 'number' && Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
};

/**
 * @brief Advance an upshift, keeping interruption quantized to whole Euler steps.
 * @param context Prepared simulation inputs.
 * @param run Mutable integrator state.
 * @param speedKmh Road speed before this step.
 * @return True while torque is interrupted.
 */
const advanceGear = (context: AccelContext, run: AccelRun, speedKmh: number): boolean => {
	if (run.pendingGear >= 0) {
		if (run.cooldown > 1e-9) {
			run.cooldown -= 0.01;
			return true;
		}
		run.gear = run.pendingGear;
		run.pendingGear = -1;
		run.cooldown = 0;
		run.cut = false;
	}
	const { input, targets } = context;
	const rpm = rpmFromKmh(speedKmh, input.gears[run.gear], input.fd, input.circM);
	if (run.gear >= input.gears.length - 1 || rpm < targets[run.gear]) return false;
	const delay = gearShiftTimeS(run.gear, input.shiftTimesS, input.shiftTimeS, input.gearbox);
	if (delay <= 0) {
		run.gear += 1;
		run.cut = false;
		return false;
	}
	run.pendingGear = run.gear + 1;
	run.cooldown = Math.max(0, delay - 0.01);
	return true;
};

/**
 * @brief Evaluate engine wheel force after shifts with freshly recomputed landing RPM.
 * @param context Prepared physical inputs.
 * @param run Mutable limiter latch and engaged gear.
 * @param speedKmh Current speed.
 * @return Unclamped drive demand.
 */
const driveDemand = (context: AccelContext, run: AccelRun, speedKmh: number): number => {
	const { input, curve, radius, launchRpm } = context;
	const rpmRaw = rpmFromKmh(speedKmh, input.gears[run.gear], input.fd, input.circM);
	const rpm = Math.max(rpmRaw, launchRpm ?? CURVE_MIN_RPM, CURVE_MIN_RPM);
	const force = wheelForceAt(Math.min(rpm, curve.redline), input.gears[run.gear], input.fd, radius,
		curve, input.drivetrainEff, input.runningGear, input.efficiencyMap);
	return force * limiterMultiplier(run, rpmRaw, curve.redline, input.limiter);
};

/**
 * @brief Advance one Euler step with self-consistent axle load transfer.
 * @param context Prepared physical inputs.
 * @param run Mutable local integrator state.
 * @return False for non-finite or divergent runs.
 */
export const advanceAccelStep = (context: AccelContext, run: AccelRun): boolean => {
	const { input, radius } = context;
	const speed = run.v * 3.6;
	const shifting = advanceGear(context, run, speed);
	const demand = shifting ? 0 : driveDemand(context, run, speed);
	const mEff = input.massKg + rotatingMass(input, input.gears[run.gear], radius);
	const loads = dragForce(speed, input.dragCd ?? 0, input.frontalAreaM2 ?? 0)
		+ rollingForceAtSpeed(input.massKg, input.rollingCrr ?? 0, speed)
		+ gradeForce(input.massKg, input.roadGradePercent ?? 0);
	const drive = transferredDriveForce(input.runningGear, input.massKg, mEff, speed, demand, loads, radius);
	const acceleration = (drive - loads) / mEff;
	if (!Number.isFinite(acceleration)) return false;
	run.v = Math.max(0, run.v + acceleration * 0.01);
	run.dist += run.v * 0.01;
	run.t += 0.01;
	return run.v * 3.6 <= 500;
};
