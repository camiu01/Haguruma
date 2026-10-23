/**
 * @file graph-viewport.ts
 * @brief Bounded zoom/pan geometry and redline-based axis fitting.
 */
import { state } from '../../core/state/app-state';
import type { AppState } from '../../core/models';
import { calculateSpeed, fromDisplaySpeed } from '../../core/math/speed-math';
import { effectiveCircumferenceM, parseTire } from '../../core/math/tire-math';
import { getMaxRpm } from '../../core/units/unit-utils';

export type GraphWindow = NonNullable<AppState['graphWindow']>;

/**
 * @brief Return the current view in km/h and RPM.
 * @param none No parameters.
 * @return Independent window value.
 */
export const currentGraphWindow = (): GraphWindow => ({
	...(state.graphWindow ?? {
		minKmh: 0, maxKmh: fromDisplaySpeed(state.maxGraphSpeed, state.unit),
		minRpm: 0, maxRpm: getMaxRpm(state.compareEnabled ? Math.max(state.primaryRedline, state.compRedline) : state.primaryRedline),
	}),
});

/**
 * @brief Keep a zoomed interval finite and within supported physical bounds.
 * @param min Requested lower bound.
 * @param span Requested interval width.
 * @param floorSpan Minimum interval width.
 * @param ceiling Upper physical bound.
 * @return Clamped lower/upper bounds.
 */
const interval = (min: number, span: number, floorSpan: number, ceiling: number): [number, number] => {
	const width = Math.max(floorSpan, Math.min(ceiling, span));
	const low = Math.max(0, Math.min(ceiling - width, min));
	return [low, low + width];
};

/**
 * @brief Zoom both axes around an anchor and translate by normalized spans.
 * @param w Starting window.
 * @param factor Scale multiplier, below one zooms in.
 * @param x Horizontal anchor from zero to one.
 * @param y Vertical anchor measured from the bottom.
 * @param dx Horizontal pan in window widths.
 * @param dy Vertical pan in window heights.
 * @return Bounded window, unchanged for invalid inputs.
 */
export const transformGraphWindow = (w: GraphWindow, factor: number, x = 0.5, y = 0.5, dx = 0, dy = 0): GraphWindow => {
	if (![factor, x, y, dx, dy].every(Number.isFinite) || factor <= 0) {
		return { ...w };
	}
	const width = w.maxKmh - w.minKmh;
	const height = w.maxRpm - w.minRpm;
	const [minKmh, maxKmh] = interval(w.minKmh + width * (x * (1 - factor) + dx), width * factor, 5, 2000);
	const [minRpm, maxRpm] = interval(w.minRpm + height * (y * (1 - factor) + dy), height * factor, 250, 30000);
	return { minKmh, maxKmh, minRpm, maxRpm };
};

/**
 * @brief Fit the speed axis to all enabled forward-gear redline speeds.
 * @param margin Fraction of extra space, constrained to 0–50%.
 * @return Suggested axis maximum in the active display unit.
 */
export const fittedGraphSpeed = (margin: number): number => {
	let top = 0;
	const setups = [{ tire: state.primaryTire, fd: state.primaryFd, gears: state.gears, redline: state.primaryRedline }];
	if (state.compareEnabled) {
		setups.push({ tire: state.compTire, fd: state.compFd, gears: state.compGears, redline: state.compRedline });
	}
	for (const setup of setups) {
		const tire = parseTire(setup.tire);
		if (!tire) {
			continue;
		}
		const circ = effectiveCircumferenceM(tire, state.rollingFactor);
		for (const ratio of setup.gears) {
			top = Math.max(top, calculateSpeed(setup.redline, ratio, setup.fd, circ, state.unit));
		}
	}
	const safeMargin = Number.isFinite(margin) ? Math.max(0, Math.min(0.5, margin)) : 0.1;
	return Math.max(60, Math.ceil(top * (1 + safeMargin) / 10) * 10);
};
