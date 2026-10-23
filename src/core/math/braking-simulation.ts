/**
 * @file braking-simulation.ts
 * @brief Four-wheel braking integration with load transfer, sliding tires and ABS.
 */
import { dragForce, gradeForce, rollingForceAtSpeed } from './aero-math';
import { downforceN, GRAVITY, kammLimit, wheelLoads } from './dynamics-math';
import { gripGainFor } from '../../config/tire-compounds';
import type { RunningGear } from '../models';

export interface BrakingInput {
	massKg: number;
	runningGear: RunningGear;
	abs?: boolean;
	frontBias?: number;
	demandG?: number;
	dragCd?: number;
	frontalAreaM2?: number;
	rollingCrr?: number;
	roadGradePercent?: number;
	/** Coast force already clamped by the driven-axle differential model. */
	engineBrakeN?: number;
}

export interface BrakingSample {
	timeS: number;
	distanceM: number;
	speedKmh: number;
	decelMps2: number;
	lockedWheels: number;
}

export interface BrakingResult {
	distanceM: number | null;
	timeS: number | null;
	maxLockedWheels: number;
	samples: BrakingSample[];
}

/**
 * @brief Validate required physical inputs before stepping.
 * @param input Vehicle and braking settings.
 * @return True for a finite, positive mass and usable chassis geometry.
 */
export const validBrakingInput = (input: BrakingInput): boolean => {
	const rg = input?.runningGear;
	return !!rg && Number.isFinite(input.massKg) && input.massKg > 0
		&& [rg.roadFrictionCoefficient, rg.frontWeightDistribution, rg.centerOfGravityHeightMm,
			rg.wheelbaseMm, rg.trackWidthMm, rg.lateralG].every(Number.isFinite)
		&& rg.roadFrictionCoefficient >= 0 && rg.wheelbaseMm > 0 && rg.trackWidthMm > 0
		&& [input.frontBias ?? 0.65, input.demandG ?? 1.4, input.dragCd ?? 0,
			input.frontalAreaM2 ?? 0, input.rollingCrr ?? 0, input.roadGradePercent ?? 0, input.engineBrakeN ?? 0].every(Number.isFinite);
};

/**
 * @brief Evaluate one wheel's brake force with kinetic slip or ABS cycling.
 * @param demandN Hydraulic demand.
 * @param capacityN Friction-circle capacity.
 * @param abs Anti-lock modulation enabled.
 * @param timeS Time within the braking run.
 * @return Transmitted force and whether the wheel is locked.
 */
const wheelBrakeN = (demandN: number, capacityN: number, abs: boolean, timeS: number): { forceN: number; locked: boolean } => {
	if (demandN <= capacityN) return { forceN: demandN, locked: false };
	const modulation = 0.94 + 0.06 * Math.cos(2 * Math.PI * 12 * timeS);
	return { forceN: capacityN * (abs ? modulation : 0.75), locked: !abs };
};

/**
 * @brief Compute individual-wheel brake budgets including aero and lateral demand.
 * @param input Vehicle and braking settings.
 * @param speedKmh Current speed.
 * @param decelMps2 Deceleration estimate for load transfer.
 * @param timeS Simulation time for ABS modulation.
 * @return Total tire braking force and count of locked wheels.
 */
