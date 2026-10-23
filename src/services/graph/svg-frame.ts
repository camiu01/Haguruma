/**
 * @file svg-frame.ts
 * @brief Pure plot geometry for the 16:9 SVG cartesian plot.
 *
 * Frame construction, coordinate projection and their inverses are DOM-free so
 * unit tests can round-trip them without a canvas, a measured element or a
 * browser. Every layer imports its mapping from here.
 */
import { GRAPH_PADDING, GRAPH_VIEWBOX } from '../../config/graph-constants';
import { getMaxRpm, getSpeedStep } from '../../core/units/unit-utils';
import { calculateRpm, calculateSpeed } from '../../core/math/speed-math';
import type { GraphWindow, PeakPoint, PlotFrame, SpeedUnit } from '../../core/models';
import { windowFraction } from './graph-viewport';

/**
 * @brief Resolve the Y-axis ceiling from the active rev limiters.
 * @param primaryRedline Primary rev limiter in RPM.
 * @param compRedline Secondary rev limiter in RPM.
 * @param compareEnabled True while the secondary overlay is visible.
 * @return Rounded axis maximum in RPM.
 */
export const plotMaxRpm = (primaryRedline: number, compRedline: number, compareEnabled: boolean): number => {
	const top = compareEnabled ? Math.max(primaryRedline, compRedline) : primaryRedline;
	return getMaxRpm(top);
};

/** Host width at which the plot insets reach their full size. */
const PAD_BASE_WIDTH = 900;

/** Lower clamp of the inset scale factor, keeps phones readable. */
const PAD_MIN_SCALE = 0.62;

/**
 * @brief Scale the plot insets with the host width.
 * @brief Narrow hosts shrink the gutters so the cartesian band keeps enough
 * @brief room, wide hosts keep the full insets tuned for the power axis.
 * @param width ViewBox width in CSS pixels.
 * @return Inset scale factor between PAD_MIN_SCALE and 1.
 */
const padScale = (width: number): number => {
	return Math.max(PAD_MIN_SCALE, Math.min(1, width / PAD_BASE_WIDTH));
};

/**
 * @brief Build the plot frame in viewBox user units.
 * @brief Without explicit dimensions the frame falls back to the static 16:9
 * @brief viewBox, which keeps the geometry unit-testable without a DOM.
 * @param maxSpeed Right edge of the X axis in display units.
 * @param maxRpm Top edge of the Y axis in RPM.
 * @param width ViewBox width in CSS pixels, defaults to the static width.
 * @param height ViewBox height in CSS pixels, defaults to the static height.
 * @param window Visible sub-window in display units and RPM, omitted when the
 * @param window shows the whole axis. Every projection below reads the window,
 * @param window so zoom and pan never have to touch a layer.
 * @return Frame with viewBox size, insets, data limits and the visible window.
 */
export const buildPlotFrame = (
	maxSpeed: number,
	maxRpm: number,
	width: number = GRAPH_VIEWBOX.width,
	height: number = GRAPH_VIEWBOX.height,
	window?: GraphWindow,
): PlotFrame => {
	const scale = padScale(width);
	const paddingTop = GRAPH_PADDING.top * scale;
	const paddingRight = GRAPH_PADDING.right * scale;
	const paddingBottom = GRAPH_PADDING.bottom * scale;
	const paddingLeft = GRAPH_PADDING.left * scale;
	const frame: PlotFrame = {
		width,
		height,
		paddingTop,
		paddingRight,
		paddingBottom,
		paddingLeft,
		plotWidth: width - paddingLeft - paddingRight,
		plotHeight: height - paddingTop - paddingBottom,
		maxSpeed,
		maxRpm,
		window: resolveWindow({ maxSpeed, maxRpm } as PlotFrame, window),
	};
	return frame;
};

/**
 * @brief Sanitize a candidate window against the frame axis limits.
 * @param frame Frame whose axes the window must fit.
 * @param window Candidate window, omitted for the full axis.
 * @return Usable window, never inverted and never outside the axis.
 */
const resolveWindow = (frame: Pick<PlotFrame, 'maxSpeed' | 'maxRpm'>, window?: GraphWindow): GraphWindow => {
	const full: GraphWindow = { minKmh: 0, maxKmh: frame.maxSpeed, minRpm: 0, maxRpm: frame.maxRpm };
	if (!window) {
		return full;
	}
	const minKmh = clampNum(window.minKmh, 0, frame.maxSpeed);
	const maxKmh = clampNum(window.maxKmh, minKmh, frame.maxSpeed);
	const minRpm = clampNum(window.minRpm, 0, frame.maxRpm);
	const maxRpm = clampNum(window.maxRpm, minRpm, frame.maxRpm);
	return { minKmh, maxKmh, minRpm, maxRpm };
};

/**
 * @brief Lower and upper bound of one projection axis.
 * @param frame Plot geometry and limits.
 * @param axis 'speed' for the X axis, 'rpm' for the Y axis.
 * @return Lower and upper bound in the axis unit.
 */
export const windowBounds = (frame: PlotFrame, axis: 'speed' | 'rpm'): [number, number] => {
	if (axis === 'speed') {
		return [frame.window.minKmh, frame.window.maxKmh];
	}
	return [frame.window.minRpm, frame.window.maxRpm];
};

/**
 * @brief Project a speed onto the plot X axis.
 * @param frame Plot geometry and limits.
 * @param speed Speed in display units.
 * @return X in user units.
 */
export const toX = (frame: PlotFrame, speed: number): number => {
	return frame.paddingLeft + windowFraction(speed, frame.window.minKmh, frame.window.maxKmh) * frame.plotWidth;
};

