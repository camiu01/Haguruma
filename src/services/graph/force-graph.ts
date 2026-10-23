/**
 * @file force-graph.ts
 * @brief Wheel-force curves and road resistance in physical newtons.
 */
import { state } from '../../core/state/app-state';
import { activeEngineCurve } from '../../core/state/engine-curve';
import { calculateRpm, fromDisplaySpeed } from '../../core/math/speed-math';
import { dynamicRadiusM, tractiveForceAt } from '../../core/math/traction-math';
import { parseTire, effectiveCircumferenceM } from '../../core/math/tire-math';
import { dragForce, rollingForceAtSpeed, gradeForce } from '../../core/math/aero-math';
import { maxDriveForceAtSpeed } from '../../core/math/dynamics-math';
import type { PlotFrame } from '../../core/models';
import { getGearColor } from '../../config/gear-colors';
import { buildPlotFrame, toX, toY } from './canvas-setup';
import { drawBackground, drawSpeedGrid } from './graph-axes';
import { getGraphStyle } from './graph-theme';
import { getUnitLabel } from '../../core/units/unit-utils';
import { t } from '../../core/i18n/language';
import { mappedEfficiency } from '../../core/math/powertrain-math';

/**
 * @brief Return valid force/RPM points for each primary gear at road speed.
 * @param speed Speed in the active display unit.
 * @return Gear-force samples below redline.
 */
export const forceGraphPoints = (speed: number): { index: number; rpm: number; forceN: number }[] => {
	const tire = parseTire(state.primaryTire);
	const curve = activeEngineCurve();
	if (!tire || !curve) return [];
	const circ = effectiveCircumferenceM(tire, state.rollingFactor);
	return state.gears.map((ratio, index) => {
		const rpm = calculateRpm(speed, ratio, state.primaryFd, circ, state.unit);
		const efficiency = mappedEfficiency(state.simulation?.efficiencyMap, rpm, 1, state.drivetrainEff);
		return { index, rpm, forceN: tractiveForceAt(rpm, ratio, state.primaryFd, dynamicRadiusM(circ), curve, efficiency) };
	}).filter((point) => point.rpm >= 800 && point.rpm <= state.primaryRedline);
};

/**
 * @brief Build force-axis geometry, retaining only the horizontal zoom window.
 * @param canvas Visible canvas.
 * @return Plot with maxRpm interpreted as newtons for shared coordinate helpers.
 */
export const forceGraphFrame = (canvas: HTMLCanvasElement): PlotFrame | null => {
	const frame = buildPlotFrame(canvas, state.maxGraphSpeed, 10000);
	return frame ? forceAxisFrame(frame) : null;
};

/**
 * @brief Resolve a force axis consistently for canvas and vector export.
 * @param frame Existing frame with the visible speed window.
 * @return Frame using newtons instead of RPM vertically.
 */
export const forceAxisFrame = (frame: PlotFrame): PlotFrame => {
	let max = 1000;
	for (let speed = frame.minSpeed ?? 0; speed <= frame.maxSpeed; speed += Math.max(1, (frame.maxSpeed - (frame.minSpeed ?? 0)) / 100)) {
		for (const point of forceGraphPoints(speed)) max = Math.max(max, point.forceN);
	}
	return { ...frame, minRpm: 0, maxRpm: Math.ceil(max * 1.1 / 1000) * 1000 };
};

/**
 * @brief Stroke one speed-sampled scalar series.
 * @param ctx Rendering context.
 * @param frame Plot geometry.
 * @param color Stroke color.
 * @param value Value in N at display-unit speed, null to break a line.
 * @return void
 */
const strokeSeries = (ctx: CanvasRenderingContext2D, frame: PlotFrame, color: string, value: (speed: number) => number | null): void => {
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.beginPath();
	let started = false;
	const min = frame.minSpeed ?? 0;
	for (let i = 0; i <= 160; i += 1) {
		const speed = min + (frame.maxSpeed - min) * i / 160;
		const force = value(speed);
		if (force === null) { started = false; continue; }
		if (!started) ctx.moveTo(toX(frame, speed), toY(frame, force));
		else ctx.lineTo(toX(frame, speed), toY(frame, force));
		started = true;
	}
	ctx.stroke();
};

/**
 * @brief Render wheel force, total road resistance and the grip budget.
 * @param canvas Visible canvas.
 * @param ctx Rendering context.
 * @return void
 */
export const drawForceGraph = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void => {
	const frame = forceGraphFrame(canvas);
	if (!frame) return;
	drawBackground(ctx, frame);
	drawSpeedGrid(ctx, frame, state.unit);
	ctx.fillStyle = getGraphStyle().axisText;
	ctx.font = '10px sans-serif';
	ctx.textAlign = 'right';
	const step = Math.max(1000, Math.ceil(frame.maxRpm / 6 / 1000) * 1000);
	for (let value = 0; value <= frame.maxRpm; value += step) {
		ctx.fillText(String(value), frame.paddingLeft - 8, toY(frame, value));
	}
	ctx.textAlign = 'left';
	ctx.fillText(`${t('graph.force')} (N)`, frame.paddingLeft, 15);
	ctx.fillText(`${getUnitLabel(state.unit)} · ${t('graph.forceLegend')}`, frame.paddingLeft, frame.height - 6);
	ctx.save(); ctx.beginPath(); ctx.rect(frame.paddingLeft, frame.paddingTop, frame.plotWidth, frame.plotHeight); ctx.clip();
	for (let gear = 0; gear < state.gears.length; gear += 1) {
		strokeSeries(ctx, frame, getGearColor(gear), (speed) => forceGraphPoints(speed).find((point) => point.index === gear)?.forceN ?? null);
	}
	if (state.showTractionMargin) drawExcessBands(ctx, frame);
	strokeSeries(ctx, frame, getGraphStyle().axisText, (speed) => {
		const kmh = fromDisplaySpeed(speed, state.unit);
		return dragForce(kmh, state.dragCd, state.frontalAreaM2) + rollingForceAtSpeed(state.vehicleMassKg, state.rollingCrr, kmh)
			+ gradeForce(state.vehicleMassKg, state.roadGradePercent);
	});
	ctx.setLineDash([5, 4]);
	strokeSeries(ctx, frame, getGraphStyle().compare, (speed) =>
		maxDriveForceAtSpeed(state.runningGear, state.vehicleMassKg, fromDisplaySpeed(speed, state.unit), 0, 0).limitN);
	ctx.setLineDash([]); ctx.restore();
};

/**
 * @brief Shade the force budget exceeded by any reachable gear.
 * @param ctx Rendering context.
 * @param frame Force plot frame.
 * @return void
 */
const drawExcessBands = (ctx: CanvasRenderingContext2D, frame: PlotFrame): void => {
	ctx.fillStyle = getGraphStyle().redlineFill;
	const min = frame.minSpeed ?? 0;
	for (let i = 0; i < 160; i += 1) {
		const speed = min + (frame.maxSpeed - min) * i / 160;
		const grip = maxDriveForceAtSpeed(state.runningGear, state.vehicleMassKg, fromDisplaySpeed(speed, state.unit), 0, 0).limitN;
		const peak = Math.max(0, ...forceGraphPoints(speed).map((point) => point.forceN));
		if (peak <= grip) continue;
		const x = toX(frame, speed);
		const next = toX(frame, min + (frame.maxSpeed - min) * (i + 1) / 160);
		ctx.fillRect(x, toY(frame, peak), next - x, (peak - grip) / frame.maxRpm * frame.plotHeight);
	}
};
