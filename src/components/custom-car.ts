/**
 * @file custom-car.ts
 * @brief Save, load, export and import user-defined car presets.
 */
import { parseTire } from '../core/math/tire-math';
import { deleteCustomPreset, loadCustomPresets, parseGearsInput, saveCustomPreset, CUSTOM_PREFIX } from '../core/presets/custom-store';
import { fromDisplayPower } from '../core/units/unit-utils';
import { state } from '../core/state/app-state';
import { t } from '../core/i18n/language';
import type { ElementRefs } from '../services/dom/element-refs';
import type { GearPreset } from '../core/models';
import { applyPreset, refreshPresetOptions } from '../services/events/preset-events';
import { applyCompPresetData } from '../services/events/comparison-events';

/** Target slot for a custom preset apply. */
export type CustomTarget = 'primary' | 'compare';

const INVALID_CLASS = 'border-rose-500';

/**
 * @brief Mark an input as valid or invalid.
 * @param input Input to mark.
 * @param valid Validation outcome.
 * @return Validation outcome for chaining.
 */
const mark = (input: HTMLInputElement, valid: boolean): boolean => {
	input.classList.toggle(INVALID_CLASS, !valid);
	return valid;
};

/**
 * @brief Parse a positive number from an input.
 * @param input Input holding the raw value.
 * @return Positive number or null when invalid.
 */
const positive = (input: HTMLInputElement): number | null => {
	const v = parseFloat(input.value);
	return v > 0 ? v : null;
};

/**
 * @brief Parse a non-negative number from an input.
 * @param input Input holding the raw value.
 * @return Non-negative number or null when invalid.
 */
const nonNeg = (input: HTMLInputElement): number | null => {
	const v = parseFloat(input.value);
	return Number.isFinite(v) && v >= 0 ? v : null;
};

/**
 * @brief Read and strictly validate the custom car form.
 * @param refs Cached DOM handles.
 * @return Car name plus preset data, or null with fields marked.
 */
const readCustomForm = (refs: ElementRefs): { name: string; preset: GearPreset } | null => {
	const name = refs.customName.value.trim();
	const gears = parseGearsInput(refs.customGears.value);
	const tire = parseTire(refs.customTire.value.trim());
	const fd = positive(refs.customFd);
	const redline = positive(refs.customRedline);
	const mass = positive(refs.customMass);
	const cd = positive(refs.customCd);
	const area = positive(refs.customArea);
	const power = positive(refs.customPower);
	const torqueRpm = positive(refs.customTorqueRpm);
	const torque = positive(refs.customTorque);
	const powerRpm = positive(refs.customPowerRpm);
	const reverseRaw = refs.customReverse.value.trim();
	const reverse = reverseRaw === '' ? null : positive(refs.customReverse);
	const rotRaw = refs.customRotMass.value.trim();
	const rotMass = rotRaw === '' ? null : nonNeg(refs.customRotMass);
	const shiftRaw = refs.customShiftTime.value.trim();
	const shiftTime = shiftRaw === '' ? null : nonNeg(refs.customShiftTime);
	const ok =
		mark(refs.customName, name.length > 0) &&
		mark(refs.customTire, tire !== null) &&
		mark(refs.customFd, fd !== null) &&
		mark(refs.customRedline, redline !== null && redline >= 1000) &&
		mark(refs.customGears, gears !== null) &&
		mark(refs.customReverse, reverseRaw === '' || reverse !== null) &&
		mark(refs.customRotMass, rotRaw === '' || rotMass !== null) &&
		mark(refs.customShiftTime, shiftRaw === '' || (shiftTime !== null && shiftTime <= 3)) &&
		mark(refs.customMass, mass !== null) &&
		mark(refs.customCd, cd !== null) &&
		mark(refs.customArea, area !== null) &&
		mark(refs.customPower, power !== null) &&
		mark(refs.customTorqueRpm, torqueRpm !== null) &&
		mark(refs.customTorque, torque !== null) &&
		mark(refs.customPowerRpm, powerRpm !== null);
	if (!ok || !gears || !tire || fd === null || redline === null || mass === null || cd === null || area === null || power === null || torqueRpm === null || torque === null || powerRpm === null) {
		return null;
	}
	return {
		name,
		preset: {
			tire: refs.customTire.value.trim(),
			fd,
			redline: Math.round(redline),
			gears,
			reverseRatio: reverse ?? undefined,
			massKg: mass,
			dragCd: cd,
			frontalAreaM2: area,
			powerKw: fromDisplayPower(power, state.powerUnit),
			peakTorqueRpm: Math.round(torqueRpm),
			peakTorqueNm: torque,
			peakPowerRpm: Math.round(powerRpm),
			rotatingMassKg: rotMass ?? undefined,
			shiftTimeS: shiftTime ?? undefined,
		},
	};
};

