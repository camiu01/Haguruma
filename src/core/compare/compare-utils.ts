/**
 * @file compare-utils.ts
 * @brief Helpers for the dual-setup comparison overlay.
 */
import { GRAPH_LIMITS } from '../../config/graph-constants';
import { calculateSpeed } from '../math/speed-math';
import type { SpeedUnit } from '../models';

/**
 * @brief Parse a comma-separated gear list for the secondary setup.
 * @param raw Raw input value.
 * @return Valid ratios or null when any entry is out of range.
 */
export const parseCompGears = (raw: string): number[] | null => {
	if (!raw) {
		return null;
	}
	const parts = raw.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
	if (parts.length === 0 || parts.length > GRAPH_LIMITS.maxGears) {
		return null;
	}
	const ratios: number[] = [];
	for (const part of parts) {
		const v = parseFloat(part);
		if (!Number.isFinite(v) || v < GRAPH_LIMITS.minGearRatio || v > GRAPH_LIMITS.maxGearRatio) {
			return null;
		}
		ratios.push(v);
	}
	return ratios;
};

/**
 * @brief Format gear ratios for the secondary input field.
 * @param gears Ratio list.
 * @return Comma-separated display string.
 */
export const formatCompGears = (gears: number[]): string => {
	return gears.map((g) => String(g)).join(', ');
};

/**
 * @brief Compute per-gear top-speed delta between setups.
 * @param primaryTops Top speeds of the primary setup.
 * @param compTops Top speeds of the secondary setup.
 * @return Delta list aligned to the longest gearset, null where missing.
 */
export const diffTopSpeeds = (primaryTops: number[], compTops: number[]): (number | null)[] => {
	const count = Math.max(primaryTops.length, compTops.length);
	const deltas: (number | null)[] = [];
	for (let i = 0; i < count; i += 1) {
		const p = primaryTops[i];
		const c = compTops[i];
		deltas.push(p === undefined || c === undefined ? null : c - p);
	}
	return deltas;
};

/**
 * @brief Compute redline top speeds for a full setup.
 * @param gears Gear ratios.
 * @param finalDrive Differential ratio.
 * @param circM Tire circumference in metres.
 * @param redline Rev limiter in RPM.
 * @param unit Display unit.
 * @return Top speed per gear.
 */
export const topsForSetup = (
	gears: number[],
	finalDrive: number,
	circM: number,
	redline: number,
	unit: SpeedUnit,
): number[] => {
	return gears.map((ratio) => calculateSpeed(redline, ratio, finalDrive, circM, unit));
};
