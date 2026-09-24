/**
 * @file running-gear-events.ts
 * @brief Bind running-gear chassis inputs to primary state.
 */
import { state } from '../../core/state/app-state';
import type { DrivetrainLayout } from '../../core/models';
import { DIFF_PRESETS, LSD_MODEL_IDS, findDiffPreset, modelIdFromType } from '../../config/diff-presets';
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
 * @brief Show lock inputs only for clutch-LSD catalog models.
 * @param refs Cached DOM handles.
 * @return void
 */
export const applyRunningGearVisibility = (refs: ElementRefs): void => {
	const biasWrap = document.getElementById('rg-bias-wrap');
	const coastWrap = document.getElementById('rg-coast-wrap');
	const active = LSD_MODEL_IDS.has(refs.rgDiff.value);
	for (const wrap of [biasWrap, coastWrap]) {
		if (!wrap) continue;
		wrap.classList.toggle('opacity-40', !active);
		wrap.classList.toggle('pointer-events-none', !active);
	}
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
 * @brief Apply a catalog differential model id to running gear.
 * @param modelId Catalog id from the select.
 * @return void
 */
const applyDiffModel = (modelId: string): void => {
	const preset = findDiffPreset(modelId);
	if (!preset) return;
	state.runningGear.differentialType = preset.type;
	state.runningGear.differentialModelId = preset.id;
	if (LSD_MODEL_IDS.has(preset.id) && preset.id !== 'lsd_custom') {
		state.runningGear.differentialBias = preset.accLock;
		state.runningGear.differentialCoastBias = preset.coastLock;
	} else if (preset.id === 'lsd_custom') {
		state.runningGear.differentialCoastBias = state.runningGear.differentialCoastBias ?? 0;
	} else if (preset.id === 'open') {
		state.runningGear.differentialCoastBias = 0;
	} else if (preset.id === 'spool') {
		state.runningGear.differentialBias = 1;
		state.runningGear.differentialCoastBias = 1;
	} else if (preset.id === 'torsen') {
		state.runningGear.differentialCoastBias = 0;
	}
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
		if (DIFF_PRESETS.some((p) => p.id === v)) {
			applyDiffModel(v);
			applyRunningGearVisibility(refs);
			syncLockInputs(refs);
			render();
		}
	});
	bindNum(refs.rgBias, 0, 100, (v) => {
		state.runningGear.differentialBias = v / 100;
		state.runningGear.differentialModelId = state.runningGear.differentialModelId || 'lsd_custom';
	}, render);
	bindNum(refs.rgCoast, 0, 100, (v) => {
		state.runningGear.differentialCoastBias = v / 100;
	}, render);
	bindNum(refs.rgWeight, 40, 70, (v) => { state.runningGear.frontWeightDistribution = v / 100; }, render);
	bindNum(refs.rgCog, 300, 700, (v) => { state.runningGear.centerOfGravityHeightMm = v; }, render);
	bindNum(refs.rgWheelbase, 2200, 3300, (v) => { state.runningGear.wheelbaseMm = v; }, render);
	bindNum(refs.rgTrack, 1300, 1800, (v) => { state.runningGear.trackWidthMm = v; }, render);
	bindNum(refs.rgSpringF, 10, 120, (v) => { state.runningGear.springRateFrontNmm = v; }, render);
	bindNum(refs.rgSpringR, 10, 120, (v) => { state.runningGear.springRateRearNmm = v; }, render);
};

/**
 * @brief Write accel/coast lock percentages into the numeric inputs.
 * @param refs Cached DOM handles.
 * @return void
 */
const syncLockInputs = (refs: ElementRefs): void => {
	refs.rgBias.value = String(Math.round(state.runningGear.differentialBias * 100));
	refs.rgCoast.value = String(Math.round((state.runningGear.differentialCoastBias ?? 0) * 100));
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
	refs.rgDiff.value = rg.differentialModelId ?? modelIdFromType(rg.differentialType);
	if (!findDiffPreset(refs.rgDiff.value)) {
		refs.rgDiff.value = modelIdFromType(rg.differentialType);
	}
	rg.differentialModelId = refs.rgDiff.value;
	syncLockInputs(refs);
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