const tireBrakes = (input: BrakingInput, speedKmh: number, decelMps2: number, timeS: number): { forceN: number; locked: number } => {
	const rg = input.runningGear;
	const loads = wheelLoads(rg, input.massKg, -decelMps2);
	const down = Math.max(0, downforceN(rg.liftCoefficient ?? 0, rg.liftReferenceAreaM2 ?? 0, speedKmh));
	const share = Math.max(0, Math.min(1, rg.downforceFrontShare ?? rg.frontWeightDistribution));
	const fz = [loads.fl + down * share / 2, loads.fr + down * share / 2,
		loads.rl + down * (1 - share) / 2, loads.rr + down * (1 - share) / 2];
	const total = fz.reduce((sum, load) => sum + load, 0);
	const lateral = input.massKg * GRAVITY * Math.abs(rg.lateralG);
	const mu = rg.roadFrictionCoefficient * gripGainFor(rg.tireCompoundId);
	const bias = Math.max(0, Math.min(1, input.frontBias ?? 0.65));
	const demand = Math.max(0, input.demandG ?? 1.4) * input.massKg * GRAVITY;
	const engineFront = rg.drivetrainLayout === 'FWD' ? 1 : rg.drivetrainLayout === 'RWD' ? 0 : rg.awdFrontShare ?? 0.5;
	let forceN = 0;
	let locked = 0;
	for (let i = 0; i < 4; i += 1) {
		const capacity = kammLimit(mu, fz[i], total > 0 ? lateral * fz[i] / total : 0);
		const engine = Math.max(0, input.engineBrakeN ?? 0) * (i < 2 ? engineFront : 1 - engineFront) / 2;
		const wheel = wheelBrakeN(demand * (i < 2 ? bias : 1 - bias) / 2 + engine, capacity, input.abs ?? true, timeS);
		forceN += wheel.forceN;
		locked += Number(wheel.locked);
	}
	return { forceN, locked };
};

/**
 * @brief Resolve braking deceleration and dynamic transfer by relaxed iteration.
 * @param input Vehicle and braking settings.
 * @param speedKmh Current speed.
 * @param timeS Simulation time.
 * @return Signed retardation and locked-wheel count.
 */
export const brakingAtSpeed = (input: BrakingInput, speedKmh: number, timeS = 0): { decelMps2: number; lockedWheels: number } => {
	if (!validBrakingInput(input) || !Number.isFinite(speedKmh) || speedKmh < 0) return { decelMps2: 0, lockedWheels: 0 };
	const road = dragForce(speedKmh, input.dragCd ?? 0, input.frontalAreaM2 ?? 0)
		+ rollingForceAtSpeed(input.massKg, input.rollingCrr ?? 0, speedKmh)
		+ gradeForce(input.massKg, input.roadGradePercent ?? 0);
	let decel = 0;
	let tires = { forceN: 0, locked: 0 };
	for (let i = 0; i < 16; i += 1) {
		tires = tireBrakes(input, speedKmh, decel, timeS);
		const next = (tires.forceN + road) / input.massKg;
		if (Math.abs(next - decel) < 0.001) {
			decel = next;
			break;
		}
		decel = (decel + next) / 2;
	}
	return { decelMps2: decel, lockedWheels: tires.locked };
};

/**
 * @brief Integrate a stopping run; truncate the final step at exactly zero speed.
 * @param input Vehicle and braking settings.
 * @param initialSpeedKmh Starting speed, bounded to 500 km/h.
 * @return Stopping metrics, null if the vehicle cannot stop within 60 seconds.
 */
export const simulateBraking = (input: BrakingInput, initialSpeedKmh = 100): BrakingResult => {
	const result: BrakingResult = { distanceM: null, timeS: null, maxLockedWheels: 0, samples: [] };
	if (!validBrakingInput(input) || !Number.isFinite(initialSpeedKmh) || initialSpeedKmh <= 0 || initialSpeedKmh > 500) return result;
	let speed = initialSpeedKmh / 3.6;
	let distance = 0;
	let time = 0;
	for (let step = 0; step < 6000; step += 1) {
		const braking = brakingAtSpeed(input, speed * 3.6, time);
		if (!Number.isFinite(braking.decelMps2)) return result;
		result.maxLockedWheels = Math.max(result.maxLockedWheels, braking.lockedWheels);
		if (step % 10 === 0) result.samples.push({ timeS: time, distanceM: distance, speedKmh: speed * 3.6, ...braking });
		const dt = braking.decelMps2 > 0 ? Math.min(0.01, speed / braking.decelMps2) : 0.01;
		const next = Math.max(0, speed - braking.decelMps2 * dt);
		distance += (speed + next) * dt / 2;
		time += dt;
		speed = next;
		if (speed < 1e-8) {
			result.distanceM = distance;
			result.timeS = time;
			result.samples.push({ timeS: time, distanceM: distance, speedKmh: 0, ...braking });
			break;
		}
		if (speed * 3.6 > 500) break;
	}
	return result;
};
