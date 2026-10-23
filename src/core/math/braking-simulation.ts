/**
 * @file braking-simulation.ts
 * @brief Bias-limited braking with load transfer, wheel lock and optional ABS.
 */
import type { RunningGear } from '../models';
import { downforceN, wheelLoads, kammLimit, GRAVITY } from './dynamics-math';
import { dragForce, gradeForce } from './aero-math';
import { gripGainFor } from '../../config/tire-compounds';

export interface BrakingInput {
	speedKmh: number;
	massKg: number;
	runningGear: RunningGear;
	frontBias: number;
	abs: boolean;
	dragCd: number;
	areaM2: number;
	gradePercent: number;
}
export interface BrakingPoint { timeS: number; distanceM: number; speedKmh: number; decelMps2: number }
export interface BrakingTireForces {
	forceN: number; frontForceN: number; rearForceN: number; frontCapacityN: number; rearCapacityN: number;
	frontLock: boolean; rearLock: boolean;
}
export interface BrakingResult {
	distanceM: number | null;
	timeS: number | null;
	frontLock: boolean;
	rearLock: boolean;
	points: BrakingPoint[];
}

/**
 * @brief Resolve a wheel-lock-limited axle braking force.
 * @param demand Requested axle force.
 * @param capacity Tire friction budget.
 * @param abs Whether ABS reduces demand near the peak.
 * @param timeS Simulated time for ABS cycling.
 * @return Actual axle braking force.
 */
const axleForce = (demand: number, capacity: number, abs: boolean, timeS: number): number => {
	if (demand <= capacity) {
		return demand;
	}
	return capacity * (abs ? (timeS % 0.08 < 0.02 ? 0.9 : 1) : 0.75);
};

/**
 * @brief Resolve tire braking independently of drag, shared by stop and lap solvers.
 * @param input Brake setup.
 * @param speedKmh Current road speed.
 * @param decel Previous deceleration magnitude.
 * @param timeS Simulation time for approximate ABS cycling.
 * @param fraction Pedal demand from zero to one.
 * @return Actual tire force and axle lock flags.
 */
export const brakingTireForce = (input: BrakingInput, speedKmh: number, decel: number, timeS: number, fraction = 1): BrakingTireForces => {
	const rg = input.runningGear;
	const mu = rg.roadFrictionCoefficient * gripGainFor(rg.tireCompoundId);
	const loads = wheelLoads(rg, input.massKg, -decel);
	const down = downforceN(rg.liftCoefficient ?? 0, rg.liftReferenceAreaM2 ?? input.areaM2, speedKmh);
	const share = rg.downforceFrontShare ?? rg.frontWeightDistribution;
	const lateral = input.massKg * GRAVITY * Math.abs(rg.lateralG);
	const front = kammLimit(mu, loads.fl + loads.fr + down * share, lateral * rg.frontWeightDistribution);
	const rear = kammLimit(mu, loads.rl + loads.rr + down * (1 - share), lateral * (1 - rg.frontWeightDistribution));
	const demand = mu * (input.massKg * GRAVITY + down) * Math.max(0, Math.min(1, fraction));
	const fd = demand * input.frontBias;
	const rd = demand * (1 - input.frontBias);
	const frontForceN = axleForce(fd, front, input.abs, timeS);
	const rearForceN = axleForce(rd, rear, input.abs, timeS);
	return { forceN: frontForceN + rearForceN, frontForceN, rearForceN, frontCapacityN: front, rearCapacityN: rear,
		frontLock: !input.abs && fd > front + 1, rearLock: !input.abs && rd > rear + 1 };
};

/**
 * @brief Integrate a stop with aero, grade and dynamic axle capacities.
 * @param input Braking setup.
 * @return Stop metrics and sampled profile; null metrics if no stop is possible.
 */
export const simulateBraking = (input: BrakingInput): BrakingResult => {
	const result: BrakingResult = { distanceM: null, timeS: null, frontLock: false, rearLock: false, points: [] };
	if (![input.speedKmh, input.massKg, input.frontBias, input.dragCd, input.areaM2, input.gradePercent].every(Number.isFinite)
		|| input.speedKmh < 0 || input.speedKmh > 500 || input.massKg <= 0 || input.frontBias < 0 || input.frontBias > 1) {
		return result;
	}
	const rg = input.runningGear;
	const mu = rg.roadFrictionCoefficient * gripGainFor(rg.tireCompoundId);
	if (!Number.isFinite(mu) || mu <= 0) {
		return result;
	}
	let v = input.speedKmh / 3.6;
	let distance = 0;
	let decel = mu * GRAVITY;
	if (v === 0) return { ...result, distanceM: 0, timeS: 0, points: [{ timeS: 0, distanceM: 0, speedKmh: 0, decelMps2: 0 }] };
	result.points.push({ timeS: 0, distanceM: 0, speedKmh: input.speedKmh, decelMps2: decel });
	for (let step = 0; step < 12000 && v > 0; step += 1) {
		const braking = brakingTireForce(input, v * 3.6, decel, step * 0.01);
		result.frontLock ||= braking.frontLock;
		result.rearLock ||= braking.rearLock;
		const force = braking.forceN
			+ dragForce(v * 3.6, input.dragCd, input.areaM2) + gradeForce(input.massKg, input.gradePercent);
		decel = force / input.massKg;
		if (!Number.isFinite(decel) || decel <= 0) return result;
		const dt = Math.min(0.01, v / decel);
		const next = Math.max(0, v - decel * dt);
		distance += (v + next) * 0.5 * dt;
		v = next;
		if (step % 10 === 0 || v === 0) result.points.push({ timeS: step * 0.01 + dt, distanceM: distance, speedKmh: v * 3.6, decelMps2: decel });
		if (v === 0) { result.distanceM = distance; result.timeS = step * 0.01 + dt; }
	}
	return result;
};
