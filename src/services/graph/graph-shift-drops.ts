import { GRAPH_STYLE } from '../../config/graph-constants';
import { calculateRpm } from '../../core/math/speed-math';
import type { PeakPoint, PlotFrame, SpeedUnit } from '../../core/models';
import { toX } from './canvas-setup';

/**
 * Draw vertical redline shift-drop connectors.
 * @purpose Visualize RPM loss when upshifting at the limiter.
 */
export const drawShiftDrops = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	peaks: PeakPoint[],
	gears: number[],
	finalDrive: number,
	circM: number,
	unit: SpeedUnit,
): void => {
	for (let i = 0; i < peaks.length - 1; i += 1) {
		const current = peaks[i];
		const nextRatio = gears[i + 1];
		const nextRpm = calculateRpm(current.speed, nextRatio, finalDrive, circM, unit);
		drawSingleDrop(ctx, frame, current, nextRpm);
	}
};

/**
 * Draw one drop line with landing marker.
 * @purpose Keep the loop body small and testable.
 */
export const drawSingleDrop = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
	peak: PeakPoint,
	nextRpm: number,
): void => {
	const maxRpm = frame.maxRpm;
	const clampedRpm = Math.max(0, Math.min(nextRpm, maxRpm));
	const landingY = frame.paddingTop + frame.plotHeight - (clampedRpm / maxRpm) * frame.plotHeight;
	ctx.strokeStyle = GRAPH_STYLE.shiftDrop;
	ctx.lineWidth = 1.5;
	ctx.setLineDash([2, 3]);
	ctx.beginPath();
	ctx.moveTo(peak.endX, peak.endY);
	ctx.lineTo(peak.endX, landingY);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = '#ef4444';
	ctx.beginPath();
	ctx.arc(peak.endX, landingY, 3.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(peak.endX - 3, landingY - 5);
	ctx.lineTo(peak.endX + 3, landingY - 5);
	ctx.lineTo(peak.endX, landingY);
	ctx.fill();
	ctx.fillStyle = peak.color;
	ctx.beginPath();
	ctx.arc(peak.endX, peak.endY, 4, 0, Math.PI * 2);
	ctx.fill();
};

/**
 * Hide markers outside the visible plot.
 * @purpose Guard for extreme ratios.
 */
export const isPeakVisible = (frame: PlotFrame, peak: PeakPoint): boolean => {
	return peak.endX >= frame.paddingLeft && peak.endX <= frame.paddingLeft + frame.plotWidth;
};

/**
 * Keep unused import alive for future tooltip anchoring.
 * @purpose Document that X mapping stays centralized here.
 */
export const peakX = (frame: PlotFrame, speed: number): number => {
	return toX(frame, speed);
};
