/**
 * @file graph-renderer.ts
 * @brief Full graph orchestration: background, grids, curves, limits.
 */
import { state, defaultRunningGear } from '../../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../../core/math/tire-math';
import { rpmFromKmh, toDisplaySpeed } from '../../core/math/speed-math';
import { dynamicRadiusM, tractiveForceAt } from '../../core/math/traction-math';
import { activeEngineCurve } from '../../core/state/engine-curve';
import { maxDriveForceAtSpeed } from '../../core/math/dynamics-math';
import { availableWheelKw, dragLimitedSpeedKmh } from '../../core/math/aero-math';
import { getMaxRpm } from '../../core/units/unit-utils';
import type { PlotFrame } from '../../core/models';
import type { ElementRefs } from '../dom/element-refs';
import { buildPlotFrame, toX, toY } from './canvas-setup';
import { drawBackground, drawSpeedGrid, drawRpmGrid, drawRedlineBand, drawAxisTitles, drawAeroLimit } from './graph-axes';
import { drawComparisonCurves, drawPrimaryCurves, drawReverseCurve } from './graph-curves';
import { drawShiftDrops } from './graph-shift-drops';
import { drawGripCurve, shadeWheelspin } from './graph-limits';

/**
 * Render the full RPM vs speed graph.
 * @brief Orchestrate background, grids, curves and shift markers.
 * @brief Layer order: background, grid/redline/labels, primary curves,
 * @brief shift drops, comparison dashed overlay, then axis titles/legend.
 * @param refs Cached DOM handles.
 * @return void
 */
export const drawGraph = (refs: ElementRefs): void => {
	const primaryTire = parseTire(state.primaryTire);
	if (!primaryTire) {
		return;
	}
	const circM = effectiveCircumferenceM(primaryTire, state.rollingFactor);
	const topRedline = state.compareEnabled ? Math.max(state.primaryRedline, state.compRedline) : state.primaryRedline;
	const maxRpm = getMaxRpm(topRedline);
	const frame = buildPlotFrame(refs.canvas, state.maxGraphSpeed, maxRpm);
	if (!frame) {
		return;
	}
	const { ctx } = refs;
	drawBackground(ctx, frame);
	drawSpeedGrid(ctx, frame, state.unit);
	drawRpmGrid(ctx, frame);
	drawRedlineBand(ctx, frame, state.primaryRedline);
	const peaks = drawPrimaryCurves(ctx, frame, state.gears, state.primaryFd, circM, state.primaryRedline, state.unit);
	if (state.reverseRatio !== null && state.reverseRatio > 0) {
		drawReverseCurve(ctx, frame, state.reverseRatio, state.primaryFd, circM, state.primaryRedline, state.unit);
	}
	drawShiftDrops(ctx, frame, peaks, state.gears, state.primaryFd, circM, state.unit);
	drawOptionalAeroLimit(ctx, frame);
	drawCompareRedline(ctx, frame);
	drawOptionalComparison(ctx, frame);
	drawOptionalCompAeroLimit(ctx, frame);
	drawOptionalGripLimit(ctx, frame);
	drawAxisTitles(ctx, frame, state.unit);
};

/**
 * Draw the aero-limit marker only when road load is enabled.
 * @brief Show where wheel power runs out against drag.
 */
export const drawOptionalAeroLimit = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
): void => {
	if (!state.roadLoadEnabled) {
		return;
	}
	const wheelKw = availableWheelKw(state.enginePowerKw, state.drivetrainEff);
	const limit = dragLimitedSpeedKmh(
		wheelKw,
		state.vehicleMassKg,
		state.dragCd,
		state.frontalAreaM2,
		state.rollingCrr,
		state.roadGradePercent,
	);
	if (limit > 0) {
		drawAeroLimit(ctx, frame, limit, state.unit);
	}
};

/**
 * Draw the comparison aero-limit marker from isolated comp slots.
 * @brief Secondary drag limit uses comp mass, Cd, area and power.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @return void
 */
export const drawOptionalCompAeroLimit = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
): void => {
	if (!state.roadLoadEnabled || !state.compareEnabled) {
		return;
	}
	const wheelKw = availableWheelKw(state.compPowerKw, state.drivetrainEff);
	const limit = dragLimitedSpeedKmh(
		wheelKw,
		state.compMassKg,
		state.compCd,
		state.compFrontalAreaM2,
		state.rollingCrr,
		state.roadGradePercent,
	);
	if (limit <= 0) {
		return;
	}
	const limitDisplay = toDisplaySpeed(limit, state.unit);
	if (limitDisplay <= 0 || limitDisplay >= frame.maxSpeed) {
		return;
	}
	const x = toX(frame, limitDisplay);
	ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
	ctx.lineWidth = 1.5;
	ctx.setLineDash([6, 4]);
	ctx.beginPath();
	ctx.moveTo(x, frame.paddingTop);
	ctx.lineTo(x, frame.paddingTop + frame.plotHeight);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = '#fbbf24';
	ctx.font = '10px Inter, sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText(`COMP AERO ${Math.round(limitDisplay)}`, x + 6, frame.paddingTop + 26);
};
/**
 * Draw the friction-limited grip curve and 1st-gear spin shading.
 * @brief Grip after aero limits, before titles to keep legend on top.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @return void
 */
