/**
 * @file graph-snap.ts
 * @brief Magnetic selection of reachable primary and comparison curves.
 */
import { state } from '../../core/state/app-state';
import { calculateRpm } from '../../core/math/speed-math';
import { parseTire, effectiveCircumferenceM } from '../../core/math/tire-math';

/**
 * @brief Find the closest reachable curve at the requested speed.
 * @param speed Speed in display units.
 * @param targetRpm Pointer RPM, or active gear RPM for keyboard scrubbing.
 * @return Nearest gear selection, null outside all redlines.
 */
export const nearestGraphGear = (speed: number, targetRpm: number): { index: number; rpm: number; compare: boolean } | null => {
	let best: { index: number; rpm: number; compare: boolean } | null = null;
	let distance = Infinity;
	for (const compare of state.compareEnabled ? [false, true] : [false]) {
		const tire = parseTire(compare ? state.compTire : state.primaryTire);
		if (!tire) {
			continue;
		}
		const circ = effectiveCircumferenceM(tire, state.rollingFactor);
		const gears = compare ? state.compGears : state.gears;
		const fd = compare ? state.compFd : state.primaryFd;
		const redline = compare ? state.compRedline : state.primaryRedline;
		gears.forEach((ratio, index) => {
			const rpm = calculateRpm(speed, ratio, fd, circ, state.unit);
			const delta = Math.abs(rpm - targetRpm);
			if (rpm >= 0 && rpm <= redline && delta < distance) {
				distance = delta;
				best = { index, rpm, compare };
			}
		});
	}
	return best;
};
