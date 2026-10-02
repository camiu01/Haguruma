/**
 * @file lap-sequence.ts
 * @brief Timed throttle/coast/brake sequence with downshifts and clutch rev matching.
 */
import { dragForce, gradeForce, rollingForceAtSpeed } from './aero-math';
import { engineBrakeForceAt, maxCoastForceAtSpeed } from './dynamics-math';
import { brakingAtSpeed, type BrakingInput } from './braking-simulation';
import { transferredDriveForce, wheelForceAt } from './drive-force';
import { gearShiftTimeS, limiterMultiplier } from './powertrain-control';
import { rpmFromKmh } from './speed-math';
import { dynamicRadiusM, validateCurve } from './traction-math';
import type { SimInput } from './accel-math';

export interface LapSegment {
	/** Segment length in seconds. */
	durationS: number;
	/** Zero-based selected gear. */
	gear: number;
	/** Pedal position in [0, 1]; zero means engine braking. */
	throttle: number;
	/** Brake pedal demand in g. */
	brakeG?: number;
	/** Match RPM during shifts rather than drag the rear axle through clutch slip. */
	revMatch?: boolean;
}

export interface LapSample {
	timeS: number;
	speedKmh: number;
	distanceM: number;
	gear: number;
	engineRpm: number;
	blipRpm: number;
	coastLock: boolean;
}

/**
 * @brief Parse bounded four-column commands with one-based user gear numbers.
 * @param csv Seconds, gear, throttle fraction and brake demand per line.
 * @param revMatch Enable RPM matching for each command.
 * @return Commands, or null for malformed input.
 */
export const parseLapCommands = (csv: string, revMatch = true): LapSegment[] | null => {
	if (csv.length > 4000) return null;
	const rows = csv.trim().split(/\r?\n/);
	if (!csv.trim() || rows.length > 32) return null;
	const result: LapSegment[] = [];
	for (const row of rows) {
		const cells = row.split(',');
		if (cells.length !== 4 || cells.some((cell) => !cell.trim())) return null;
		const [durationS, gear, throttle, brakeG] = cells.map(Number);
		if (![durationS, gear, throttle, brakeG].every(Number.isFinite) || durationS <= 0 || durationS > 60
			|| !Number.isInteger(gear) || gear < 1 || gear > 8 || throttle < 0 || throttle > 1 || brakeG < 0 || brakeG > 3) return null;
		result.push({ durationS, gear: gear - 1, throttle, brakeG, revMatch });
	}
	return result;
};

/** Mutable solver state, kept local to one run. */
interface LapState extends LapSample {
	cooldownS: number;
	mismatchRpm: number;
	cut: boolean;
}

/**
 * @brief Evaluate engine drag and unmatched clutch impulse, bounded by coast grip.
 * @param input Vehicle powertrain.
 * @param state Current run state.
 * @param rpm Wheel-implied engine speed.
 * @return Retarding wheel force and coast-lock flag.
 */
const coastForce = (input: SimInput, state: LapState, rpm: number): { force: number; lock: boolean } => {
	const radius = dynamicRadiusM(input.circM);
	const ratio = input.gears[state.gear];
	const base = input.curve ? engineBrakeForceAt(Math.min(rpm, input.curve.redline), ratio, input.fd, radius,
		input.curve, input.drivetrainEff) : 0;
	const impulse = Math.max(0, state.mismatchRpm) * Math.PI / 30 * (input.engineInertiaKgM2 ?? 0.2)
		* ratio * input.fd / radius / 0.2;
	const demand = base + impulse;
	const limit = input.runningGear ? maxCoastForceAtSpeed(input.runningGear, input.massKg,
		state.speedKmh, demand, demand / input.massKg, radius) : null;
	return { force: limit ? Math.min(demand, limit.limitN) : demand, lock: limit?.isLockup ?? false };
};

/**
 * @brief Step the engaged powertrain with signed loads and optional service braking.
 * @param input Powertrain settings.
 * @param brakes Optional hydraulic braking settings.
 * @param segment Pedal command.
 * @param state Local run state.
 * @return void
 */
const lapStep = (input: SimInput, brakes: BrakingInput | undefined, segment: LapSegment, state: LapState): void => {
	const rpm = rpmFromKmh(state.speedKmh, input.gears[state.gear], input.fd, input.circM);
	state.engineRpm = Math.max(1000, rpm - state.mismatchRpm);
	let force = 0;
	const road = dragForce(state.speedKmh, input.dragCd ?? 0, input.frontalAreaM2 ?? 0)
		+ rollingForceAtSpeed(input.massKg, input.rollingCrr ?? 0, state.speedKmh)
		+ gradeForce(input.massKg, input.roadGradePercent ?? 0);
	if (state.cooldownS <= 0 && input.curve) {
		if (segment.throttle > 0) {
			const demand = wheelForceAt(Math.min(state.engineRpm, input.curve.redline), input.gears[state.gear],
				input.fd, dynamicRadiusM(input.circM), input.curve, input.drivetrainEff, input.runningGear, input.efficiencyMap)
				* segment.throttle * limiterMultiplier(state, rpm, input.curve.redline, input.limiter);
			force = transferredDriveForce(input.runningGear, input.massKg, input.massKg, state.speedKmh, demand, road,
				dynamicRadiusM(input.circM));
			if (state.mismatchRpm > 0) force -= coastForce(input, state, rpm).force;
		} else {
			const coast = coastForce(input, state, rpm);
			force = -coast.force;
			state.coastLock = coast.lock;
		}
	}
	const service = combinedBrakingN(input, brakes, segment, state, road, force);
	if (service !== null && segment.throttle === 0) force = 0;
	const previous = state.speedKmh / 3.6;
	const next = Math.max(0, previous + (force - road - (service ?? 0)) / input.massKg * 0.01);
	state.distanceM += (previous + next) / 2 * 0.01;
	state.speedKmh = next * 3.6;
	state.timeS += 0.01;
	state.cooldownS = Math.max(0, state.cooldownS - 0.01);
	if (state.cooldownS <= 0) state.mismatchRpm *= 0.95;
};

