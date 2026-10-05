/**
 * @file corner-advisor.ts
 * @brief Apex speed and pre-corner gear selection, avoiding mid-corner shifts.
 */
import { GRAVITY } from './dynamics-math';
import { rpmFromKmh } from './speed-math';
import { dynamicRadiusM, type EngineCurve } from './traction-math';
import { wheelForceAt } from './drive-force';
import type { RunningGear } from '../models';

export interface ApexAdvice {
	speedKmh: number;
	gearIndex: number;
	rpm: number;
	action: 'hold' | 'downshift' | 'upshift';
}

/**
 * @brief Select a usable apex gear, retaining the current gear within 10% of best force.
 * @param radiusM Corner radius.
 * @param maxG Sustained lateral acceleration budget.
 * @param gears Available ratios.
 * @param fd Final drive.
 * @param circM Rolling circumference.
 * @param curve Valid engine curve.
 * @param currentGear Zero-based approach gear.
 * @param efficiency Nominal transmission efficiency.
 * @param rg Optional running gear for mapped losses.
 * @param mapped Enable the efficiency map.
 * @return Apex speed and pre-corner shift instruction, or null when invalid.
 */
export const adviseApexGear = (
	radiusM: number, maxG: number, gears: number[], fd: number, circM: number,
	curve: EngineCurve | null, currentGear: number, efficiency = 0.85, rg?: RunningGear, mapped = false,
): ApexAdvice | null => {
	if (!curve || ![radiusM, maxG, fd, circM, efficiency].every(Number.isFinite)
		|| radiusM <= 0 || maxG <= 0 || fd <= 0 || circM <= 0 || !gears.length
		|| !Number.isInteger(currentGear) || currentGear < 0 || currentGear >= gears.length) return null;
	const speedKmh = Math.sqrt(radiusM * maxG * GRAVITY) * 3.6;
	let best = -1;
	let bestForce = 0;
	let currentForce = 0;
	for (let i = 0; i < gears.length; i += 1) {
		const rpm = rpmFromKmh(speedKmh, gears[i], fd, circM);
		if (!Number.isFinite(rpm) || rpm < 1000 || rpm > curve.redline) continue;
		const force = wheelForceAt(rpm, gears[i], fd, dynamicRadiusM(circM), curve, efficiency, rg, mapped);
		if (i === currentGear) currentForce = force;
		if (force > bestForce) {
			best = i;
			bestForce = force;
		}
	}
	if (best < 0) return null;
	if (currentForce >= bestForce * 0.9) best = currentGear;
	return { speedKmh, gearIndex: best, rpm: rpmFromKmh(speedKmh, gears[best], fd, circM),
		action: best === currentGear ? 'hold' : best < currentGear ? 'downshift' : 'upshift' };
};
