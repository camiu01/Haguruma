/**
 * @file graph-viewport.ts
 * @brief Bounded zoom and pan window of the RPM plot, DOM-free and testable.
 *
 * The plot is always drawn through `svg-frame.ts`, so zoom and pan only shrink
 * the window every layer projects into. Bounds are expressed in physical units
 * (km/h and RPM) rather than user units, which keeps the limits meaningful at
 * every host size and keeps the module free of any DOM dependency.
 */
import type { GraphWindow } from '../../core/models';
import { clampNum } from './svg-frame';

/** Axis limits the window may never leave, in km/h and RPM. */
export const VIEW_LIMITS = {
	/** Hard ceiling of the speed axis in km/h. */
	maxKmh: 2000,
	/** Hard ceiling of the engine-speed axis in RPM. */
	maxRpm: 30000,
	/** Narrowest zoomable speed span in km/h, keeps the grid readable. */
	minSpanKmh: 5,
	/** Narrowest zoomable engine-speed span in RPM. */
	minSpanRpm: 250,
	/** Largest zoom-in factor applied by one button press. */
	step: 1.6,
} as const;

/** Pan gesture state carried between pointer events. */
export interface PanStart {
	/** Pointer X in viewport pixels at the gesture start. */
	clientX: number;
	/** Pointer Y in viewport pixels at the gesture start. */
	clientY: number;
	/** Window captured when the gesture started. */
	window: GraphWindow;
}

/** Anchor of a zoom step, in the axis units of the active display unit. */
export interface ZoomAnchor {
	/** Anchor speed in display units, defaults to the window centre. */
	speed?: number;
	/** Anchor engine speed in RPM, defaults to the window centre. */
	rpm?: number;
}

/**
 * @brief Clamp a candidate window into the axis bounds.
 * @brief The span is bounded first, then the offset is slid back inside the
 * @brief axis, so a zoom at the far right of the plot cannot push the window
 * @brief past the axis ceiling.
 * @param window Candidate window.
 * @param maxKmh Axis ceiling in km/h.
 * @param maxRpm Axis ceiling in RPM.
 * @return Window inside `[0, maxKmh] x [0, maxRpm]`.
 */
export const clampWindow = (window: GraphWindow, maxKmh: number, maxRpm: number): GraphWindow => {
	const ceilingKmh = Math.max(VIEW_LIMITS.minSpanKmh, maxKmh);
	const ceilingRpm = Math.max(VIEW_LIMITS.minSpanRpm, maxRpm);
	const spanKmh = clampNum(window.maxKmh - window.minKmh, VIEW_LIMITS.minSpanKmh, ceilingKmh);
	const spanRpm = clampNum(window.maxRpm - window.minRpm, VIEW_LIMITS.minSpanRpm, ceilingRpm);
	const minKmh = clampNum(window.minKmh, 0, ceilingKmh - spanKmh);
	const minRpm = clampNum(window.minRpm, 0, ceilingRpm - spanRpm);
	return { minKmh, maxKmh: minKmh + spanKmh, minRpm, maxRpm: minRpm + spanRpm };
};

/**
 * @brief Build the window that shows the full axis.
 * @param maxKmh Axis ceiling in km/h.
 * @param maxRpm Axis ceiling in RPM.
 * @return Unzoomed window covering the whole plot.
 */
export const fullWindow = (maxKmh: number, maxRpm: number): GraphWindow => {
	return clampWindow({ minKmh: 0, maxKmh, minRpm: 0, maxRpm }, maxKmh, maxRpm);
};

/**
 * @brief Check whether a window is the identity window.
 * @param window Window to test.
 * @param maxKmh Axis ceiling in km/h.
 * @param maxRpm Axis ceiling in RPM.
 * @return True when the window shows the full axis.
 */
export const isFullWindow = (window: GraphWindow, maxKmh: number, maxRpm: number): boolean => {
	const full = fullWindow(maxKmh, maxRpm);
	const epsilon = 1e-6;
	return (
		Math.abs(window.minKmh - full.minKmh) < epsilon &&
		Math.abs(window.maxKmh - full.maxKmh) < epsilon &&
		Math.abs(window.minRpm - full.minRpm) < epsilon &&
		Math.abs(window.maxRpm - full.maxRpm) < epsilon
	);
};

