/**
 * @file svg-limits.ts
 * @brief Grip ceiling, first-gear wheelspin shading and the aero wall.
 *
 * Physics comes from the shared math modules; this file only projects those
 * numbers onto the plot and returns primitives. The power envelope lives in
 * `svg-power.ts`.
 */
import { GRAPH_DEFS } from './svg-defs';
import { GRAPH_STROKE, graphFontSize } from '../../config/graph-constants';
import { fromDisplaySpeed, toDisplaySpeed } from '../../core/math/speed-math';
import { getUnitLabel } from '../../core/units/unit-utils';
import { t } from '../../core/i18n/language';
import type { PlotFrame, SpeedUnit } from '../../core/models';
import type { GraphPalette } from './graph-theme';
import { toX, toY, windowKmhRange } from './svg-frame';
import { polyline, prim, textPrim, type SvgPrim } from './svg-nodes';

/** Label font stack shared with the rest of the interface. */
const FONT = 'Share Tech Mono, monospace';

/** One sample of a force-versus-speed limit curve. */
export interface LimitSample {
	/** Vehicle speed in km/h. */
	vKmh: number;
	/** Limit force in newtons. */
	limitN: number;
}

/** Horizontal span of a shaded band in user units. */
export interface XBand {
	/** Left edge in user units. */
	x0: number;
	/** Right edge in user units. */
	x1: number;
}

/**
 * @brief Sample a force limit across the visible speed range.
 * @brief Sampling follows the zoom window, so a zoomed plot keeps its full
 * @brief resolution instead of stretching a full-axis sample set.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param limitFn Limit force in newtons from speed in km/h.
 * @param stepKmh Sampling step in km/h.
 * @return Samples across the visible X range.
 */
export const buildForceSamples = (
	frame: PlotFrame,
	unit: SpeedUnit,
	limitFn: (vKmh: number) => number,
	stepKmh: number = 4,
): LimitSample[] => {
	const samples: LimitSample[] = [];
	const [fromKmh, toKmh] = windowKmhRange(frame, unit);
	if (!(toKmh > fromKmh)) {
		return samples;
	}
	for (let v = fromKmh; v <= toKmh + 1e-6; v += stepKmh) {
		const limitN = limitFn(v);
		samples.push({ vKmh: v, limitN: Number.isFinite(limitN) ? limitN : 0 });
	}
	const tail = limitFn(toKmh);
	samples.push({ vKmh: toKmh, limitN: Number.isFinite(tail) ? tail : 0 });
	return samples;
};

/**
 * @brief Peak of a limit curve across the whole axis, not the visible window.
 * @brief The grip layer is scaled by this peak, so it must not follow the zoom:
 * @brief a peak read from the visible window drops as soon as the plot zooms
 * @brief into a slower band, which silently lifts the curve on screen. The axis
 * @brief peak keeps the curve anchored to the engine-speed scale under every
 * @brief zoom and pan.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param limitFn Limit force in newtons from speed in km/h.
 * @param samples Scan resolution across the axis, defaults to 160 points.
 * @return Largest finite limit on the axis, 1 when nothing positive was found.
 */
export const axisLimitPeak = (frame: PlotFrame, unit: SpeedUnit, limitFn: (vKmh: number) => number, samples = 160): number => {
	const maxKmh = fromDisplaySpeed(frame.maxSpeed, unit);
	const step = maxKmh > 0 && samples > 0 ? maxKmh / samples : 0;
	let peak = 1;
	for (let index = 0; step > 0 && index <= samples; index += 1) {
		const limitN = limitFn(index * step);
		if (Number.isFinite(limitN) && limitN > peak) {
			peak = limitN;
		}
	}
	return peak;
};

/**
 * @brief Build the dashed grip-limit curve and its tag.
 * @brief The curve is projected through `toY` like every other engine-speed
 * @brief layer, so it keeps its physical height and stays anchored to the RPM
 * @brief axis when the plot is zoomed or panned.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param samples Limit samples.
 * @param peakN Vertical scale in newtons, normally `axisLimitPeak(frame, unit, limitFn)`.
 * @param color Stroke color for this curve.
 * @param tagged True to label the curve with the grip tag.
 * @return Polyline and label primitives, empty when nothing can be drawn.
 */
export const buildGripNodes = (
	frame: PlotFrame,
	unit: SpeedUnit,
	samples: LimitSample[],
	peakN: number,
	color: string,
	tagged: boolean,
): SvgPrim[] => {
	if (samples.length < 2 || !(peakN > 0)) {
		return [];
	}
	const points = samples.map((sample) => ({
		x: toX(frame, toDisplaySpeed(sample.vKmh, unit)),
		y: gripCurveY(frame, sample.limitN, peakN),
	}));
	const nodes: SvgPrim[] = [
		polyline(points, { stroke: color, 'stroke-width': GRAPH_STROKE.limit, 'stroke-dasharray': '9 7', 'stroke-opacity': 0.9 }),
	];
	if (tagged) {
		const last = points[points.length - 1];
		nodes.push(
			textPrim(
				{ x: last.x - 8, y: last.y - 10, fill: color, 'font-size': graphFontSize(frame.width, 'callout'), 'font-family': FONT, 'text-anchor': 'end' },
				t('graph.gripTag'),
			),
		);
	}
	return nodes;
};