/**
 * @brief Project an engine speed onto the plot Y axis.
 * @param frame Plot geometry and limits.
 * @param rpm Engine speed in RPM.
 * @return Y in user units.
 */
export const toY = (frame: PlotFrame, rpm: number): number => {
	return frame.paddingTop + frame.plotHeight - windowFraction(rpm, frame.window.minRpm, frame.window.maxRpm) * frame.plotHeight;
};

/**
 * @brief Invert the X projection back into a speed.
 * @param frame Plot geometry and limits.
 * @param x X in user units.
 * @return Speed in display units.
 */
export const speedAtX = (frame: PlotFrame, x: number): number => {
	const fraction = frame.plotWidth > 0 ? (x - frame.paddingLeft) / frame.plotWidth : 0;
	return frame.window.minKmh + fraction * (frame.window.maxKmh - frame.window.minKmh);
};

/**
 * @brief Invert the Y projection back into an engine speed.
 * @param frame Plot geometry and limits.
 * @param y Y in user units.
 * @return Engine speed in RPM.
 */
export const rpmAtY = (frame: PlotFrame, y: number): number => {
	const fraction = frame.plotHeight > 0 ? (frame.paddingTop + frame.plotHeight - y) / frame.plotHeight : 0;
	return frame.window.minRpm + fraction * (frame.window.maxRpm - frame.window.minRpm);
};

/**
 * @brief Project a wheel power onto the secondary right-hand axis.
 * @param frame Plot geometry and limits.
 * @param kw Power in kilowatts.
 * @param maxKw Axis ceiling in kilowatts.
 * @return Y in user units, 0-safe when the ceiling is not positive.
 */
export const toPowerY = (frame: PlotFrame, kw: number, maxKw: number): number => {
	if (!Number.isFinite(maxKw) || maxKw <= 0) {
		return frame.paddingTop + frame.plotHeight;
	}
	return frame.paddingTop + frame.plotHeight - (kw / maxKw) * frame.plotHeight;
};

/**
 * @brief Clamp a value into a range, NaN-safe.
 * @param value Candidate value.
 * @param min Lower bound.
 * @param max Upper bound.
 * @return Clamped finite value.
 */
export const clampNum = (value: number, min: number, max: number): number => {
	if (!Number.isFinite(value)) {
		return min;
	}
	return Math.min(max, Math.max(min, value));
};

/**
 * @brief Check whether a projected X sits inside the drawable band.
 * @param frame Plot geometry and limits.
 * @param x X in user units.
 * @return True when the point is not clipped by the left or right inset.
 */
export const isInsidePlotX = (frame: PlotFrame, x: number): boolean => {
	return Number.isFinite(x) && x >= frame.paddingLeft && x <= frame.paddingLeft + frame.plotWidth;
};

/**
 * @brief Check that a gear redline peak is inside the drawable band.
 * @param frame Plot geometry and limits.
 * @param peak Redline peak of one gear.
 * @return True when the peak X is not clipped.
 */
export const isPeakVisible = (frame: PlotFrame, peak: PeakPoint): boolean => {
	return isInsidePlotX(frame, peak.endX);
};

/**
 * @brief Speed reached at a given engine speed in one gear.
 * @param rpm Engine speed in RPM.
 * @param gearRatio Gear ratio.
 * @param finalDrive Differential ratio.
 * @param circM Rolling circumference in metres.
 * @param unit Display unit for the returned speed.
 * @return Speed in display units.
 */
export const speedForRpm = (
	rpm: number,
	gearRatio: number,
	finalDrive: number,
	circM: number,
	unit: SpeedUnit,
): number => {
	return calculateSpeed(rpm, gearRatio, finalDrive, circM, unit);
};

/**
 * @brief Engine speed reached at a road speed in one gear.
 * @param speed Speed in display units.
 * @param gearRatio Gear ratio.
 * @param finalDrive Differential ratio.
 * @param circM Rolling circumference in metres.
 * @param unit Unit of the incoming speed.
 * @return Engine speed in RPM.
 */
export const rpmForSpeed = (
	speed: number,
	gearRatio: number,
	finalDrive: number,
	circM: number,
	unit: SpeedUnit,
): number => {
	return calculateRpm(speed, gearRatio, finalDrive, circM, unit);
};

/**
 * @brief Speed grid step of the active display unit.
 * @param unit Active display unit.
 * @return Step in display units.
 */
export const axisSpeedStep = (unit: SpeedUnit): number => {
	return getSpeedStep(unit);
};

/** Conversion between the two display units, applied at the axis boundary. */
export const KMH_PER_MPH = 1.609344;

/**
 * @brief Right edge of the X axis expressed in km/h.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @return Maximum plotted speed in km/h, the SI side of every physics call.
 */
export const maxSpeedKmh = (frame: PlotFrame, unit: SpeedUnit): number => {
	return unit === 'mph' ? frame.maxSpeed * KMH_PER_MPH : frame.maxSpeed;
};

/**
 * @brief Visible speed window expressed in km/h.
 * @brief Sampling layers work in km/h, so they convert the window once here
 * @brief instead of repeating the unit branch in every sampler.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @return Lower and upper visible speed in km/h.
 */
export const windowKmhRange = (frame: PlotFrame, unit: SpeedUnit): [number, number] => {
	if (unit === 'mph') {
		return [frame.window.minKmh * KMH_PER_MPH, frame.window.maxKmh * KMH_PER_MPH];
	}
	return [frame.window.minKmh, frame.window.maxKmh];
};
