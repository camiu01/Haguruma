/**
 * @file svg-axes.ts
 * @brief Plot background, grids, axis ticks, titles and redline band.
 *
 * All geometry is returned as primitives in viewBox user units; the renderer
 * mounts them in the documented layer order.
 */
import { GRAPH_LIMITS, GRAPH_STROKE, graphFontSize } from '../../config/graph-constants';
import { getUnitLabel, getPowerUnitLabel, toDisplayPower } from '../../core/units/unit-utils';
import { t } from '../../core/i18n/language';
import type { PlotFrame, PowerUnit, SpeedUnit } from '../../core/models';
import type { GraphPalette } from './graph-theme';
import { prim, textPrim, type SvgPrim } from './svg-nodes';
import { axisSpeedStep, KMH_PER_MPH, toPowerY, toX, toY } from './svg-frame';

/** Label font stack shared with the rest of the interface. */
const FONT = 'Share Tech Mono, monospace';

/**
 * @brief Tick steps offered for the speed axis, smallest first.
 * @brief The steps double as the readable ladder of the display unit, so the
 * @brief labels always land on round numbers.
 */
const SPEED_STEPS_KMH = [5, 10, 25, 50, 100, 200, 500] as const;

/** Tick steps offered for the engine-speed axis, smallest first. */
const RPM_STEPS = [250, 500, 1000, 2000, 5000] as const;

/** Fewest ticks a visible span may carry before the step is refined. */
const TICKS_MIN = 4;

/**
 * @brief Pick a tick step that keeps the visible span labelled.
 * @brief The unit's own step is authoritative and is returned unchanged as
 * @brief long as it still leaves a readable grid, so the unzoomed plot is
 * @brief exactly as before. Only a zoom window too narrow for that step falls
 * @brief back to the coarsest finer step that still yields `TICKS_MIN` ticks.
 * @param span Visible span in axis units.
 * @param candidates Readable steps of that axis, smallest first.
 * @param preferred Step used when it already fits the span.
 * @return Step in axis units.
 */
const adaptiveStep = (span: number, candidates: readonly number[], preferred: number): number => {
	if (!(span > 0) || span / preferred >= TICKS_MIN) {
		return preferred;
	}
	const ceiling = span / TICKS_MIN;
	let best: number | null = null;
	for (const step of candidates) {
		if (step >= preferred) {
			break;
		}
		if (step <= ceiling) {
			best = step;
		}
	}
	return best ?? candidates[0];
};

/**
 * @brief Speed tick step for the visible span of the active unit.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @return Step in display units.
 */
const speedStepFor = (frame: PlotFrame, unit: SpeedUnit): number => {
	const span = frame.window.maxKmh - frame.window.minKmh;
	const preferred = axisSpeedStep(unit);
	const scale = unit === 'mph' ? KMH_PER_MPH : 1;
	const candidates = SPEED_STEPS_KMH.map((step) => step / scale);
	return adaptiveStep(span, candidates, preferred);
};

/**
 * @brief RPM tick step for the visible span.
 * @param frame Plot geometry and limits.
 * @return Step in RPM.
 */
const rpmStepFor = (frame: PlotFrame): number => {
	return adaptiveStep(frame.window.maxRpm - frame.window.minRpm, RPM_STEPS, GRAPH_LIMITS.rpmStep);
};

/**
 * @brief List every multiple of a step inside a visible range.
 * @brief Used by the grid and the tick labels so both always agree with the
 * @brief zoom window instead of the full axis.
 * @param min Lower bound of the visible range in axis units.
 * @param max Upper bound of the visible range in axis units.
 * @param step Distance between two ticks in axis units.
 * @return Ascending multiples of `step` inside the range, empty when unusable.
 */
const visibleSteps = (min: number, max: number, step: number): number[] => {
	if (!(step > 0) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
		return [];
	}
	const values: number[] = [];
	const first = Math.ceil(min / step - 1e-9) * step;
	for (let value = first; value <= max + 1e-9; value += step) {
		values.push(Math.round(value * 1000) / 1000);
	}
	return values;
};

