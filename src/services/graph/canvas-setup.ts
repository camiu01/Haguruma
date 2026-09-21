/**
 * @file canvas-setup.ts
 * @brief HiDPI canvas scaling and linear coordinate mapping.
 */
import { GRAPH_PADDING } from '../../config/graph-constants';
import type { PlotFrame } from '../../core/models';

/**
 * Enable crisp rendering on HiDPI displays.
 * @brief Scale the backing store by devicePixelRatio.
 * @param canvas Target canvas element.
 * @param ctx Rendering context to rescale.
 * @returns void
 */
export const resizeCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void => {
	const rect = canvas.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

/**
 * Build the plot frame from current canvas size.
 * @purpose Share coordinate mapping between axes, curves and tooltip.
 * @param canvas Target canvas.
 * @param maxSpeed Right edge of the X axis.
 * @param maxRpm Top edge of the Y axis.
 * @returns Plot dimensions and data limits.
 */
export const buildPlotFrame = (
	canvas: HTMLCanvasElement,
	maxSpeed: number,
	maxRpm: number,
): PlotFrame | null => {
	const rect = canvas.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) {
		return null;
	}
	const plotWidth = rect.width - GRAPH_PADDING.left - GRAPH_PADDING.right;
	const plotHeight = rect.height - GRAPH_PADDING.top - GRAPH_PADDING.bottom;
	return {
		width: rect.width,
		height: rect.height,
		paddingTop: GRAPH_PADDING.top,
		paddingRight: GRAPH_PADDING.right,
		paddingBottom: GRAPH_PADDING.bottom,
		paddingLeft: GRAPH_PADDING.left,
		plotWidth,
		plotHeight,
		maxSpeed,
		maxRpm,
	};
};

/**
 * Map vehicle speed to a canvas X coordinate.
 * @brief Linear projection of the X axis.
 * @param frame Plot geometry and limits.
 * @param speed Vehicle speed in display units.
 * @returns Canvas X in CSS pixels.
 */
export const toX = (frame: PlotFrame, speed: number): number => {
	return frame.paddingLeft + (speed / frame.maxSpeed) * frame.plotWidth;
};

/**
 * Map engine RPM to a canvas Y coordinate.
 * @brief Linear projection of the Y axis.
 * @param frame Plot geometry and limits.
 * @param rpm Engine speed in RPM.
 * @returns Canvas Y in CSS pixels.
 */
export const toY = (frame: PlotFrame, rpm: number): number => {
	return frame.paddingTop + frame.plotHeight - (rpm / frame.maxRpm) * frame.plotHeight;
};
