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
import { toDisplaySpeed } from '../../core/math/speed-math';
import { getUnitLabel } from '../../core/units/unit-utils';
import { t } from '../../core/i18n/language';
import type { PlotFrame, SpeedUnit } from '../../core/models';
import type { GraphPalette } from './graph-theme';
import { maxSpeedKmh, toX } from './svg-frame';
import { polyline, prim, textPrim, type SvgPrim } from './svg-nodes';

/** Label font stack shared with the rest of the interface. */
const FONT = 'JetBrains Mono, monospace';

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
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param limitFn Limit force in newtons from speed in km/h.
 * @param stepKmh Sampling step in km/h.
 * @return Samples across the X axis.
 */
export const buildForceSamples = (
	frame: PlotFrame,
	unit: SpeedUnit,
	limitFn: (vKmh: number) => number,
	stepKmh: number = 4,
): LimitSample[] => {
	const samples: LimitSample[] = [];
	const top = maxSpeedKmh(frame, unit);
	for (let v = 0; v <= top + 1e-6; v += stepKmh) {
		const limitN = limitFn(v);
		samples.push({ vKmh: v, limitN: Number.isFinite(limitN) ? limitN : 0 });
	}
	return samples;
};

/**
 * @brief Peak of a sampled limit curve, used as the vertical scale.
 * @param samples Samples from `buildForceSamples`.
 * @return Largest positive limit, 1 when nothing positive was sampled.
 */
export const samplePeak = (samples: LimitSample[]): number => {
	let peak = 1;
	for (const sample of samples) {
		if (sample.limitN > peak) {
			peak = sample.limitN;
		}
	}
	return peak;
};

/**
 * @brief Build the dashed grip-limit curve and its tag.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param samples Limit samples.
 * @param peakN Vertical scale, normally `samplePeak(samples)`.
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
		y: frame.paddingTop + frame.plotHeight - (Math.max(0, sample.limitN) / peakN) * frame.plotHeight,
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
	const top = maxSpeedKmh(frame, unit);
	let start: number | null = null;
	for (let v = 0; v <= top + 1e-6; v += stepKmh) {
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
