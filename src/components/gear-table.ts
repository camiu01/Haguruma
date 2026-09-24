/**
 * @file gear-table.ts
 * @brief Primary breakdown table plus isolated secondary comparison rows.
 */
import { state } from '../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { calculateSpeed, fromDisplaySpeed } from '../core/math/speed-math';
import { describeUpshift } from '../core/math/shift-math';
import {
	dynamicRadiusM,
	engineTorqueAt,
	optimalShiftsForAll,
	tractiveForceAt,
	validateCurve,
} from '../core/math/traction-math';
import { criticalWheelspinSpeed, maxDriveForceAtSpeed, wheelLoads } from '../core/math/dynamics-math';
import { simulateAcceleration, type SimResult } from '../core/math/accel-math';
import { defaultRunningGear } from '../core/state/app-state';
import { availableWheelKw, dragLimitedSpeedKmh, roadLoadPowerKw } from '../core/math/aero-math';
import { toDisplaySpeed } from '../core/math/speed-math';
import { formatPower } from '../core/units/unit-utils';
import { topsForSetup } from '../core/compare/compare-utils';
import { getGearColor } from '../config/gear-colors';
import { t } from '../core/i18n/language';
import type { ElementRefs } from '../services/dom/element-refs';

/**
 * Render the theoretical top-speed and shift-drop table.
 * @purpose Summarize every gear peak and the RPM landing in the next gear.
 * @param refs Cached DOM handles.
 */
export const renderTable = (refs: ElementRefs): void => {
	const primaryTire = parseTire(state.primaryTire);
	if (!primaryTire) {
		return;
	}
	const circM = effectiveCircumferenceM(primaryTire, state.rollingFactor);
	refs.breakdownBody.innerHTML = '';
	state.gears.forEach((gearRatio, idx) => {
		refs.breakdownBody.appendChild(buildTableRow(circM, gearRatio, idx));
	});
	if (state.reverseRatio !== null && state.reverseRatio > 0) {
		refs.breakdownBody.appendChild(buildReverseRow(circM));
	}
	updateGripKpi();
	updateSummaryKpis();
	updateAccelKpis();
	updateComparisonInfo(refs);
	renderCompareTable(refs, circM);
};

/**
 * Build one table row for a gear.
 * @brief Isolate per-gear arithmetic from DOM code.
 * @param circM Effective rolling circumference in metres.
 * @param gearRatio Selected gear ratio.
 * @param idx Zero-based gear index.
 * @return Table row element with nowrap numeric cells.
 */
const buildTableRow = (circM: number, gearRatio: number, idx: number): HTMLElement => {
	const overallRatio = (gearRatio * state.primaryFd).toFixed(2);
	const topSpeed = calculateSpeed(state.primaryRedline, gearRatio, state.primaryFd, circM, state.unit);
	const { nextRpmDisplay, dropDisplay } = describeShift(circM, idx);
	const powerDisplay = describeRoadLoad(topSpeed);
	const { torqueDisplay, forceDisplay, shiftDisplay } = describeTraction(circM, gearRatio, idx);
	const spinDisplay = describeSpinSpeed(circM, idx);
	const wheelDisplay = describeMinWheel();
	const tr = document.createElement('tr');
	tr.className = 'hover:bg-input/80 transition-colors';
	tr.innerHTML = `<td class='py-2.5 pr-2 font-semibold whitespace-nowrap'><span class='inline-flex items-center gap-2 whitespace-nowrap'><span class='w-2 h-2 rounded-full shrink-0' style='background-color: ${getGearColor(idx)}'></span><span>${t('gear.prefix')} ${idx + 1}</span></span></td><td class='py-2.5 whitespace-nowrap'>${gearRatio.toFixed(2)}:1</td><td class='py-2.5 text-gray-400 whitespace-nowrap'>${overallRatio}:1</td><td class='py-2.5 text-right font-bold text-white whitespace-nowrap'>${topSpeed.toFixed(1)}</td><td class='py-2.5 text-right text-rose-300 whitespace-nowrap'>${nextRpmDisplay}</td><td class='py-2.5 text-right text-rose-400 font-semibold whitespace-nowrap'>${dropDisplay}</td><td class='py-2.5 text-right text-sky-300 whitespace-nowrap'>${powerDisplay}</td><td class='py-2.5 text-right text-amber-300 whitespace-nowrap'>${torqueDisplay}</td><td class='py-2.5 text-right text-emerald-300 whitespace-nowrap'>${forceDisplay}</td><td class='py-2.5 text-right text-violet-300 whitespace-nowrap'>${shiftDisplay}</td><td class='py-2.5 text-right text-orange-300 whitespace-nowrap'>${spinDisplay}</td><td class='py-2.5 text-right text-lime-300 whitespace-nowrap'>${wheelDisplay}</td>`;
	return tr;
};

