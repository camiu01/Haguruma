/**
 * @file gear-optimizer.ts
 * @brief Discrete gearset search and track-archetype constraints.
 */
import { speedKmh, rpmFromKmh } from './speed-math';
import { engineTorqueAt, validateCurve, type EngineCurve } from './traction-math';

export const TRACK_PROFILES = {
	tight: { targetKmh: 180, minimumLandingFraction: 0.7, cornerSpeedsKmh: [45, 70] },
	balanced: { targetKmh: 240, minimumLandingFraction: 0.65, cornerSpeedsKmh: [80, 120] },
	fast: { targetKmh: 300, minimumLandingFraction: 0.6, cornerSpeedsKmh: [120, 160] },
} as const;

/** Explicit corner targets for second/third gear, using the active torque curve. */
export interface TrackGearingTarget { cornerSpeedsKmh: readonly [number, number]; curve: EngineCurve }

/**
 * @brief Keep second/third gear inside the useful torque band at the target corners.
 * @param gears Candidate gearset.
 * @param fd Candidate final drive.
 * @param circM Rolling circumference.
 * @param track Optional corner targets.
 * @return Whether each available corner gear avoids low torque and the limiter.
 */
const supportsCorners = (gears: number[], fd: number, circM: number, track?: TrackGearingTarget): boolean => {
	if (!track) return true;
	return track.cornerSpeedsKmh.every((speed, index) => {
		const gear = gears[index + 1];
		if (gear === undefined) return true;
		const rpm = rpmFromKmh(speed, gear, fd, circM);
		return rpm >= 1000 && rpm <= track.curve.redline * 0.95
			&& engineTorqueAt(rpm, track.curve) >= track.curve.peakTorqueNm * 0.75;
	});
};

/**
 * @brief Generate a small discrete catalog of geometric gearsets.
 * @param first First-gear ratio.
 * @param count Gear count.
 * @return Candidate decreasing gearsets with different spacing.
 */
export const gearsetCandidates = (first: number, count: number): number[][] => {
	if (!Number.isFinite(first) || first <= 0 || count < 2 || count > 8 || !Number.isInteger(count)) return [];
	return [0.62, 0.66, 0.7, 0.74, 0.78, 0.82, 0.86].map((spacing) =>
		Array.from({ length: count }, (_, index) => Number((first * spacing ** index).toFixed(3))));
};

/**
 * @brief Choose the shortest feasible gearing reaching a straight-line target.
 * @param candidates Discrete gearsets.
 * @param finalDrives Available final drives.
 * @param circM Rolling circumference.
 * @param redline Rev limiter.
 * @param targetKmh Minimum speed at the top-gear limiter.
 * @param maxDropFraction Maximum fractional RPM loss at each upshift.
 * @param track Optional corner targets to avoid second/third-gear torque dead spots.
 * @return Best feasible gearset and final drive, null if constraints conflict.
 */
export const optimizeGearset = (candidates: number[][], finalDrives: number[], circM: number, redline: number, targetKmh: number, maxDropFraction: number, track?: TrackGearingTarget): { gears: number[]; fd: number; topKmh: number } | null => {
	if (![circM, redline, targetKmh, maxDropFraction].every(Number.isFinite)
		|| circM <= 0 || redline <= 0 || targetKmh <= 0 || maxDropFraction <= 0 || maxDropFraction >= 1) return null;
	if (track && (!validateCurve(track.curve) || track.cornerSpeedsKmh.length !== 2
		|| track.cornerSpeedsKmh.some((speed) => !Number.isFinite(speed) || speed <= 0 || speed > 400))) return null;
	let best: { gears: number[]; fd: number; topKmh: number } | null = null;
	for (const gears of candidates.slice(0, 1000)) {
		if (gears.length < 2 || gears.length > 8 || gears.some((ratio, index) => !Number.isFinite(ratio) || ratio < 0.3 || ratio > 8
			|| (index > 0 && (ratio >= gears[index - 1] || 1 - ratio / gears[index - 1] > maxDropFraction)))) continue;
		for (const fd of finalDrives.slice(0, 100)) {
			if (!Number.isFinite(fd) || fd <= 0 || !supportsCorners(gears, fd, circM, track)) continue;
			const topKmh = speedKmh(redline, gears[gears.length - 1], fd, circM);
			if (topKmh >= targetKmh && (!best || topKmh < best.topKmh)) best = { gears: [...gears], fd, topKmh };
		}
	}
	return best;
};
