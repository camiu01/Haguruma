/**
 * @file canvas-setup.ts
 * @brief HiDPI canvas scaling and linear coordinate mapping.
 */
import { GRAPH_PADDING } from '../../config/graph-constants';
import type { PlotFrame } from '../../core/models';

/**
 * Enable crisp rendering on HiDPI displays.
 * @brief Scale the backing store by devicePixelRatio, capped for perf.
 * @param canvas Target canvas element.
 * @param ctx Rendering context to rescale.
 * @return False when the layout size did not change.
 */
export const resizeCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean => {
	const rect = canvas.getBoundingClientRect();
	const rawDpr = window.devicePixelRatio || 1;
	const dpr = Math.min(rawDpr, 2);
	const nextW = Math.round(rect.width * dpr);
	const nextH = Math.round(rect.height * dpr);
	if (nextW <= 0 || nextH <= 0) {
		return false;
	}
	if (canvas.width === nextW && canvas.height === nextH) {
		return false;
	}
	canvas.width = nextW;
	canvas.height = nextH;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	return true;
};

/**
 * Watch the canvas box and redraw on resize.
 * @brief ResizeObserver helper so callers stay declarative.
 * @param canvas Target canvas element.
 * @param ctx Rendering context to rescale.
 * @param onResize Redraw callback after a real size change.
 * @return Disconnect callback for the observer.
 */
export const observeCanvasResize = (
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D,
	onResize: () => void,
): (() => void) => {
	const observer = new ResizeObserver(() => {
		if (resizeCanvas(canvas, ctx)) {
			onResize();
		}
	});
	observer.observe(canvas);
	return () => observer.disconnect();
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