export const drawOptionalGripLimit = (ctx: CanvasRenderingContext2D, frame: PlotFrame): void => {
	const rg = state.runningGear ?? defaultRunningGear;
	const gripFn = (vKmh: number): number => maxDriveForceAtSpeed(rg, state.vehicleMassKg, vKmh, 0, 0).limitN;
	drawGripCurve(ctx, frame, gripFn, '#f59e0b');
	shadePrimarySpin(ctx, frame, gripFn);
	drawOptionalCompGrip(ctx, frame);
};

/**
 * Shade 1st-gear wheelspin against the primary grip limit.
 * @brief Convert display speed to RPM, then compare tractive force.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @param gripFn Grip limit in newtons from speed in km/h.
 * @return void
 */
const shadePrimarySpin = (ctx: CanvasRenderingContext2D, frame: PlotFrame, gripFn: (v: number) => number): void => {
	const primaryTire = parseTire(state.primaryTire);
	if (!primaryTire || state.gears.length === 0) {
		return;
	}
	const circM = effectiveCircumferenceM(primaryTire, state.rollingFactor);
	const curve = activeEngineCurve();
	if (!curve) {
		return;
	}
	const radius = dynamicRadiusM(circM);
	const first = state.gears[0];
	const gearForceFn = (vKmh: number): number => {
		const rpm = rpmFromKmh(vKmh, first, state.primaryFd, circM);
		if (rpm <= 0) {
			return 0;
		}
		return tractiveForceAt(rpm, first, state.primaryFd, radius, curve, state.drivetrainEff);
	};
	shadeWheelspin(ctx, frame, gripFn, gearForceFn);
};

/**
 * Draw the dashed secondary grip curve when comparing.
 * @brief Comp grip uses comp mass and comp running gear.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @return void
 */
const drawOptionalCompGrip = (ctx: CanvasRenderingContext2D, frame: PlotFrame): void => {
	if (!state.compareEnabled) {
		return;
	}
	const rg = state.compRunningGear ?? state.runningGear ?? defaultRunningGear;
	const gripFn = (vKmh: number): number => maxDriveForceAtSpeed(rg, state.compMassKg, vKmh, 0, 0).limitN;
	drawGripCurve(ctx, frame, gripFn, '#ef4444');
};
/**
 * Draw comparison curves only when enabled and valid.
 * @brief Overlay an independent gearset, tire, final drive and redline.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 * @return void
 */
const drawOptionalComparison = (
	ctx: CanvasRenderingContext2D,
	frame: PlotFrame,
): void => {
	if (!state.compareEnabled || state.compFd <= 0 || state.compGears.length === 0) {
		return;
	}
	const compTire = parseTire(state.compTire);
	if (!compTire) {
		return;
	}
	const compCircM = effectiveCircumferenceM(compTire, state.rollingFactor);
	drawComparisonCurves(ctx, frame, state.compGears, state.compFd, compCircM, state.compRedline, state.unit);
};

/**
 * Draw the secondary redline when it differs from primary.
 * @brief Distinguish 4.10 vs short-final-drive limiter setups.
 * @param ctx Rendering context.
 * @param frame Plot geometry and limits.
 */
const drawCompareRedline = (ctx: CanvasRenderingContext2D, frame: PlotFrame): void => {
	if (!state.compareEnabled || state.compRedline === state.primaryRedline) {
		return;
	}
	const compTire = parseTire(state.compTire);
	if (!compTire || state.compGears.length === 0) {
		return;
	}
	const y = toY(frame, state.compRedline);
	ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
	ctx.lineWidth = 1.2;
	ctx.setLineDash([4, 4]);
	ctx.beginPath();
	ctx.moveTo(frame.paddingLeft, y);
	ctx.lineTo(frame.paddingLeft + frame.plotWidth, y);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = '#fbbf24';
	ctx.font = '10px Inter, sans-serif';
	ctx.textAlign = 'right';
	ctx.fillText(`COMPARE LIMIT: ${state.compRedline} RPM`, frame.paddingLeft + frame.plotWidth - 10, y - 8);
};
