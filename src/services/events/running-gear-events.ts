/**
 * @file running-gear-events.ts
 * @brief Bind running-gear chassis inputs to primary state.
 */
import { state } from '../../core/state/app-state';
import type { DifferentialType, DrivetrainLayout } from '../../core/models';
import type { ElementRefs } from '../dom/element-refs';
/**
 * @brief Clamp a finite number into [min, max].
 * @param v Raw value.
 * @param min Lower bound.
 * @param max Upper bound.
 * @return Clamped value.
 */
const clamp = (v: number, min: number, max: number): number => {
	if (!Number.isFinite(v)) return min;
	return Math.min(max, Math.max(min, v));
};
/**
 * @brief Dim the LSD bias row unless a clutch LSD is selected.
 * @param refs Cached DOM handles.
 * @return void
 */
export const applyRunningGearVisibility = (refs: ElementRefs): void => {
	const wrap = document.getElementById('rg-bias-wrap');
	if (!wrap) return;
	const active = refs.rgDiff.value === 'clutch_lsd';
	wrap.classList.toggle('opacity-40', !active);
	wrap.classList.toggle('pointer-events-none', !active);
};
/**
 * @brief Bind a numeric input with clamping.
 * @param el Input element.
 * @param min Lower bound.
 * @param max Upper bound.
 * @param apply State writer receiving the clamped value.
 * @param render Full refresh callback.
 * @return void
 */
const bindNum = (el: HTMLInputElement, min: number, max: number, apply: (v: number) => void, render: () => void): void => {
	el.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (!Number.isFinite(v)) return;
		apply(clamp(v, min, max));
		render();
	});
};
/**
 * @brief Bind selects and numeric running-gear inputs.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
const bindRgInputs = (refs: ElementRefs, render: () => void): void => {
	refs.rgLayout.addEventListener('change', (e) => {
		const v = (e.target as HTMLSelectElement).value;
		if (v === 'FWD' || v === 'RWD' || v === 'AWD') {
			state.runningGear.drivetrainLayout = v as DrivetrainLayout;
			render();
		}
	});
	refs.rgDiff.addEventListener('change', (e) => {
		const v = (e.target as HTMLSelectElement).value;
		if (v === 'open' || v === 'clutch_lsd' || v === 'torsen' || v === 'spool') {
			state.runningGear.differentialType = v as DifferentialType;
			applyRunningGearVisibility(refs);
			render();
		}
	});
	bindNum(refs.rgBias, 0, 100, (v) => { state.runningGear.differentialBias = v / 100; }, render);
	bindNum(refs.rgWeight, 40, 70, (v) => { state.runningGear.frontWeightDistribution = v / 100; }, render);
	bindNum(refs.rgCog, 300, 700, (v) => { state.runningGear.centerOfGravityHeightMm = v; }, render);
	bindNum(refs.rgWheelbase, 2200, 3300, (v) => { state.runningGear.wheelbaseMm = v; }, render);
	bindNum(refs.rgTrack, 1300, 1800, (v) => { state.runningGear.trackWidthMm = v; }, render);
	bindNum(refs.rgSpringF, 10, 120, (v) => { state.runningGear.springRateFrontNmm = v; }, render);
	bindNum(refs.rgSpringR, 10, 120, (v) => { state.runningGear.springRateRearNmm = v; }, render);
};
/**
 * @brief Bind running-gear selects, numbers and lateral-G slider.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindRunningGearEvents = (refs: ElementRefs, render: () => void): void => {
	bindRgInputs(refs, render);
	refs.rgLatg.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (!Number.isFinite(v)) return;
		state.runningGear.lateralG = clamp(v, 0, 1.3);
		refs.rgLatgVal.textContent = `${state.runningGear.lateralG.toFixed(2)} G`;
		render();
	});
	refs.rgAccordion.addEventListener('toggle', () => {
		const open = (refs.rgAccordion as HTMLDetailsElement).open;
		refs.rgAccordion.setAttribute('aria-expanded', String(open));
	});
};
/**
 * @brief Sync running-gear controls from primary state.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncRunningGearInputs = (refs: ElementRefs): void => {
	const rg = state.runningGear;
	refs.rgLayout.value = rg.drivetrainLayout;
	refs.rgDiff.value = rg.differentialType;
	refs.rgBias.value = String(Math.round(rg.differentialBias * 100));
	refs.rgWeight.value = String(rg.frontWeightDistribution * 100);
	refs.rgCog.value = String(rg.centerOfGravityHeightMm);
	refs.rgWheelbase.value = String(rg.wheelbaseMm);
	refs.rgTrack.value = String(rg.trackWidthMm);
	refs.rgSpringF.value = String(rg.springRateFrontNmm);
	refs.rgSpringR.value = String(rg.springRateRearNmm);
	refs.rgLatg.value = String(rg.lateralG);
	refs.rgLatgVal.textContent = `${rg.lateralG.toFixed(2)} G`;
	applyRunningGearVisibility(refs);
};