/**
 * @brief Render the saved-cars list with load and delete actions.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const renderCustomList = (refs: ElementRefs, render: () => void): void => {
	const customs = loadCustomPresets();
	const names = Object.keys(customs).sort();
	refs.customList.innerHTML = '';
	if (names.length === 0) {
		const empty = document.createElement('p');
		empty.className = 'text-xs text-gray-500';
		empty.textContent = t('custom.empty');
		refs.customList.appendChild(empty);
		return;
	}
	for (const name of names) {
		const preset = customs[name];
		const row = document.createElement('div');
		row.className = 'flex items-center gap-2 border border-gray-800 rounded-lg px-3 py-1.5';
		const label = document.createElement('span');
		label.className = 'flex-1 text-xs text-gray-200 truncate';
		label.textContent = name;
		label.title = name;
		const loadPrimary = document.createElement('button');
		loadPrimary.type = 'button';
		loadPrimary.className = 'text-xs text-gray-400 hover:text-white transition-colors';
		loadPrimary.textContent = t('custom.load');
		loadPrimary.title = t('custom.loadPrimary');
		loadPrimary.addEventListener('click', () => {
			refs.presetSelector.value = `${CUSTOM_PREFIX}${name}`;
			applyPreset(refs, preset, render);
		});
		const loadComp = document.createElement('button');
		loadComp.type = 'button';
		loadComp.className = 'text-xs text-amber-400/80 hover:text-amber-300 transition-colors';
		loadComp.textContent = t('custom.loadCompare');
		loadComp.addEventListener('click', () => {
			applyCustomToSlot(refs, preset, 'compare', render);
		});
		const exportBtn = document.createElement('button');
		exportBtn.type = 'button';
		exportBtn.className = 'text-xs text-gray-500 hover:text-sky-400 transition-colors';
		exportBtn.textContent = t('custom.export');
		exportBtn.addEventListener('click', () => {
			const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
			a.click();
			URL.revokeObjectURL(url);
		});
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'text-xs text-gray-500 hover:text-rose-400 transition-colors';
		remove.textContent = t('custom.delete');
		remove.addEventListener('click', () => {
			deleteCustomPreset(name);
			refreshPresetOptions(refs);
			renderCustomList(refs, render);
			render();
		});
		row.append(label, loadPrimary, loadComp, exportBtn, remove);
		refs.customList.appendChild(row);
	}
};

/**
 * @brief Route a custom preset to the primary or comparison slot.
 * @param refs Cached DOM handles.
 * @param preset Custom preset data.
 * @param target Slot receiving the preset.
 * @param render Full refresh callback.
 * @return void
 */
export const applyCustomToSlot = (refs: ElementRefs, preset: GearPreset, target: CustomTarget, render: () => void): void => {
	if (target === 'compare') {
		applyCompPresetData(refs, preset, render);
		return;
	}
	applyPreset(refs, preset, render);
};

/**
 * @brief Bind the save button: validate, persist, select and apply.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindCustomCar = (refs: ElementRefs, render: () => void): void => {
	refs.btnSaveCustom.addEventListener('click', () => {
		applyCustomFormToSlot(refs, 'primary', render);
	});
};

/**
 * @brief Validate the form then save and apply it to one slot.
 * @param refs Cached DOM handles.
 * @param target Slot receiving the saved preset.
 * @param render Full refresh callback.
 * @return True when the form was valid and applied.
 */
export const applyCustomFormToSlot = (refs: ElementRefs, target: CustomTarget, render: () => void): boolean => {
	const parsed = readCustomForm(refs);
	refs.customError.classList.toggle('hidden', parsed !== null);
	if (!parsed) {
		return false;
	}
	saveCustomPreset(parsed.name, parsed.preset);
	refreshPresetOptions(refs);
	if (target === 'compare') {
		applyCompPresetData(refs, parsed.preset, render);
	} else {
		refs.presetSelector.value = `${CUSTOM_PREFIX}${parsed.name}`;
		applyPreset(refs, parsed.preset, render);
	}
	renderCustomList(refs, render);
	return true;
};
