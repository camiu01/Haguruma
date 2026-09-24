/**
 * @file compare-table.ts
 * @brief Secondary comparison table rows, deltas and tire delta caption.
 */
import { state } from '../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { fromDisplaySpeed } from '../core/math/speed-math';
import { availableWheelKw, roadLoadPowerKw } from '../core/math/aero-math';
import { formatPower } from '../core/units/unit-utils';
import { topsForSetup } from '../core/compare/compare-utils';
import { t } from '../core/i18n/language';
import type { ElementRefs } from '../services/dom/element-refs';

/**
 * Update the secondary tire delta caption.
 * @brief Show rolling-circumference difference in percent.
 * @param refs Cached DOM handles.
 * @return void
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
 * @return void
 */
export const renderCompareTable = (refs: ElementRefs, primaryCircM: number): void => {
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
