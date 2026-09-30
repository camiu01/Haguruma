/**
 * @file kpi-strip.ts
 * @brief Top KPI strip: eight summary cells kept in sync with the live simulation state.
 */
import { defaultRunningGear, state } from '../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { calculateSpeed, toDisplaySpeed } from '../core/math/speed-math';
import { maxDriveForceAtSpeed } from '../core/math/dynamics-math';
import { simulateAcceleration, type SimResult } from '../core/math/accel-math';
import { activeEngineCurve } from '../core/state/engine-curve';
import { availableWheelKw, dragLimitedSpeedKmh } from '../core/math/aero-math';
import { formatPower } from '../core/units/unit-utils';
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';

/** Em dash shown when a KPI has no computable value. */
const NO_VALUE = '—';

/** Memo key for the acceleration KPI simulation. */
let accelCacheKey = '';

/** Memoized acceleration result matching accelCacheKey. */
let accelCache: SimResult | null = null;

/**
 * @brief Write a display string into an optional KPI cell.
 * @param el Target cell, null when the markup does not provide it.
 * @param value Display string.
 * @return void
 */
const setCellText = (el: HTMLElement | null, value: string): void => {
	if (el) {
		el.textContent = value;
	}
};

/**
 * @brief Format one acceleration split in seconds.
 * @param seconds Split time in seconds, null when the target was never reached.
 * @return Display string such as 5.42 s, or the em dash.
 */
const formatSeconds = (seconds: number | null): string => {
	return seconds === null ? NO_VALUE : `${seconds.toFixed(2)} s`;
};

/**
 * Update the standstill grip-limit KPI cell.
 * @brief Null-guarded write to #kpi-grip with engine force 0.
 * @return void
 */
const updateGripKpi = (): void => {
	const el = document.getElementById('kpi-grip');
	if (!el) {
		return;
	}
	const rg = state.runningGear ?? defaultRunningGear;
	const grip = maxDriveForceAtSpeed(rg, state.vehicleMassKg, 0, 0, 0);
	el.textContent = `${Math.round(grip.limitN).toLocaleString('en-US')}`;
};

/**
 * Update redline, top-speed and aero-wall KPI cells.
 * @brief Mirrors graph inputs so the strip never shows stale HTML defaults.
 * @return void
 */
const updateSummaryKpis = (): void => {
	const redlineEl = document.getElementById('kpi-redline');
	if (redlineEl) {
		redlineEl.textContent = Math.round(state.primaryRedline).toLocaleString('en-US');
	}
	const topEl = document.getElementById('kpi-top-speed');
	const aeroEl = document.getElementById('kpi-aero-wall');
	const tire = parseTire(state.primaryTire);
	if (topEl) {
		if (!tire || state.gears.length === 0) {
			topEl.textContent = NO_VALUE;
		} else {
			const circM = effectiveCircumferenceM(tire, state.rollingFactor);
			const topGear = state.gears[state.gears.length - 1];
			topEl.textContent = calculateSpeed(state.primaryRedline, topGear, state.primaryFd, circM, state.unit).toFixed(1);
		}
	}
	if (aeroEl) {
		aeroEl.textContent = state.roadLoadEnabled ? formatWallSpeed() : NO_VALUE;
	}
};

/**
 * Format the drag-limited top speed in the active display unit.
 * @brief Keeps the aero-wall arithmetic out of the DOM branch.
 * @return Display string such as 281.0, or the em dash when unsolvable.
 */
const formatWallSpeed = (): string => {
	const wheelKw = availableWheelKw(state.enginePowerKw, state.drivetrainEff);
	const wallKmh = dragLimitedSpeedKmh(
		wheelKw,
		state.vehicleMassKg,
		state.dragCd,
		state.frontalAreaM2,
		state.rollingCrr,
		state.roadGradePercent,
	);
	if (!(wallKmh > 0)) {
		return NO_VALUE;
	}
	return toDisplaySpeed(wallKmh, state.unit).toFixed(1);
};

/**
 * Update the wheel-power KPI cell.
 * @brief Wheel power follows the kW/cv toggle through formatPower.
 * @return void
 */
const updateWheelPowerKpi = (): void => {
	const el = document.getElementById('kpi-wheel-power');
	if (!el) {
		return;
	}
	el.textContent = formatPower(availableWheelKw(state.enginePowerKw, state.drivetrainEff), state.powerUnit);
};

/**
 * Build a stable memo key from every SimInput field.
 * @brief Re-runs the solver only when a physical input actually changed.
 * @return Cache key string.
 */
