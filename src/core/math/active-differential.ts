/**
 * @file active-differential.ts
 * @brief Axle clutch preload, torque vectoring and adaptive AWD center coupling.
 */
import type { RunningGear } from '../models';

/**
 * @brief Resolve an axle capacity without exceeding either tire's grip.
 * @param rg Differential controls.
 * @param leftN Left wheel capacity.
 * @param rightN Right wheel capacity.
 * @param bias Power or coast clutch lock.
 * @param radiusM Rolling radius used to convert preload torque.
 * @return Total transmissible axle force.
 */
export const axleCapacityN = (
	rg: RunningGear, leftN: number, rightN: number, bias: number, radiusM = 0.3,
): number => {
	const low = Math.max(0, Math.min(leftN, rightN));
	const high = Math.max(0, Math.max(leftN, rightN));
	const lock = Number.isFinite(bias) ? Math.max(0, Math.min(1, bias)) : 0;
	const preload = Number.isFinite(rg.differentialPreloadNm)
		? Math.max(0, rg.differentialPreloadNm ?? 0) / Math.max(0.05, radiusM) : 0;
	let capacity = 2 * low;
	if (rg.differentialType === 'spool') capacity = low + high;
	if (rg.differentialType === 'torsen') capacity = low + Math.min(high, 3 * low);
	if (rg.differentialType === 'clutch_lsd') capacity = low + Math.min(high, low + lock * (high - low) + preload);
	const vectoring = Number.isFinite(rg.torqueVectoring) ? Math.max(0, Math.min(1, rg.torqueVectoring ?? 0)) : 0;
	return capacity + vectoring * (low + high - capacity);
};

/**
 * @brief Resolve AWD capacity with a bounded adaptive front/rear torque split.
 * @param rg Center differential controls.
 * @param frontN Front axle capacity.
 * @param rearN Rear axle capacity.
 * @return AWD force limit and effective front torque fraction.
 */
export const centerCapacityN = (rg: RunningGear, frontN: number, rearN: number): { limitN: number; frontShare: number } => {
	if (rg.handbrakeApplied && (rg.handbrakeDisengage ?? true)) return { limitN: 0, frontShare: 0 };
	const nominal = Number.isFinite(rg.awdFrontShare) ? Math.max(0, Math.min(1, rg.awdFrontShare ?? 0.5)) : 0.5;
	const lock = Number.isFinite(rg.centerDiffLock) ? Math.max(0, Math.min(1, rg.centerDiffLock ?? 0)) : 0;
	const optimal = frontN + rearN > 0 ? frontN / (frontN + rearN) : nominal;
	const frontShare = nominal + lock * (optimal - nominal);
	const frontLimit = frontShare > 0 ? frontN / frontShare : Infinity;
	const rearLimit = frontShare < 1 ? rearN / (1 - frontShare) : Infinity;
	return { limitN: Math.max(0, Math.min(frontLimit, rearLimit, frontN + rearN)), frontShare };
};
