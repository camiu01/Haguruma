/**
 * @file graph-curves.ts
 * @brief Primary and comparison gear curves plus reverse curve.
 */
import { getGraphStyle } from './graph-theme';
import { getGearColor } from '../../config/gear-colors';
import { calculateSpeed } from '../../core/math/speed-math';
import type { PeakPoint, PlotFrame, SpeedUnit } from '../../core/models';
import { toX, toY } from './canvas-setup';

/**
 * Draw dashed secondary comparison curves.
 * @purpose Overlay an independent tire, final drive, gearset and redline.
 */
export const drawComparisonCurves = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	gears: number[],
	compFd: number,
	compCircM: number,
	redline: number,
	unit: SpeedUnit,
): void => {
	ctx.setLineDash([5, 5]);
	gears.forEach((gearRatio, idx) => {
		ctx.strokeStyle = getGraphStyle().compare;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		const topSpeed = calculateSpeed(redline, gearRatio, compFd, compCircM, unit);
		ctx.moveTo(toX(frame, 0), toY(frame, 0));
		ctx.lineTo(toX(frame, topSpeed), toY(frame, redline));
		ctx.stroke();
		drawCompareLabel(ctx, frame, topSpeed, redline, idx);
	});
	ctx.setLineDash([]);
};

/**
 * Draw solid primary gear curves with labels.
 * @purpose Show RPM vs speed for the main setup.
 * @returns Peak redline points reused for shift-drop markers.
 */
export const drawPrimaryCurves = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	gears: number[],
	finalDrive: number,
	circM: number,
	redline: number,
	unit: SpeedUnit,
): PeakPoint[] => {
	const peaks: PeakPoint[] = [];
	gears.forEach((gearRatio, idx) => {
		const color = getGearColor(idx);
		const redlineSpeed = calculateSpeed(redline, gearRatio, finalDrive, circM, unit);
		const endX = toX(frame, redlineSpeed);
		const endY = toY(frame, redline);
		ctx.strokeStyle = color;
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.moveTo(toX(frame, 0), toY(frame, 0));
		ctx.lineTo(endX, endY);
		ctx.stroke();
		peaks.push({ gear: idx + 1, speed: redlineSpeed, endX, endY, ratio: gearRatio, color });
		drawGearLabel(ctx, frame, redlineSpeed, redline, idx, color);
	});
	return peaks;
};

/**
 * @brief Draw the reverse-gear curve in gray when set.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @param reverseRatio Reverse gear ratio.
 * @param finalDrive Differential ratio.
 * @param circM Tire circumference in metres.
 * @param redline Rev limiter in RPM.
 * @param unit Display unit.
 * @return Redline top speed of reverse in display units.
 */
export const drawReverseCurve = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	reverseRatio: number,
	finalDrive: number,
	circM: number,
	redline: number,
	unit: SpeedUnit,
): number => {
	const redlineSpeed = calculateSpeed(redline, reverseRatio, finalDrive, circM, unit);
	ctx.strokeStyle = '#9ca3af';
	ctx.lineWidth = 2;
	ctx.setLineDash([6, 4]);
	ctx.beginPath();
	ctx.moveTo(toX(frame, 0), toY(frame, 0));
	ctx.lineTo(toX(frame, redlineSpeed), toY(frame, redline));
	ctx.stroke();
	ctx.setLineDash([]);
	const midX = toX(frame, redlineSpeed * 0.7);
	const midY = toY(frame, redline * 0.7);
	ctx.save();
	ctx.translate(midX, midY);
	ctx.fillStyle = '#9ca3af';
	ctx.font = 'bold 11px Inter, sans-serif';
	ctx.fillText('R', 10, -5);
	ctx.restore();
	return redlineSpeed;
};
/**
 * Draw the G-number tag along a gear curve.
 * @brief Identify each line without a separate legend.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @param redlineSpeed Top speed at the limiter.
 * @param redline Rev limiter in RPM.
 * @param idx Zero-based gear index.
 * @param color Display color.
 * @return void
 */
export const drawGearLabel = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	redlineSpeed: number,
	redline: number,
	idx: number,
	color: string,
): void => {
	const midX = toX(frame, redlineSpeed * 0.7);
	const midY = toY(frame, redline * 0.7);
	ctx.save();
	ctx.translate(midX, midY);
	ctx.fillStyle = color;
	ctx.font = 'bold 11px Inter, sans-serif';
	ctx.fillText(`G${idx + 1}`, 10, -5);
	ctx.restore();
};

/**
 * Draw the secondary gear tag for a comparison curve.
 * @brief Use a prime suffix so G2 and G2' stay distinguishable.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @param redlineSpeed Top speed at the secondary limiter.
 * @param redline Secondary rev limiter in RPM.
 * @param idx Zero-based gear index.
 */
const drawCompareLabel = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	redlineSpeed: number,
	redline: number,
	idx: number,
): void => {
	const midX = toX(frame, redlineSpeed * 0.55);
	const midY = toY(frame, redline * 0.55);
	ctx.save();
	ctx.translate(midX, midY);
	ctx.fillStyle = getGraphStyle().compare;
	ctx.font = '10px Inter, sans-serif';
	ctx.fillText(`G${idx + 1}'`, 10, 12);
	ctx.restore();
};
