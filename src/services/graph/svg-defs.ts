/**
 * @file svg-defs.ts
 * @brief Reusable SVG paint servers (hatch patterns and gradient fills).
 *
 * The patterns carry the aero-wall and wheelspin hatching; the gradient fills
 * the power-envelope area. Ids are frozen here so layers can reference them
 * without sharing markup state.
 */
import type { PlotFrame } from '../../core/models';
import type { GraphPalette } from './graph-theme';
import { prim, type SvgPrim } from './svg-nodes';

/** Paint-server ids referenced by `url(#…)` from the layers. */
export const GRAPH_DEFS = {
	/** Diagonal hatch used for the unreachable region past the aero wall. */
	aeroHatch: 'hg-aero-hatch',
	/** Diagonal hatch used for the first-gear wheelspin band. */
	spinHatch: 'hg-spin-hatch',
	/** Vertical gradient under the available wheel-power envelope. */
	powerFill: 'hg-power-fill',
	/** Clip keeping every data layer inside the drawable band. */
	plotClip: 'hg-plot-clip',
} as const;

/**
 * @brief Build the clip path holding the drawable band.
 * @param frame Plot geometry and limits.
 * @return Clip-path primitive matching the plot rectangle.
 */
const plotClip = (frame: PlotFrame): SvgPrim => {
	return {
		tag: 'clipPath',
		attrs: { id: GRAPH_DEFS.plotClip },
		children: [
			prim('rect', {
				x: frame.paddingLeft,
				y: frame.paddingTop,
				width: frame.plotWidth,
				height: frame.plotHeight,
			}),
		],
	};
};

/** Diagonal line spacing of the hatch patterns in user units. */
const HATCH_PITCH = 9;

/**
 * @brief Build one diagonal hatch pattern.
 * @param id Pattern id.
 * @param color Stroke color of the hatch lines.
 * @param opacity Stroke opacity, keeps the hatch behind the curves.
 * @return Pattern primitive with two diagonal strokes per tile.
 */
const hatchPattern = (id: string, color: string, opacity: number): SvgPrim => {
	return {
		tag: 'pattern',
		attrs: {
			id,
			width: HATCH_PITCH,
			height: HATCH_PITCH,
			patternUnits: 'userSpaceOnUse',
			patternTransform: 'rotate(45)',
		},
		children: [
			prim('line', {
				x1: 0,
				y1: 0,
				x2: 0,
				y2: HATCH_PITCH,
				stroke: color,
				'stroke-width': 1,
				'stroke-opacity': opacity,
			}),
			prim('line', {
				x1: HATCH_PITCH / 2,
				y1: 0,
				x2: HATCH_PITCH / 2,
				y2: HATCH_PITCH,
				stroke: color,
				'stroke-width': 1,
				'stroke-opacity': opacity,
			}),
		],
	};
};

/**
 * @brief Build the shared `<defs>` block for the plot.
 * @param style Active theme palette.
 * @param frame Plot geometry, used by the clip path.
 * @return Single defs primitive holding the clip, both patterns and the gradient.
 */
export const buildDefs = (style: GraphPalette, frame: PlotFrame): SvgPrim[] => {
	return [
		{
			tag: 'defs',
			children: [
				plotClip(frame),
				hatchPattern(GRAPH_DEFS.aeroHatch, style.aero, 0.35),
				hatchPattern(GRAPH_DEFS.spinHatch, style.gripCompare, 0.4),
				{
					tag: 'linearGradient',
					attrs: { id: GRAPH_DEFS.powerFill, x1: 0, y1: 0, x2: 0, y2: 1 },
					children: [
						prim('stop', { offset: '0%', 'stop-color': style.power, 'stop-opacity': 0.28 }),
						prim('stop', { offset: '100%', 'stop-color': style.power, 'stop-opacity': 0 }),
					],
				},
			],
		},
	];
};
