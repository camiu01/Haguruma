/**
 * @file graph-axes.ts
 * @brief Plot background, grids, redline band and axis titles.
 */
import { GRAPH_LIMITS } from '../../config/graph-constants';
import { getGraphStyle } from './graph-theme';
import { toDisplaySpeed } from '../../core/math/speed-math';
import { getSpeedStep } from '../../core/units/unit-utils';
import type { PlotFrame, SpeedUnit } from '../../core/models';
import { alignPixel, toX, toY } from './canvas-setup';
/**
 * Draw the dark plot background.
 * @brief Reset the frame before every render.
 */
export const drawBackground = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
): void => {
	ctx.clearRect(0, 0, frame.width, frame.height);
	ctx.fillStyle = getGraphStyle().background;
	ctx.fillRect(0, 0, frame.width, frame.height);
};

/**
 * Draw vertical speed grid lines.
 * @brief Show kmh/mph reference ticks.
 */
export const drawSpeedGrid = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	unit: SpeedUnit,
): void => {
	const step = getSpeedStep(unit);
	const dpr = ctx.getTransform().a || 1;
	ctx.lineWidth = 1 / dpr;
	ctx.strokeStyle = getGraphStyle().grid;
	ctx.fillStyle = getGraphStyle().axisText;
	ctx.font = '10px \'JetBrains Mono\', monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	for (let s = Math.ceil((frame.minSpeed ?? 0) / step) * step; s <= frame.maxSpeed; s += step) {
		const x = alignPixel(toX(frame, s), dpr);
		ctx.beginPath();
		ctx.moveTo(x, frame.paddingTop);
		ctx.lineTo(x, frame.paddingTop + frame.plotHeight);
		ctx.stroke();
		ctx.fillText(`${s}`, x, frame.paddingTop + frame.plotHeight + 18);
	}
};

/**
 * Draw horizontal RPM grid lines.
 * @brief Show 1k RPM reference ticks.
 */
export const drawRpmGrid = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
): void => {
	ctx.textAlign = 'right';
	ctx.textBaseline = 'middle';
	ctx.strokeStyle = getGraphStyle().grid;
	ctx.fillStyle = getGraphStyle().axisText;
	const dpr = ctx.getTransform().a || 1;
	ctx.lineWidth = 1 / dpr;
	for (let r = Math.ceil((frame.minRpm ?? 0) / GRAPH_LIMITS.rpmStep) * GRAPH_LIMITS.rpmStep; r <= frame.maxRpm; r += GRAPH_LIMITS.rpmStep) {
		const y = alignPixel(toY(frame, r), dpr);
		ctx.beginPath();
		ctx.moveTo(frame.paddingLeft, y);
		ctx.lineTo(frame.paddingLeft + frame.plotWidth, y);
		ctx.stroke();
		if (r > 0) {
			ctx.fillText(`${r}`, frame.paddingLeft - 10, y);
		}
	}
};

/**
 * Draw the redline limit band.
 * @brief Highlight the over-rev region.
 */
export const drawRedlineBand = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	redline: number,
): void => {
	const redlineY = Math.max(frame.paddingTop, Math.min(frame.paddingTop + frame.plotHeight, toY(frame, redline)));
	ctx.fillStyle = getGraphStyle().redlineFill;
	ctx.fillRect(frame.paddingLeft, frame.paddingTop, frame.plotWidth, Math.max(0, redlineY - frame.paddingTop));
	ctx.strokeStyle = getGraphStyle().redlineLine;
	ctx.lineWidth = 1.5;
	ctx.setLineDash([4, 4]);
	ctx.beginPath();
	ctx.moveTo(frame.paddingLeft, redlineY);
	ctx.lineTo(frame.paddingLeft + frame.plotWidth, redlineY);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = '#ef4444';
	ctx.font = '10px Inter, sans-serif';
	ctx.textAlign = 'right';
	ctx.fillText(`LIMIT: ${redline} RPM`, frame.paddingLeft + frame.plotWidth - 10, redlineY - 10);
};

/**
 * Draw axis titles.
 * @brief Label both physical dimensions.
 */
export const drawAxisTitles = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	unit: SpeedUnit,
): void => {
	ctx.fillStyle = getGraphStyle().axisText;
	ctx.font = '11px Inter, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.fillText(`VEHICLE SPEED (${unit.toUpperCase()})`, frame.paddingLeft + frame.plotWidth / 2, frame.height - 8);
	ctx.save();
	ctx.translate(14, frame.paddingTop + frame.plotHeight / 2);
	ctx.rotate(-Math.PI / 2);
	ctx.fillText('ENGINE SPEED (RPM)', 0, 0);
	ctx.restore();
};

/**
 * @brief Shade the unreachable region past the drag-limited top speed.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @param limitKmh Drag-limited speed in km/h.
 * @param unit Display unit.
 * @param fill Fill color for the unreachable zone.
 * @return void
 */
export const shadeAeroWall = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	limitKmh: number,
	unit: SpeedUnit,
	fill: string = 'rgba(56, 189, 248, 0.07)',
): void => {
	const limitDisplay = toDisplaySpeed(limitKmh, unit);
	if (limitDisplay <= 0 || limitDisplay >= frame.maxSpeed) {
		return;
	}
	const x = Math.max(frame.paddingLeft, toX(frame, limitDisplay));
	ctx.fillStyle = fill;
	ctx.fillRect(x, frame.paddingTop, frame.paddingLeft + frame.plotWidth - x, frame.plotHeight);
};

/**
 * @brief Draw the drag-limited top-speed marker.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @param limitKmh Drag-limited speed in km/h.
 * @param unit Display unit.
 * @return void
 */
export const drawAeroLimit = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	limitKmh: number,
	unit: SpeedUnit,
): void => {
	const limitDisplay = toDisplaySpeed(limitKmh, unit);
	if (limitDisplay <= 0 || limitDisplay >= frame.maxSpeed) {
		return;
	}
	const x = toX(frame, limitDisplay);
	ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
	ctx.lineWidth = 1.5;
	ctx.setLineDash([6, 4]);
	ctx.beginPath();
	ctx.moveTo(x, frame.paddingTop);
	ctx.lineTo(x, frame.paddingTop + frame.plotHeight);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = '#38bdf8';
	ctx.font = '10px Inter, sans-serif';
	ctx.textAlign = unit === 'mph' ? 'right' : 'left';
	ctx.fillText(`AERO ${Math.round(limitDisplay)}`, x + 6, frame.paddingTop + 12);
};