/**
 * @brief Share each wheel's friction budget between hydraulic and engine braking.
 * @param input Powertrain.
 * @param brakes Service-brake settings.
 * @param segment Pedal command.
 * @param state Current telemetry.
 * @param road Road resistance already accounted for by the integrator.
 * @param force Current signed engine force.
 * @return Combined tire retardation, null when the service brakes are inactive.
 */
const combinedBrakingN = (
	input: SimInput, brakes: BrakingInput | undefined, segment: LapSegment, state: LapState, road: number, force: number,
): number | null => {
	if (!brakes || (segment.brakeG ?? 0) <= 0) return null;
	const engineBrakeN = segment.throttle === 0 ? Math.max(0, -force) : 0;
	const total = brakingAtSpeed({ ...brakes, demandG: segment.brakeG, engineBrakeN }, state.speedKmh, state.timeS);
	return total.decelMps2 * input.massKg - road;
};

/**
 * @brief Initiate a gear change and reject wheel-implied over-rev.
 * @param input Powertrain settings.
 * @param state Local run state.
 * @param segment Requested gear and matching strategy.
 * @return True if the command is safe.
 */
const changeGear = (input: SimInput, state: LapState, segment: LapSegment): boolean => {
	const target = rpmFromKmh(state.speedKmh, input.gears[segment.gear], input.fd, input.circM);
	if (!input.curve || target > input.curve.redline) return false;
	state.blipRpm = 0;
	state.coastLock = false;
	if (segment.gear === state.gear) return true;
	const old = rpmFromKmh(state.speedKmh, input.gears[state.gear], input.fd, input.circM);
	state.cooldownS = gearShiftTimeS(state.gear, input.shiftTimesS, input.shiftTimeS, input.gearbox);
	state.blipRpm = segment.revMatch ? Math.max(0, target - old) : 0;
	state.mismatchRpm = segment.revMatch ? 0 : Math.max(0, target - old);
	state.gear = segment.gear;
	state.cut = false;
	return true;
};

/**
 * @brief Simulate a bounded sequence, rejecting unsafe downshifts instead of over-revving.
 * @param input Acceleration-compatible powertrain.
 * @param segments Timed commands, maximum total 60 seconds.
 * @param initialSpeedKmh Initial road speed.
 * @param brakes Optional service-brake settings.
 * @return Decimated telemetry, or null for invalid commands and unsafe shifts.
 */
export const simulateLapSequence = (
	input: SimInput, segments: LapSegment[], initialSpeedKmh = 100, brakes?: BrakingInput,
): LapSample[] | null => {
	const curve = input.curve ? validateCurve(input.curve) : null;
	if (!curve || ![input.massKg, input.fd, input.circM, input.drivetrainEff, initialSpeedKmh].every(Number.isFinite)
		|| input.massKg <= 0 || input.fd <= 0 || input.circM <= 0 || initialSpeedKmh < 0 || initialSpeedKmh > 500
		|| !input.gears.length || input.gears.some((g) => !Number.isFinite(g) || g <= 0)) return null;
	if (!segments.length || segments.some((s) => !Number.isFinite(s.durationS) || s.durationS <= 0
		|| !Number.isInteger(s.gear) || s.gear < 0 || s.gear >= input.gears.length
		|| !Number.isFinite(s.throttle) || s.throttle < 0 || s.throttle > 1
		|| !Number.isFinite(s.brakeG ?? 0) || (s.brakeG ?? 0) < 0)
		|| segments.reduce((sum, s) => sum + Math.ceil(s.durationS / 0.01) * 0.01, 0) > 60) return null;
	const state: LapState = { timeS: 0, speedKmh: initialSpeedKmh, distanceM: 0, gear: segments[0].gear,
		engineRpm: 0, blipRpm: 0, coastLock: false, cooldownS: 0, mismatchRpm: 0, cut: false };
	const samples: LapSample[] = [];
	const prepared = { ...input, curve };
	for (const segment of segments) {
		if (!changeGear(prepared, state, segment)) return null;
		samples.push({ ...state });
		for (let step = 0; step < Math.ceil(segment.durationS / 0.01); step += 1) {
			lapStep(prepared, brakes, segment, state);
			if (!Number.isFinite(state.speedKmh) || state.speedKmh > 500) return null;
			if (step % 10 === 0) samples.push({ ...state });
		}
	}
	samples.push({ ...state });
	return samples;
};