/**
 * Describe the secondary road-load power at a gear peak.
 * @brief Show required wheel power in the active power unit (kW or cv).
 * @param topSpeed Theoretical top speed in the active display unit.
 * @return Display string such as 45.2 kW, flagged when drag-limited.
 */
const describeRoadLoad = (topSpeed: number): string => {
	if (!state.roadLoadEnabled) {
		return '-';
	}
	const speedKmh = fromDisplaySpeed(topSpeed, state.unit);
	const kw = roadLoadPowerKw(
		speedKmh,
		state.vehicleMassKg,
		state.dragCd,
		state.frontalAreaM2,
		state.rollingCrr,
		state.roadGradePercent,
	);
	const base = formatPower(kw, state.powerUnit);
	const available = availableWheelKw(state.enginePowerKw, state.drivetrainEff);
	return kw > available ? `${base} ${t('table.dragLimited')}` : base;
};

/**
 * Build the reverse-gear table row.
 * @brief Show R ratio, overall ratio, top speed and road-load power.
 * @param circM Tire circumference in metres.
 * @return Reverse table row element.
 */
const buildReverseRow = (circM: number): HTMLElement => {
	const ratio = state.reverseRatio ?? 0;
	const overallRatio = (ratio * state.primaryFd).toFixed(2);
	const topSpeed = calculateSpeed(state.primaryRedline, ratio, state.primaryFd, circM, state.unit);
	const powerDisplay = describeRoadLoad(topSpeed);
	const tr = document.createElement('tr');
	tr.className = 'hover:bg-input/80 transition-colors';
	tr.innerHTML = `<td class='py-2.5 pr-2 font-semibold whitespace-nowrap'><span class='inline-flex items-center gap-2 whitespace-nowrap'><span class='w-2 h-2 rounded-full bg-gray-400 shrink-0'></span><span>${t('gear.reverse')}</span></span></td><td class='py-2.5 whitespace-nowrap'>${ratio.toFixed(2)}:1</td><td class='py-2.5 text-gray-400 whitespace-nowrap'>${overallRatio}:1</td><td class='py-2.5 text-right font-bold text-white whitespace-nowrap'>${topSpeed.toFixed(1)}</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td><td class='py-2.5 text-right text-sky-300 whitespace-nowrap'>${powerDisplay}</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td>`;
	return tr;
};
/**
 * Describe the RPM landing in the next gear.
 * @brief Compute display strings for the shift columns.
 * @param circM Tire circumference in metres.
 * @param idx Zero-based gear index.
 * @return Next-RPM and drop display strings.
 */
const describeShift = (
	circM: number,
	idx: number,
): { nextRpmDisplay: string; dropDisplay: string } => {
	if (idx >= state.gears.length - 1) {
		return { nextRpmDisplay: '-', dropDisplay: '-' };
	}
	const step = describeUpshift(state.gears, idx, state.primaryRedline, state.primaryFd, circM, state.unit);
	if (!step) {
		return { nextRpmDisplay: '-', dropDisplay: '-' };
	}
	return {
		nextRpmDisplay: `${Math.round(step.landingRpm)} rpm`,
		dropDisplay: `-${Math.round(step.rpmDrop)} rpm`,
	};
};