const buildAccelKey = (): string => {
	return JSON.stringify([
		state.vehicleMassKg,
		state.gears,
		state.primaryFd,
		state.primaryTire,
		state.rollingFactor,
		state.enginePowerKw,
		state.peakTorqueRpm,
		state.peakTorqueNm,
		state.peakPowerRpm,
		state.primaryRedline,
		state.drivetrainEff,
		state.rotatingMassKg,
		state.shiftTimeS,
		state.dragCd,
		state.frontalAreaM2,
		state.rollingCrr,
		state.roadGradePercent,
		state.runningGear,
		state.torqueCurvePoints,
	]);
};

/**
 * Run the acceleration solver, memoized on the physical inputs.
 * @param circM Effective rolling circumference in metres.
 * @return Cached solver result for the current inputs.
 */
const accelResult = (circM: number): SimResult | null => {
	const key = buildAccelKey();
	if (key !== accelCacheKey) {
		accelCacheKey = key;
		accelCache = simulateAcceleration({
			massKg: state.vehicleMassKg,
			gears: state.gears,
			fd: state.primaryFd,
			circM,
			curve: activeEngineCurve(),
			drivetrainEff: state.drivetrainEff,
			rotatingMassKg: state.rotatingMassKg,
			shiftTimeS: state.shiftTimeS,
			runningGear: state.runningGear ?? defaultRunningGear,
			dragCd: state.dragCd,
			frontalAreaM2: state.frontalAreaM2,
			rollingCrr: state.rollingCrr,
			roadGradePercent: state.roadGradePercent,
		});
	}
	return accelCache;
};

/**
 * @brief Swap the copy of one acceleration cell between metric and imperial.
 * @param el Target cell, null when the markup does not provide it.
 * @param key Dictionary key matching the active display unit.
 * @return void
 */
const swapCellLabel = (el: HTMLElement | null, key: DictKey): void => {
	const label = el?.closest('.kpi-cell')?.querySelector('[data-i18n]');
	if (!label) {
		return;
	}
	label.setAttribute('data-i18n', key);
	label.textContent = t(key);
};

/**
 * @brief Show metric or imperial copy on the two acceleration cells.
 * @brief km/h shows 0-100 km/h and 0-400 m, mph shows 0-60 mph and 1/4 mile.
 * @param el100 First acceleration cell, null when absent.
 * @param elQ Quarter-mile cell, null when absent.
 * @return void
 */
const applyKpiUnits = (el100: HTMLElement | null, elQ: HTMLElement | null): void => {
	const metric = state.unit !== 'mph';
	swapCellLabel(el100, metric ? 'kpi.time0to100' : 'kpi.mph60');
	swapCellLabel(elQ, metric ? 'kpi.m400' : 'kpi.quarterMile');
};

/**
 * Pick the split shown by the first acceleration cell for the active unit.
 * @brief The cell copy and its value must always describe the same split.
 * @param result Memoized solver result, null when it never ran.
 * @return Split time in seconds, or null when the target was not reached.
 */
const firstSplitSeconds = (result: SimResult | null): number | null => {
	if (!result) {
		return null;
	}
	return state.unit === 'mph' ? result.t060mphS : result.time0To100S;
};

/**
 * Update the acceleration KPI cells from the time-step solver.
 * @brief Memoized so renderTable does not re-simulate unchanged inputs.
 * @return void
 */
const updateAccelKpis = (): void => {
	const el100 = document.getElementById('kpi-0-100-time');
	const elQ = document.getElementById('kpi-quarter');
	const elTrap = document.getElementById('kpi-trap');
	applyKpiUnits(el100, elQ);
	const tire = parseTire(state.primaryTire);
	if (!tire) {
		setCellText(el100, NO_VALUE);
		setCellText(elQ, NO_VALUE);
		setCellText(elTrap, NO_VALUE);
		return;
	}
	const result = accelResult(effectiveCircumferenceM(tire, state.rollingFactor));
	setCellText(el100, formatSeconds(firstSplitSeconds(result)));
	setCellText(elQ, formatSeconds(result ? result.quarterMileS : null));
	const trap = result && result.trapSpeedKmh !== null ? toDisplaySpeed(result.trapSpeedKmh, state.unit).toFixed(1) : NO_VALUE;
	setCellText(elTrap, trap);
};

/**
 * Refresh every cell of the top KPI strip.
 * @brief Single entry point called by renderTable so the strip can never go stale.
 * @return void
 */
export const renderKpis = (): void => {
	updateGripKpi();
	updateSummaryKpis();
	updateWheelPowerKpi();
	updateAccelKpis();
};
