/**
 * @file power-crossing.ts
 * @brief Robust crossing geometry for available and required power curves.
 */

/**
 * @brief Bisect a downward crossing inside a speed bracket.
 * @param loKmh Lower speed with nonnegative power gap.
 * @param hiKmh Upper speed with negative power gap.
 * @param gapAt Available minus required power.
 * @return Crossing speed in km/h.
 */
const bisectCrossing = (loKmh: number, hiKmh: number, gapAt: (vKmh: number) => number): number => {
	let lo = loKmh;
	let hi = hiKmh;
	for (let i = 0; i < 22; i += 1) {
		const mid = (lo + hi) / 2;
		if (gapAt(mid) >= 0) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
};

/**
 * @brief Find the first downward crossing after power becomes usable.
 * @param availableKwAt Available wheel power.
 * @param requiredKwAt Required wheel power.
 * @param hiKmh Upper scan bound.
 * @param stepKmh Scan interval.
 * @return Crossing speed, null if none is found.
 */
export const crossingSpeedKmh = (
	availableKwAt: (vKmh: number) => number, requiredKwAt: (vKmh: number) => number,
	hiKmh: number, stepKmh = 2,
): number | null => {
	if (!Number.isFinite(hiKmh) || hiKmh <= 0 || !Number.isFinite(stepKmh) || stepKmh <= 0) return null;
	const gapAt = (v: number): number => availableKwAt(v) - requiredKwAt(v);
	if (gapAt(0) < 0) return null;
	let lo = 0;
	for (let v = stepKmh; v <= hiKmh + 1e-6; v += stepKmh) {
		if (gapAt(v) < 0) return bisectCrossing(lo, v, gapAt);
		lo = v;
	}
	return null;
};