/**
 * Describe torque, traction and optimal shift for one gear.
 * @brief Engine torque at the torque peak plus wheel force and shift advice.
 * @param circM Effective rolling circumference in metres.
 * @param gearRatio Selected gear ratio.
 * @param idx Zero-based gear index.
 * @return Display strings for the three new columns.
 */
const describeTraction = (
	circM: number,
	gearRatio: number,
	idx: number,
): { torqueDisplay: string; forceDisplay: string; shiftDisplay: string } => {
	const curve = validateCurve({
		redline: state.primaryRedline,
		peakTorqueRpm: state.peakTorqueRpm,
		peakTorqueNm: state.peakTorqueNm,
		peakPowerRpm: state.peakPowerRpm,
		peakPowerKw: state.enginePowerKw,
	});
	if (!curve) {
		return { torqueDisplay: '-', forceDisplay: '-', shiftDisplay: '-' };
	}
	const radius = dynamicRadiusM(circM);
	const torque = engineTorqueAt(state.peakTorqueRpm, curve);
	const force = tractiveForceAt(state.peakTorqueRpm, gearRatio, state.primaryFd, radius, curve, state.drivetrainEff);
	const shifts = optimalShiftsForAll(state.gears, state.primaryFd, circM, curve, state.drivetrainEff, state.unit);
	const shift = shifts.find((s) => s.fromIndex === idx);
	return {
		torqueDisplay: `${torque.toFixed(0)} Nm`,
		forceDisplay: `${Math.round(force)} N`,
		shiftDisplay: shift ? formatShiftAdvice(shift.shiftRpm, shift.atRedline) : '-',
	};
};

/**
 * Format the optimal shift advice.
 * @brief Redline shifts get a check, early shifts show the target RPM.
 * @param shiftRpm Prescribed shift RPM.
 * @param atRedline True when redline is already optimal.
 * @return Display string such as 6800 rpm or 6800 LIMIT.
 */
const formatShiftAdvice = (shiftRpm: number, atRedline: boolean): string => {
	return atRedline ? `${Math.round(shiftRpm)} LIMIT` : `${Math.round(shiftRpm)} rpm`;
};

/**
 * Describe the critical wheelspin recovery speed for one gear.
 * @brief Null-safe wrapper around criticalWheelspinSpeed.
 * @param circM Effective rolling circumference in metres.
 * @param idx Zero-based gear index.
 * @return Display string with unit or '-' when the gear never spins.
 */
const describeSpinSpeed = (circM: number, idx: number): string => {
	const curve = validateCurve({
		redline: state.primaryRedline,
		peakTorqueRpm: state.peakTorqueRpm,
		peakTorqueNm: state.peakTorqueNm,
		peakPowerRpm: state.peakPowerRpm,
		peakPowerKw: state.enginePowerKw,
	});
	if (!curve) {
		return '-';
	}
	const rg = state.runningGear ?? defaultRunningGear;
	const speeds = criticalWheelspinSpeed(state.gears, state.primaryFd, circM, curve, state.drivetrainEff, rg, state.vehicleMassKg, state.unit);
	const v = speeds[idx];
	return v === null || v === undefined ? '-' : `${v.toFixed(0)} ${state.unit}`;
};

/**
 * Describe the lightest inner wheel load at peak torque.
 * @brief Minimum of the four wheelLoads values at standstill transfer.
 * @return Display string in newtons.
 */
const describeMinWheel = (): string => {
	const rg = state.runningGear ?? defaultRunningGear;
	try {
		const loads = wheelLoads(rg, state.vehicleMassKg, 0);
		const min = Math.min(loads.fl, loads.fr, loads.rl, loads.rr);
		return `${Math.round(min)} N`;
	} catch {
		return '-';
	}
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
	const topEl = document.getElementById('kpi-top-speed');
	const aeroEl = document.getElementById('kpi-aero-wall');
	if (redlineEl) {
		redlineEl.textContent = Math.round(state.primaryRedline).toLocaleString('en-US');
	}
	const tire = parseTire(state.primaryTire);
	if (topEl) {
		if (!tire || state.gears.length === 0) {
			topEl.textContent = '—';
		} else {
			const circM = effectiveCircumferenceM(tire, state.rollingFactor);
			const topGear = state.gears[state.gears.length - 1];
			const top = calculateSpeed(state.primaryRedline, topGear, state.primaryFd, circM, state.unit);
			topEl.textContent = top.toFixed(1);
		}
	}
	if (aeroEl) {
		if (!state.roadLoadEnabled) {
			aeroEl.textContent = '—';
		} else {
			const wheelKw = availableWheelKw(state.enginePowerKw, state.drivetrainEff);
			const wallKmh = dragLimitedSpeedKmh(
				wheelKw,
				state.vehicleMassKg,
				state.dragCd,
				state.frontalAreaM2,
				state.rollingCrr,
				state.roadGradePercent,
			);
			aeroEl.textContent = toDisplaySpeed(wallKmh, state.unit).toFixed(1);
		}
	}
};

