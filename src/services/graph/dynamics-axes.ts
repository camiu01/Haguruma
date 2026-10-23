/**
 * @file dynamics-axes.ts
 * @brief Explicit physical-unit axes for force and stopping-distance SVG plots.
 */
import type { PlotFrame } from '../../core/models';
import type { GraphPalette } from './graph-theme';
import { prim, textPrim, type SvgPrim } from './svg-nodes';

/**
 * @brief Project a horizontal data coordinate in a dynamics plot.
 * @param frame Plot frame.
 * @param value X coordinate in speed units or metres.
 * @return CSS-pixel X coordinate.
 */
export const dynamicsX = (frame: PlotFrame, value: number): number => frame.paddingLeft + value / frame.maxSpeed * frame.plotWidth;

/**
 * @brief Project a vertical data coordinate in a dynamics plot.
 * @param frame Plot frame.
 * @param value Y coordinate in force or speed units.
 * @return CSS-pixel Y coordinate.
 */
export const dynamicsY = (frame: PlotFrame, value: number): number => frame.paddingTop + frame.plotHeight * (1 - value / frame.maxRpm);

/**
 * @brief Draw a ten-division grid with unit-correct tick labels and axis titles.
 * @param frame Plot geometry.
 * @param style Active theme palette.
 * @param xTitle X-axis copy.
 * @param yTitle Y-axis copy.
 * @return Grid, ticks and titles.
 */
export const dynamicsAxes = (frame: PlotFrame, style: GraphPalette, xTitle: string, yTitle: string): SvgPrim[] => {
	const nodes: SvgPrim[] = [];
	const font = { fill: style.axisText, 'font-family': 'Share Tech Mono, monospace', 'font-size': 11 };
	for (let i = 0; i <= 10; i += 1) {
		const x = dynamicsX(frame, frame.maxSpeed * i / 10);
		const y = dynamicsY(frame, frame.maxRpm * i / 10);
		nodes.push(prim('line', { x1: x, x2: x, y1: frame.paddingTop, y2: frame.paddingTop + frame.plotHeight, stroke: style.grid, 'stroke-width': 0.5 }));
		nodes.push(prim('line', { x1: frame.paddingLeft, x2: frame.paddingLeft + frame.plotWidth, y1: y, y2: y, stroke: style.grid, 'stroke-width': 0.5 }));
		nodes.push(textPrim({ ...font, x, y: frame.paddingTop + frame.plotHeight + 18, 'text-anchor': 'middle' }, (frame.maxSpeed * i / 10).toFixed(0)));
		nodes.push(textPrim({ ...font, x: frame.paddingLeft - 8, y: y + 4, 'text-anchor': 'end' }, (frame.maxRpm * i / 10).toFixed(0)));
	}
	nodes.push(textPrim({ ...font, x: frame.paddingLeft, y: 18 }, yTitle));
	nodes.push(textPrim({ ...font, x: frame.width / 2, y: frame.height - 8, 'text-anchor': 'middle' }, xTitle));
	return nodes;
};
