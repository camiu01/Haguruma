/**
 * @file corner-advisor.ts
 * @brief Apex gearing and safe downshift/rev-match calculations.
 */
import { rpmFromKmh } from './speed-math';
import { GRAVITY, engineBrakeForceAt, maxCoastForceAtSpeed } from './dynamics-math';
import { dynamicRadiusM, type EngineCurve } from './traction-math';
import type { RunningGear } from '../models';

/**
 * @brief Recommend a gear that avoids an apex upshift or over-rev.
 * @param radiusM Corner radius in metres.
 * @param lateralG Available lateral acceleration.
 * @param gears Forward gear ratios.
 * @param fd Final drive.
 * @param circM Effective tire circumference.
 * @param curve Engine anchors.
 * @return Apex speed and one-based gear recommendation.
 */
export const apexGearAdvice = (radiusM: number, lateralG: number, gears: number[], fd: number, circM: number, curve: EngineCurve): { speedKmh: number; gear: number; rpm: number } | null => {
	if (![radiusM, lateralG, fd, circM].every(Number.isFinite) || radiusM <= 0 || lateralG <= 0 || fd <= 0 || circM <= 0) return null;
	const speedKmh = Math.sqrt(radiusM * lateralG * GRAVITY) * 3.6;
	for (let index = 0; index < gears.length; index += 1) {
		const rpm = rpmFromKmh(speedKmh, gears[index], fd, circM);
		if (rpm >= curve.peakTorqueRpm && rpm <= curve.redline * 0.9) return { speedKmh, gear: index + 1, rpm };
	}
	return null;
};

/**
 * @brief Compute a safe downshift blip and subsequent closed-throttle deceleration.
 * @param speedKmh Speed at the downshift.
 * @param fromRatio Current ratio.
 * @param toRatio Lower-gear ratio.
 * @param fd Final drive.
 * @param circM Effective circumference.
 * @param curve Engine anchors.
 * @param rg Running gear.
 * @param massKg Vehicle mass.
 * @param efficiency Driveline efficiency.
 * @return Target RPM, blip delta and grip-limited engine-braking deceleration.
 */
export const downshiftAdvice = (speedKmh: number, fromRatio: number, toRatio: number, fd: number, circM: number, curve: EngineCurve, rg: RunningGear, massKg: number, efficiency: number): { targetRpm: number; blipRpm: number; decelMps2: number; lockRisk: boolean } | null => {
	if (![speedKmh, fromRatio, toRatio, fd, circM, massKg, efficiency].every(Number.isFinite)
		|| speedKmh < 0 || fromRatio <= 0 || toRatio <= fromRatio || fd <= 0 || circM <= 0 || massKg <= 0) return null;
	const targetRpm = rpmFromKmh(speedKmh, toRatio, fd, circM);
	if (targetRpm > curve.redline) return null;
	const demand = engineBrakeForceAt(targetRpm, toRatio, fd, dynamicRadiusM(circM), curve, efficiency);
	const limit = maxCoastForceAtSpeed(rg, massKg, speedKmh, demand, demand / massKg);
	return { targetRpm, blipRpm: targetRpm - rpmFromKmh(speedKmh, fromRatio, fd, circM),
		decelMps2: Math.min(demand, limit.limitN) / massKg, lockRisk: limit.isLockup };
};