/** Memo key for the acceleration KPI simulation. */
let accelCacheKey = '';

/** Memoized acceleration result matching accelCacheKey. */
let accelCache: SimResult | null = null;

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
	]);
};

/**
 * Update the 0-100 km/h and 1/4 mile KPI cells from the time-step solver.
 * @brief Memoized so renderTable does not re-simulate unchanged inputs.
 * @return void
 */
export const updateAccelKpis = (): void => {
	const el100 = document.getElementById('kpi-0-100-time');
	const elQ = document.getElementById('kpi-quarter');
	if (!el100 || !elQ) {
		return;
	}
	const tire = parseTire(state.primaryTire);
	if (!tire) {
		el100.textContent = '—';
		elQ.textContent = '—';
		return;
	}
	const key = buildAccelKey();
	if (key !== accelCacheKey) {
		accelCacheKey = key;
		accelCache = simulateAcceleration({
			massKg: state.vehicleMassKg,
			gears: state.gears,
			fd: state.primaryFd,
			circM: effectiveCircumferenceM(tire, state.rollingFactor),
			curve: validateCurve({
				redline: state.primaryRedline,
				peakTorqueRpm: state.peakTorqueRpm,
				peakTorqueNm: state.peakTorqueNm,
				peakPowerRpm: state.peakPowerRpm,
				peakPowerKw: state.enginePowerKw,
			}),
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
	el100.textContent = accelCache && accelCache.time0To100S !== null ? `${accelCache.time0To100S.toFixed(2)} s` : '—';
	elQ.textContent = accelCache && accelCache.quarterMileS !== null ? `${accelCache.quarterMileS.toFixed(2)} s` : '—';
};

/**
 * Update the secondary tire delta caption.
 * @purpose Show rolling-circumference difference in percent.
 */
export const updateComparisonInfo = (refs: ElementRefs): void => {
	if (!state.compareEnabled) {
		return;
	}
	const primaryTire = parseTire(state.primaryTire);
	const compTire = parseTire(state.compTire);
	if (!primaryTire || !compTire) {
		return;
	}
	const primaryCirc = effectiveCircumferenceM(primaryTire, state.rollingFactor);
	const compCirc = effectiveCircumferenceM(compTire, state.rollingFactor);
	const delta = ((compCirc - primaryCirc) / primaryCirc) * 100;
	const sign = delta >= 0 ? '+' : '';
	refs.compCircInfo.textContent = `Circ: ${Math.round(compCirc * 1000)}mm (${sign}${delta.toFixed(1)}%)`;
};

/**
 * Render the secondary setup table with per-gear deltas.
 * @brief Compare 4.10 vs short final drive or 5 vs 6-speed gearsets.
 * @param refs Cached DOM handles.
 * @param primaryCircM Primary tire circumference in metres.
 */
const renderCompareTable = (refs: ElementRefs, primaryCircM: number): void => {
	if (!state.compareEnabled) {
		refs.compareWrap.classList.add('hidden');
		refs.compareBody.innerHTML = '';
		return;
	}
	const compTire = parseTire(state.compTire);
	if (!compTire || state.compGears.length === 0) {
		return;
	}
	syncCompareHeadLabel(refs);
	refs.compareWrap.classList.remove('hidden');
	refs.compareBody.innerHTML = '';
	const compCircM = effectiveCircumferenceM(compTire, state.rollingFactor);
	const primaryTops = topsForSetup(state.gears, state.primaryFd, primaryCircM, state.primaryRedline, state.unit);
	const compTops = topsForSetup(state.compGears, state.compFd, compCircM, state.compRedline, state.unit);
	compTops.forEach((top, idx) => {
		refs.compareBody.appendChild(buildCompareRow(idx, state.compGears[idx], top, primaryTops[idx]));
	});
};

/**
 * @brief Refresh the comparison power header label on language change.
 * @param refs Cached DOM handles.
 * @return void
 */
const syncCompareHeadLabel = (refs: ElementRefs): void => {
	const th = refs.compareWrap.querySelector('[data-comp-power]');
	if (!th) {
		return;
	}
	const label = th.querySelector('[data-i18n]');
	if (label) {
		label.textContent = t('th.power');
	}
};

/**
 * Describe one comparison row with isolated secondary aero/power.
 * @brief Secondary wheel-power check uses comp slots, never primary.
 * @param idx Zero-based gear index.
 * @param ratio Secondary gear ratio.
 * @param top Secondary top speed in display units.
 * @param primaryTop Primary top speed or undefined when gearsets differ.
 * @return Table row element.
 */
const buildCompareRow = (idx: number, ratio: number, top: number, primaryTop: number | undefined): HTMLElement => {
	const tr = document.createElement('tr');
	tr.className = 'hover:bg-input/80 transition-colors';
	const delta = primaryTop === undefined ? '-' : formatDelta(top - primaryTop);
	const deltaCls = describeDeltaClass(top, primaryTop);
	const power = describeCompRoadLoad(top);
	tr.innerHTML = `<td class='py-2 font-semibold whitespace-nowrap'><span class='inline-flex items-center gap-2 whitespace-nowrap'><span class='w-2 h-2 rounded-full bg-amber-400 shrink-0'></span><span>${t('gear.prefix')} ${idx + 1}'</span></span></td><td class='py-2 whitespace-nowrap'>${ratio.toFixed(2)}:1</td><td class='py-2 text-right font-bold text-white whitespace-nowrap'>${top.toFixed(1)}</td><td class='py-2 text-right font-semibold whitespace-nowrap ${deltaCls}'>${delta}</td><td class='py-2 text-right text-sky-300 whitespace-nowrap'>${power}</td>`;
	return tr;
};

/**
 * @brief Pick the delta color for a comparison row.
 * @param top Secondary top speed in display units.
 * @param primaryTop Primary top speed or undefined when missing.
 * @return Tailwind text class for the delta cell.
 */
const describeDeltaClass = (top: number, primaryTop: number | undefined): string => {
	if (primaryTop === undefined || Math.abs(top - primaryTop) < 0.05) {
		return 'text-gray-500';
	}
	return top > primaryTop ? 'text-emerald-300' : 'text-amber-300';
};

/**
 * @brief Required wheel power at a secondary gear peak.
 * @param top Secondary top speed in the active display unit.
 * @return Display string with drag-limited flag when it exceeds comp power.
 */
const describeCompRoadLoad = (top: number): string => {
	if (!state.roadLoadEnabled) {
		return '-';
	}
	const speedKmh = fromDisplaySpeed(top, state.unit);
	const kw = roadLoadPowerKw(
		speedKmh,
		state.compMassKg,
		state.compCd,
		state.compFrontalAreaM2,
		state.rollingCrr,
		state.roadGradePercent,
	);
	const base = formatPower(kw, state.powerUnit);
	const available = availableWheelKw(state.compPowerKw, state.drivetrainEff);
	return kw > available ? `${base} ${t('table.dragLimited')}` : base;
};

/**
 * Format a top-speed delta with explicit sign.
 * @brief Keep 5-speed vs 6-speed tables readable when gears are missing.
 * @param delta Difference in display units.
 * @return Signed display string.
 */
const formatDelta = (delta: number): string => {
	const sign = delta >= 0 ? '+' : '';
	return `${sign}${delta.toFixed(1)}`;
};
