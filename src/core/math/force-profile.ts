/**
 * @file force-profile.ts
 * @brief Shared per-gear wheel force, road resistance and transferred traction margin.
 */
import { dragForce, gradeForce, rollingForceAtSpeed } from './aero-math';
import { transferredDriveForce, wheelForceAt } from './drive-force';
import { maxDriveForceAtSpeed } from './dynamics-math';
import { rpmFromKmh, speedKmh } from './speed-math';
import { dynamicRadiusM, type EngineCurve } from './traction-math';
import type { RunningGear } from '../models';

export interface ForceProfileInput {
	gears: number[];
	fd: number;
	circM: number;
	curve: EngineCurve | null;
	eff: number;
	mapped?: boolean;
	runningGear: RunningGear;
	massKg: number;
	cd: number;
	areaM2: number;
	crr: number;
	grade: number;
}

export interface ForceReadout {
	driveN: number;
	resistanceN: number;
	gripN: number;
	marginN: number;
	rpm: number;
}

/**
 * @brief Evaluate road loads with rolling-speed correction and signed grade.
 * @param input Road and vehicle settings.
 * @param speedKmh Road speed.
 * @return Resistance in newtons.
 */
export const resistanceAt = (input: ForceProfileInput, speedKmh: number): number => {
	return dragForce(speedKmh, input.cd, input.areaM2)
		+ rollingForceAtSpeed(input.massKg, input.crr, speedKmh) + gradeForce(input.massKg, input.grade);
};

/**
 * @brief Sample a gear's force and grip using the same transfer solve as acceleration.
 * @param input Powertrain and chassis.
 * @param gearIndex Zero-based gear.
 * @param speedKmh Road speed.
 * @return Raw engine force, road load and positive excess indicating wheelspin.
 */
export const forceReadoutAt = (input: ForceProfileInput, gearIndex: number, speedKmh: number): ForceReadout => {
	const ratio = input.gears[gearIndex];
	const rpm = rpmFromKmh(speedKmh, ratio, input.fd, input.circM);
	const resistanceN = resistanceAt(input, speedKmh);
	const driveN = input.curve && rpm >= 1000 && rpm <= input.curve.redline
		? wheelForceAt(rpm, ratio, input.fd, dynamicRadiusM(input.circM), input.curve, input.eff, input.runningGear, input.mapped) : 0;
	const radius = dynamicRadiusM(input.circM);
	const available = transferredDriveForce(input.runningGear, input.massKg, input.massKg, speedKmh, driveN, resistanceN, radius);
	const accel = (available - resistanceN) / input.massKg;
	const gripN = maxDriveForceAtSpeed(input.runningGear, input.massKg, speedKmh, driveN, accel, undefined, undefined, radius).limitN;
	return { driveN, resistanceN, gripN, marginN: driveN - gripN, rpm };
};

/**
 * @brief Evaluate steady-speed wheel-force surplus with zero net load transfer.
 * @param input Vehicle force model.
 * @param index Selected gear.
 * @param rpm Engine speed inside its usable range.
 * @return Available minus required force in newtons.
 */
const steadyForceGap = (input: ForceProfileInput, index: number, rpm: number): number => {
	const radius = dynamicRadiusM(input.circM);
	const speed = speedKmh(rpm, input.gears[index], input.fd, input.circM);
	const demand = wheelForceAt(rpm, input.gears[index], input.fd, radius, input.curve!, input.eff, input.runningGear, input.mapped);
	const grip = maxDriveForceAtSpeed(input.runningGear, input.massKg, speed, demand, 0, undefined, undefined, radius).limitN;
	return Math.min(demand, grip) - resistanceAt(input, speed);
};

/**
 * @brief Find the highest steady speed across usable gears, including limiter-bound speeds.
 * @param input Vehicle force model.
 * @return Estimated achievable speed in km/h, null when no gear can overcome resistance.
 */
export const forceLimitedSpeedKmh = (input: ForceProfileInput): number | null => {
	if (!input.curve || ![input.circM, input.fd, input.massKg, input.curve.redline].every(Number.isFinite)
		|| input.circM <= 0 || input.fd <= 0 || input.massKg <= 0 || !input.gears.length
		|| input.curve.redline < 1000 || input.curve.redline > 12000) return null;
	let best = 0;
	for (let index = 0; index < input.gears.length; index += 1) {
		let lastFeasible: number | null = null;
		for (let rpm = 1000; rpm <= input.curve.redline + 50; rpm += 50) {
			const sampleRpm = Math.min(rpm, input.curve.redline);
			if (steadyForceGap(input, index, sampleRpm) >= 0) {
				lastFeasible = sampleRpm;
				best = Math.max(best, speedKmh(sampleRpm, input.gears[index], input.fd, input.circM));
			} else if (lastFeasible !== null) {
				let lo = lastFeasible;
				let hi = sampleRpm;
				for (let step = 0; step < 22; step += 1) {
					const mid = (lo + hi) / 2;
					if (steadyForceGap(input, index, mid) >= 0) lo = mid;
					else hi = mid;
				}
				best = Math.max(best, speedKmh(lo, input.gears[index], input.fd, input.circM));
				lastFeasible = null;
			}
			if (sampleRpm === input.curve.redline) break;
		}
	}
	return best > 0 ? best : null;
};
