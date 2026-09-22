/**
 * @file gear-table.ts
 * @brief Primary breakdown table plus isolated secondary comparison rows.
 */
import { state } from '../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { calculateSpeed } from '../core/math/speed-math';
import { describeUpshift } from '../core/math/shift-math';
import {
	dynamicRadiusM,
	engineTorqueAt,
	optimalShiftsForAll,
	tractiveForceAt,
	validateCurve,
} from '../core/math/traction-math';
import { availableWheelKw, kwToHp, roadLoadPowerKw } from '../core/math/aero-math';
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
	const { nextRpmDisplay, dropDisplay } = describeShift(circM, topSpeed, idx);
	const powerDisplay = describeRoadLoad(topSpeed);
	const { torqueDisplay, forceDisplay, shiftDisplay } = describeTraction(circM, gearRatio, idx);
	const tr = document.createElement('tr');
	tr.className = 'hover:bg-gauge/80 transition-colors';
	tr.innerHTML = `<td class='py-2.5 pr-2 font-semibold whitespace-nowrap'><span class='inline-flex items-center gap-2 whitespace-nowrap'><span class='w-2 h-2 rounded-full shrink-0' style='background-color: ${getGearColor(idx)}'></span><span>${t('gear.prefix')} ${idx + 1}</span></span></td><td class='py-2.5 whitespace-nowrap'>${gearRatio.toFixed(2)}:1</td><td class='py-2.5 text-gray-400 whitespace-nowrap'>${overallRatio}:1</td><td class='py-2.5 text-right font-bold text-white whitespace-nowrap'>${topSpeed.toFixed(1)}</td><td class='py-2.5 text-right text-rose-300 whitespace-nowrap'>${nextRpmDisplay}</td><td class='py-2.5 text-right text-rose-400 font-semibold whitespace-nowrap'>${dropDisplay}</td><td class='py-2.5 text-right text-sky-300 whitespace-nowrap'>${powerDisplay}</td><td class='py-2.5 text-right text-amber-300 whitespace-nowrap'>${torqueDisplay}</td><td class='py-2.5 text-right text-emerald-300 whitespace-nowrap'>${forceDisplay}</td><td class='py-2.5 text-right text-violet-300 whitespace-nowrap'>${shiftDisplay}</td>`;
	return tr;
};

/**
 * Describe the secondary road-load power at a gear peak.
 * @brief Show required wheel power in kW and metric hp (cv).
 * @param topSpeed Theoretical top speed in the active display unit.
 * @return Display string such as 45.2 kW (61.5 cv), flagged when drag-limited.
 */
const describeRoadLoad = (topSpeed: number): string => {
	if (!state.roadLoadEnabled) {
		return '-';
	}
	const speedKmh = state.unit === 'mph' ? topSpeed / 0.621371 : topSpeed;
	const kw = roadLoadPowerKw(
		speedKmh,
		state.vehicleMassKg,
		state.dragCd,
		state.frontalAreaM2,
		state.rollingCrr,
		state.roadGradePercent,
	);
	const base = `${kw.toFixed(1)} kW (${kwToHp(kw).toFixed(1)} cv)`;
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
	tr.className = 'hover:bg-gauge/80 transition-colors';
	tr.innerHTML = `<td class='py-2.5 pr-2 font-semibold whitespace-nowrap'><span class='inline-flex items-center gap-2 whitespace-nowrap'><span class='w-2 h-2 rounded-full bg-gray-400 shrink-0'></span><span>${t('gear.reverse')}</span></span></td><td class='py-2.5 whitespace-nowrap'>${ratio.toFixed(2)}:1</td><td class='py-2.5 text-gray-400 whitespace-nowrap'>${overallRatio}:1</td><td class='py-2.5 text-right font-bold text-white whitespace-nowrap'>${topSpeed.toFixed(1)}</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td><td class='py-2.5 text-right text-sky-300 whitespace-nowrap'>${powerDisplay}</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td><td class='py-2.5 text-right text-gray-500 whitespace-nowrap'>-</td>`;
	return tr;
};
/**
 * Describe the RPM landing in the next gear.
 * @brief Compute display strings for the shift columns.
 * @param circM Tire circumference in metres.
 * @param topSpeed Redline top speed of the current gear.
 * @param idx Zero-based gear index.
 * @return Next-RPM and drop display strings.
 */
const describeShift = (
	circM: number,
	topSpeed: number,
	idx: number,
): { nextRpmDisplay: string; dropDisplay: string } => {
	if (idx >= state.gears.length - 1) {
		return { nextRpmDisplay: '-', dropDisplay: '-' };
	}
	const step = describeUpshift(state.gears, idx, state.primaryRedline, state.primaryFd, circM, state.unit);
	if (!step) {
		return { nextRpmDisplay: '-', dropDisplay: '-' };
	}
	void topSpeed;
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
	if (th) {
		th.textContent = t('th.power');
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
	tr.className = 'hover:bg-gauge/80 transition-colors';
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
	const speedKmh = state.unit === 'mph' ? top / 0.621371 : top;
	const kw = roadLoadPowerKw(
		speedKmh,
		state.compMassKg,
		state.compCd,
		state.compFrontalAreaM2,
		state.rollingCrr,
		state.roadGradePercent,
	);
	const base = `${kw.toFixed(1)} kW (${kwToHp(kw).toFixed(1)} cv)`;
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