/**
 * @brief Map a limit force onto the engine-speed axis.
 * @brief The force ceiling maps to the full RPM axis before the viewport
 * @brief projection, preserving its position during zoom and pan.
 * @param frame Plot geometry and limits.
 * @param limitN Limit force in newtons.
 * @param peakN Vertical scale in newtons.
 * @return Y in user units.
 */
export const gripCurveY = (frame: PlotFrame, limitN: number, peakN: number): number => {
	if (!(peakN > 0) || !(frame.maxRpm > 0)) {
		return frame.paddingTop + frame.plotHeight;
	}
	const rpm = (Math.max(0, limitN) / peakN) * frame.maxRpm;
	return toY(frame, rpm);
};

/**
 * @brief Find the speed bands where engine force exceeds the grip ceiling.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param gripFn Grip limit in newtons from speed in km/h.
 * @param forceFn Engine force in newtons from speed in km/h.
 * @param stepKmh Scan step in km/h.
 * @return Merged shaded bands in user units.
 */
export const spinBands = (
	frame: PlotFrame,
	unit: SpeedUnit,
	gripFn: (vKmh: number) => number,
	forceFn: (vKmh: number) => number,
	stepKmh: number = 2,
): XBand[] => {
	const bands: XBand[] = [];
	const [fromKmh, top] = windowKmhRange(frame, unit);
	if (!(top > fromKmh)) {
		return bands;
	}
	let start: number | null = null;
	for (let v = fromKmh; v <= top + 1e-6; v += stepKmh) {
		const spinning = forceFn(v) > gripFn(v);
		if (spinning && start === null) {
			start = v;
		}
		if (!spinning && start !== null) {
			bands.push({ x0: toX(frame, toDisplaySpeed(start, unit)), x1: toX(frame, toDisplaySpeed(v, unit)) });
			start = null;
		}
	}
	if (start !== null) {
		bands.push({ x0: toX(frame, toDisplaySpeed(start, unit)), x1: toX(frame, toDisplaySpeed(top, unit)) });
	}
	return bands;
};

/**
 * @brief Build the wheelspin shading of the launch band.
 * @param frame Plot geometry and limits.
 * @param bands Bands from `spinBands`.
 * @return Hatched rectangles covering each band.
 */
export const buildSpinNodes = (frame: PlotFrame, bands: XBand[]): SvgPrim[] => {
	return bands.map((band) =>
		prim('rect', {
			x: band.x0,
			y: frame.paddingTop,
			width: Math.max(0.5, band.x1 - band.x0),
			height: frame.plotHeight,
			fill: `url(#${GRAPH_DEFS.spinHatch})`,
		}),
	);
};

/**
 * @brief Build the aero-wall shading, marker line and callout.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param style Active theme palette.
 * @param speedDisplay Drag-limited speed in display units.
 * @param color Line and callout color (cyan primary, amber comparison).
 * @param tagged True for the primary wall, false for the comparison wall.
 * @return Shading, line and label primitives.
 */
export const buildWallNodes = (
	frame: PlotFrame,
	unit: SpeedUnit,
	style: GraphPalette,
	speedDisplay: number,
	color: string,
	tagged: boolean,
): SvgPrim[] => {
	const x = toX(frame, speedDisplay);
	const right = frame.paddingLeft + frame.plotWidth;
	const width = Math.max(0, right - x);
	const name = tagged ? t('graph.aeroTag') : `${t('legend.compare')} ${t('graph.aeroTag')}`;
	return [
		prim('rect', { x, y: frame.paddingTop, width, height: frame.plotHeight, fill: style.aeroFill }),
		prim('rect', { x, y: frame.paddingTop, width, height: frame.plotHeight, fill: `url(#${GRAPH_DEFS.aeroHatch})` }),
		prim('line', {
			x1: x,
			y1: frame.paddingTop,
			x2: x,
			y2: frame.paddingTop + frame.plotHeight,
			stroke: color,
			'stroke-width': GRAPH_STROKE.wall,
			'stroke-dasharray': '9 6',
		}),
		textPrim(
			{ x: x + 8, y: frame.paddingTop + 16, fill: color, 'font-size': graphFontSize(frame.width, 'callout'), 'font-family': FONT, 'text-anchor': 'start' },
			`${name} ${Math.round(speedDisplay)} ${getUnitLabel(unit)}`,
		),
		textPrim(
			{
				x: x + 8,
				y: frame.paddingTop + 32,
				fill: color,
				'font-size': graphFontSize(frame.width, 'callout'),
				'font-family': FONT,
				'text-anchor': 'start',
				'fill-opacity': 0.8,
			},
			t('table.dragLimited'),
		),
	];
};