/**
 * @brief Zoom one axis window around an anchor value.
 * @param min Current lower bound.
 * @param max Current upper bound.
 * @param anchor Anchor kept under the cursor, defaults to the centre.
 * @param factor Multiplier below 1 to zoom in, above 1 to zoom out.
 * @param minSpan Narrowest span this axis may reach.
 * @param ceiling Axis ceiling of this dimension.
 * @return New lower and upper bounds.
 */
const zoomAxis = (min: number, max: number, anchor: number, factor: number, minSpan: number, ceiling: number): [number, number] => {
	const span = max - min;
	const nextSpan = clampNum(span * factor, minSpan, ceiling);
	const focus = clampNum(Number.isFinite(anchor) ? anchor : (min + max) / 2, min, max);
	const minNext = clampNum(focus - ((focus - min) / span) * nextSpan, 0, ceiling - nextSpan);
	return [minNext, minNext + nextSpan];
};

/**
 * @brief Zoom the window around a speed and engine-speed anchor.
 * @param window Current window.
 * @param factor Multiplier below 1 to zoom in, above 1 to zoom out.
 * @param maxKmh Axis ceiling in km/h.
 * @param maxRpm Axis ceiling in RPM.
 * @param anchor Anchor values, defaults to the window centre.
 * @return Zoomed window, clamped to the axis.
 */
export const zoomWindow = (window: GraphWindow, factor: number, maxKmh: number, maxRpm: number, anchor: ZoomAnchor = {}): GraphWindow => {
	if (!Number.isFinite(factor) || factor <= 0) {
		return clampWindow(window, maxKmh, maxRpm);
	}
	const [minKmh, maxKmhNext] = zoomAxis(
		window.minKmh,
		window.maxKmh,
		anchor.speed ?? (window.minKmh + window.maxKmh) / 2,
		factor,
		VIEW_LIMITS.minSpanKmh,
		maxKmh,
	);
	const [minRpm, maxRpmNext] = zoomAxis(
		window.minRpm,
		window.maxRpm,
		anchor.rpm ?? (window.minRpm + window.maxRpm) / 2,
		factor,
		VIEW_LIMITS.minSpanRpm,
		maxRpm,
	);
	return clampWindow({ minKmh, maxKmh: maxKmhNext, minRpm, maxRpm: maxRpmNext }, maxKmh, maxRpm);
};

/**
 * @brief Translate the window by a physical offset.
 * @param window Current window.
 * @param deltaKmh Speed offset in km/h, positive pans towards higher speeds.
 * @param deltaRpm Engine-speed offset in RPM, positive pans upwards.
 * @param maxKmh Axis ceiling in km/h.
 * @param maxRpm Axis ceiling in RPM.
 * @return Panned window, clamped to the axis.
 */
export const panWindow = (window: GraphWindow, deltaKmh: number, deltaRpm: number, maxKmh: number, maxRpm: number): GraphWindow => {
	return clampWindow(
		{
			minKmh: window.minKmh + (Number.isFinite(deltaKmh) ? deltaKmh : 0),
			maxKmh: window.maxKmh + (Number.isFinite(deltaKmh) ? deltaKmh : 0),
			minRpm: window.minRpm + (Number.isFinite(deltaRpm) ? deltaRpm : 0),
			maxRpm: window.maxRpm + (Number.isFinite(deltaRpm) ? deltaRpm : 0),
		},
		maxKmh,
		maxRpm,
	);
};

/**
 * @brief Project a value into the visible fraction of one axis.
 * @param value Value in axis units.
 * @param min Window lower bound.
 * @param max Window upper bound.
 * @return Fraction between 0 and 1, NaN-safe.
 */
export const windowFraction = (value: number, min: number, max: number): number => {
	const span = max - min;
	if (!Number.isFinite(value) || !(span > 0)) {
		return 0;
	}
	return (value - min) / span;
};
