/**
 * @file compare-table.ts
 * @brief Secondary comparison table rows, deltas and tire delta caption.
 */
import { state } from '../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { fromDisplaySpeed } from '../core/math/speed-math';
import { availableWheelKw, roadLoadPowerKw } from '../core/math/aero-math';
import { formatPower } from '../core/units/unit-utils';
import { describeAllShiftDeltas } from '../core/math/shift-math';
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
		renderShiftDeltas(primaryCircM);
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
	renderShiftDeltas(primaryCircM);
};

/**
 * Render per-shift landing-RPM and shift-speed deltas under the inputs.
 * @brief DOM replacement for the former canvas ghost callouts.
 * @param primaryCircM Primary tire circumference in metres.
 * @return void
 */
export const renderShiftDeltas = (primaryCircM: number): void => {
	const box = document.getElementById('comp-shift-deltas');
	if (!box) {
		return;
	}
	box.replaceChildren();
	if (!state.compareEnabled) {
		return;
	}
	const compTire = parseTire(state.compTire);
	if (!compTire || state.compGears.length === 0) {
		return;
	}
	const compCircM = effectiveCircumferenceM(compTire, state.rollingFactor);
	const deltas = describeAllShiftDeltas(
		state.gears,
		state.primaryRedline,
		state.primaryFd,
		primaryCircM,
		state.compGears,
		state.compFd,
		compCircM,
		state.compRedline,
		state.unit,
	);
	if (deltas.length === 0) {
		return;
	}
	const title = document.createElement('div');
	title.className = 'font-mono fs-tiny uppercase tracking-wider text-text-muted';
	title.setAttribute('data-i18n', 'compare.shiftDeltas');
	title.textContent = t('compare.shiftDeltas');
	box.appendChild(title);
	for (const d of deltas) {
		const row = document.createElement('div');
		row.className = 'flex justify-between font-mono fs-small';
		const gear = document.createElement('span');
		gear.className = 'text-text-dim';
		gear.textContent = `G${d.fromIndex + 1}>G${d.fromIndex + 2}`;
		const vals = document.createElement('span');
		vals.className = 'text-text-output tabular-nums';
		vals.textContent = `Δn ${signed(Math.round(d.dLandingRpm))} · Δv ${signed(d.dShiftSpeed.toFixed(1))}`;
		row.append(gear, vals);
		box.appendChild(row);
	}
};

/**
 * @brief Format a signed delta value with explicit plus.
 * @param body Rounded value body without sign.
 * @return Signed string.
 */
const signed = (body: number | string): string => {
	return Number(body) >= 0 ? `+${body}` : `${body}`;
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
	tr.className = 'hover:bg-surface-subtle transition-colors';
	const delta = primaryTop === undefined ? '-' : formatDelta(top - primaryTop);
	const deltaCls = describeDeltaClass(top, primaryTop);
	const power = describeCompRoadLoad(top);
	tr.innerHTML = `<td class='td td--tight font-semibold'><span class='inline-flex items-center gap-2 whitespace-nowrap'><span class='w-2 h-2 rounded-full bg-accent-compare shrink-0'></span><span>${t('gear.prefix')} ${idx + 1}'</span></span></td><td class='td td--tight font-semibold text-text-output'>${ratio.toFixed(2)}:1</td><td class='td td--right td--tight font-bold text-text-output'>${top.toFixed(1)}</td><td class='td td--right td--tight font-semibold ${deltaCls}'>${delta}</td><td class='td td--right td--tight text-text-dim hidden md:table-cell'>${power}</td>`;
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
		return 'text-text-muted';
	}
	return top > primaryTop ? 'text-neon-green' : 'text-neon-yellow';
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