/**
 * @brief Format one speed tick without trailing decimals.
 * @param value Tick value in display units.
 * @return Integer text, or one decimal when the zoom window needs it.
 */
const formatTick = (value: number): string => {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

/**
 * @brief Build the plot background plate.
 * @param frame Plot geometry and limits.
 * @param style Active theme palette.
 * @return Background rectangle primitive.
 */
export const buildBackground = (frame: PlotFrame, style: GraphPalette): SvgPrim[] => {
	return [prim('rect', { x: 0, y: 0, width: frame.width, height: frame.height, fill: style.background })];
};

/**
 * @brief Build the fine 10-unit background texture as a single path.
 * @param frame Plot geometry and limits.
 * @param style Active theme palette.
 * @return One path primitive, empty when the plot has no drawable area.
 */
const buildFineGrid = (frame: PlotFrame, style: GraphPalette): SvgPrim[] => {
	if (frame.plotWidth <= 0 || frame.plotHeight <= 0) {
		return [];
	}
	const bottom = frame.paddingTop + frame.plotHeight;
	const right = frame.paddingLeft + frame.plotWidth;
	const parts: string[] = [];
	for (let x = frame.paddingLeft; x <= right; x += GRAPH_LIMITS.fineGridStep) {
		parts.push(`M${Math.round(x)} ${frame.paddingTop}V${Math.round(bottom)}`);
	}
	for (let y = frame.paddingTop; y <= bottom; y += GRAPH_LIMITS.fineGridStep) {
		parts.push(`M${frame.paddingLeft} ${Math.round(y)}H${Math.round(right)}`);
	}
	return [
		prim('path', {
			d: parts.join(''),
			fill: 'none',
			stroke: style.gridFine,
			'stroke-width': GRAPH_STROKE.fineGrid,
		}),
	];
};

/**
 * @brief Build the coarse grid lines and the axis baselines.
 * @brief Ticks follow the visible window, so a zoomed plot keeps a labelled
 * @brief grid instead of the coarse full-axis one.
 * @param frame Plot geometry and limits.
 * @param style Active theme palette.
 * @param unit Active display unit, sets the speed step.
 * @param fine True to add the dense background texture underneath.
 * @return Grid primitives, fine texture first so ticks stay on top.
 */
export const buildGrid = (frame: PlotFrame, style: GraphPalette, unit: SpeedUnit, fine: boolean): SvgPrim[] => {
	const nodes: SvgPrim[] = fine ? buildFineGrid(frame, style) : [];
	const bottom = frame.paddingTop + frame.plotHeight;
	const right = frame.paddingLeft + frame.plotWidth;
	for (const s of visibleSteps(frame.window.minKmh, frame.window.maxKmh, speedStepFor(frame, unit))) {
		const x = toX(frame, s);
		nodes.push(prim('line', { x1: x, y1: frame.paddingTop, x2: x, y2: bottom, stroke: style.grid, 'stroke-width': GRAPH_STROKE.grid }));
	}
	for (const r of visibleSteps(frame.window.minRpm, frame.window.maxRpm, rpmStepFor(frame))) {
		const y = toY(frame, r);
		nodes.push(prim('line', { x1: frame.paddingLeft, y1: y, x2: right, y2: y, stroke: style.grid, 'stroke-width': GRAPH_STROKE.grid }));
	}
	nodes.push(prim('line', { x1: frame.paddingLeft, y1: frame.paddingTop, x2: frame.paddingLeft, y2: bottom, stroke: style.axisText, 'stroke-width': GRAPH_STROKE.axis, 'stroke-opacity': 0.6 }));
	nodes.push(prim('line', { x1: frame.paddingLeft, y1: bottom, x2: right, y2: bottom, stroke: style.axisText, 'stroke-width': GRAPH_STROKE.axis, 'stroke-opacity': 0.6 }));
	return nodes;
};

/**
 * @brief Build the speed tick labels under the plot.
 * @param frame Plot geometry and limits.
 * @param style Active theme palette.
 * @param unit Active display unit.
 * @return One text primitive per visible speed tick.
 */
export const buildSpeedTicks = (frame: PlotFrame, style: GraphPalette, unit: SpeedUnit): SvgPrim[] => {
	const nodes: SvgPrim[] = [];
	const axisFont = graphFontSize(frame.width, 'axis');
	const y = frame.paddingTop + frame.plotHeight + axisFont + 8;
	for (const s of visibleSteps(frame.window.minKmh, frame.window.maxKmh, speedStepFor(frame, unit))) {
		nodes.push(textPrim({ x: toX(frame, s), y, fill: style.axisText, 'font-size': axisFont, 'font-family': FONT, 'text-anchor': 'middle' }, formatTick(s)));
	}
	return nodes;
};

/**
 * @brief Build the RPM tick labels left of the plot.
 * @param frame Plot geometry and limits.
 * @param style Active theme palette.
 * @return One text primitive per visible RPM tick.
 */
export const buildRpmTicks = (frame: PlotFrame, style: GraphPalette): SvgPrim[] => {
	const nodes: SvgPrim[] = [];
	for (const r of visibleSteps(frame.window.minRpm, frame.window.maxRpm, rpmStepFor(frame))) {
		nodes.push(
			textPrim(
				{
					x: frame.paddingLeft - 10,
					y: toY(frame, r),
					fill: style.axisText,
					'font-size': graphFontSize(frame.width, 'axis'),
					'font-family': FONT,
					'text-anchor': 'end',
					'dominant-baseline': 'middle',
				},
				String(r),
			),
		);
	}
	return nodes;
};

/**
 * @brief Build the axis titles, including the optional power axis.
 * @param frame Plot geometry and limits.
 * @param style Active theme palette.
 * @param unit Active display unit.
 * @param powerUnit Power unit, or null to omit the right-hand axis title.
 * @return Text primitives for every visible axis.
 */
export const buildAxisTitles = (
	frame: PlotFrame,
	style: GraphPalette,
	unit: SpeedUnit,
	powerUnit: PowerUnit | null,
): SvgPrim[] => {
	const midX = frame.paddingLeft + frame.plotWidth / 2;
	const midY = frame.paddingTop + frame.plotHeight / 2;
	const nodes: SvgPrim[] = [
		textPrim(
			{ x: midX, y: frame.height - 8, fill: style.axisText, 'font-size': graphFontSize(frame.width, 'title'), 'font-family': FONT, 'text-anchor': 'middle' },
			`${t('graph.axisSpeed')} (${getUnitLabel(unit)})`,
		),
		textPrim(
			{
				x: 14,
				y: midY,
				fill: style.axisText,
				'font-size': graphFontSize(frame.width, 'title'),
				'font-family': FONT,
				'text-anchor': 'middle',
				transform: `rotate(-90 14 ${midY})`,
			},
			t('graph.axisRpm'),
		),
	];
	if (!powerUnit) {
		return nodes;
	}
	const axisX = frame.width - 12;
	nodes.push(
		textPrim(
			{
				x: axisX,
				y: midY,
				fill: style.power,
				'font-size': graphFontSize(frame.width, 'callout'),
				'font-family': FONT,
				'text-anchor': 'middle',
				transform: `rotate(90 ${axisX} ${midY})`,
			},
			`${t('graph.axisPower')} (${getPowerUnitLabel(powerUnit)})`,
		),
	);
	return nodes;
};

/**
 * @brief Build the over-rev band, its dashed limiter line and the limit tag.
 * @param frame Plot geometry and limits.
 * @param style Active theme palette.
 * @param redline Rev limiter in RPM.
 * @return Redline primitives.
 */
export const buildRedlineBand = (frame: PlotFrame, style: GraphPalette, redline: number): SvgPrim[] => {
	const y = toY(frame, redline);
	const height = Math.max(0, y - frame.paddingTop);
	const tag = `${t('graph.redlineTag')} ${redline} RPM`;
	return [
		prim('rect', { x: frame.paddingLeft, y: frame.paddingTop, width: frame.plotWidth, height, fill: style.redlineFill }),
		prim('line', {
			x1: frame.paddingLeft,
			y1: y,
			x2: frame.paddingLeft + frame.plotWidth,
			y2: y,
			stroke: style.redlineLine,
			'stroke-width': GRAPH_STROKE.axis,
			'stroke-dasharray': '8 6',
		}),
		textPrim(
			{
				x: frame.paddingLeft + frame.plotWidth - 8,
				y: y - 8,
				fill: style.redlineLine,
				'font-size': graphFontSize(frame.width, 'callout'),
				'font-family': FONT,
				'text-anchor': 'end',
			},
			tag,
		),
	];
};

/**
 * @brief Build the secondary limiter line when it differs from the primary.
 * @param frame Plot geometry and limits.
 * @param style Active theme palette.
 * @param redline Secondary rev limiter in RPM.
 * @return Redline primitives for the comparison overlay.
 */
export const buildCompareRedline = (frame: PlotFrame, style: GraphPalette, redline: number): SvgPrim[] => {
	const y = toY(frame, redline);
	return [
		prim('line', {
			x1: frame.paddingLeft,
			y1: y,
			x2: frame.paddingLeft + frame.plotWidth,
			y2: y,
			stroke: style.compare,
			'stroke-width': GRAPH_STROKE.grid,
			'stroke-dasharray': '5 5',
			'stroke-opacity': 0.8,
		}),
		textPrim(
			{
				x: frame.paddingLeft + frame.plotWidth - 8,
				y: y + graphFontSize(frame.width, 'callout') + 2,
				fill: style.compare,
				'font-size': graphFontSize(frame.width, 'callout'),
				'font-family': FONT,
				'text-anchor': 'end',
			},
			`${t('graph.redlineTag')} ${redline} RPM`,
		),
	];
};

/**
 * @brief Pick a readable power-axis step for a ceiling.
 * @param maxKw Axis ceiling in kilowatts.
 * @return Step in kilowatts, 25 for the usual 75-150 kW range.
 */
const powerStepFor = (maxKw: number): number => {
	if (maxKw <= 40) {
		return 10;
	}
	if (maxKw <= 160) {
		return 25;
	}
	return 50;
};

/**
 * @brief Build the right-hand wheel-power axis for the envelope layer.
 * @brief The axis lives in the right inset, so it is mounted outside the plot
 * @brief clip: the plot clip would cut every tick and label away.
 * @param frame Plot geometry and limits.
 * @param style Active theme palette.
 * @param maxKw Axis ceiling in kilowatts.
 * @param unit Active power display unit.
 * @return Baseline, tick marks and labels (the title lives in `buildAxisTitles`).
 */
export const buildPowerAxis = (frame: PlotFrame, style: GraphPalette, maxKw: number, unit: PowerUnit): SvgPrim[] => {
	const axisX = frame.paddingLeft + frame.plotWidth;
	const bottom = frame.paddingTop + frame.plotHeight;
	const nodes: SvgPrim[] = [
		prim('line', {
			x1: axisX,
			y1: frame.paddingTop,
			x2: axisX,
			y2: bottom,
			stroke: style.power,
			'stroke-width': GRAPH_STROKE.axis,
			'stroke-opacity': 0.55,
		}),
	];
	const step = powerStepFor(maxKw);
	for (let kw = step; kw <= maxKw + 1e-6; kw += step) {
		const y = toPowerY(frame, kw, maxKw);
		nodes.push(prim('line', { x1: axisX, y1: y, x2: axisX + 5, y2: y, stroke: style.power, 'stroke-width': GRAPH_STROKE.grid, 'stroke-opacity': 0.7 }));
		nodes.push(
			textPrim(
				{
					x: axisX + 9,
					y,
					fill: style.power,
					'font-size': graphFontSize(frame.width, 'callout'),
					'font-family': FONT,
					'text-anchor': 'start',
					'dominant-baseline': 'middle',
					'fill-opacity': 0.85,
				},
				unit === 'cv' ? String(Math.round(toDisplayPower(kw, unit))) : String(Math.round(kw)),
			),
		);
	}
	return nodes;
};
