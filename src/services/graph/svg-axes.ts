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
import { axisSpeedStep, toPowerY, toX, toY } from './svg-frame';

/** Label font stack shared with the rest of the interface. */
const FONT = 'Share Tech Mono, monospace';

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
	for (let s = 0; s <= frame.maxSpeed; s += axisSpeedStep(unit)) {
		const x = toX(frame, s);
		nodes.push(prim('line', { x1: x, y1: frame.paddingTop, x2: x, y2: bottom, stroke: style.grid, 'stroke-width': GRAPH_STROKE.grid }));
	}
	for (let r = 0; r <= frame.maxRpm; r += GRAPH_LIMITS.rpmStep) {
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
 * @return One text primitive per speed tick.
 */
export const buildSpeedTicks = (frame: PlotFrame, style: GraphPalette, unit: SpeedUnit): SvgPrim[] => {
	const nodes: SvgPrim[] = [];
	const axisFont = graphFontSize(frame.width, 'axis');
	const y = frame.paddingTop + frame.plotHeight + axisFont + 8;
	for (let s = 0; s <= frame.maxSpeed; s += axisSpeedStep(unit)) {
		nodes.push(textPrim({ x: toX(frame, s), y, fill: style.axisText, 'font-size': axisFont, 'font-family': FONT, 'text-anchor': 'middle' }, String(s)));
	}
	return nodes;
};

/**
 * @brief Build the RPM tick labels left of the plot.
 * @param frame Plot geometry and limits.
 * @param style Active theme palette.
 * @return One text primitive per RPM tick.
 */
export const buildRpmTicks = (frame: PlotFrame, style: GraphPalette): SvgPrim[] => {
	const nodes: SvgPrim[] = [];
	for (let r = GRAPH_LIMITS.rpmStep; r <= frame.maxRpm; r += GRAPH_LIMITS.rpmStep) {
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
