/**
 * @file preset-events.ts
 * @brief Primary preset apply plus dropdown wiring (never touches comp slots).
 */
import { state, defaultRunningGear } from '../../core/state/app-state';
import { presetGroups, presetMeta, presets } from '../../config/presets';
import { CUSTOM_PREFIX, loadCustomPresets } from '../../core/presets/custom-store';
import type { GearPreset } from '../../core/models';
import type { ElementRefs } from '../dom/element-refs';
import { renderGearsList } from '../../components/gear-list';
import { enhancePresetSearch } from '../../components/preset-search';
import { t } from '../../core/i18n/language';
import { efficiencyForLayout } from '../../config/drivetrain-eff';
import { syncEngineInputs } from './engine-events';
import { syncRoadLoadInputs } from './road-load-events';
import { syncRunningGearInputs } from './running-gear-events';

/** Catalog group to i18n group label key. */
const GROUP_LABEL_KEYS: Record<string, 'preset.groupFactory' | 'preset.groupCommunity'> = {
	factory: 'preset.groupFactory',
	community: 'preset.groupCommunity',
};

/**
 * @brief Apply a preset to state and refresh every dependent control.
 * @brief Clears any custom dyno curve and maps the default drivetrain
 * @brief efficiency to the preset running-gear layout.
 * @param refs Cached DOM handles.
 * @param preset Preset data, built-in or user-defined.
 * @param render Full refresh callback.
 * @return void
 */
export const applyPreset = (refs: ElementRefs, preset: GearPreset, render: () => void): void => {
	state.primaryTire = preset.tire;
	state.primaryFd = preset.fd;
	state.primaryRedline = preset.redline;
	state.gears = [...preset.gears];
	state.reverseRatio = preset.reverseRatio ?? null;
	if (preset.massKg !== undefined) {
		state.vehicleMassKg = preset.massKg;
	}
	if (preset.dragCd !== undefined) {
		state.dragCd = preset.dragCd;
	}
	if (preset.frontalAreaM2 !== undefined) {
		state.frontalAreaM2 = preset.frontalAreaM2;
	}
	if (preset.powerKw !== undefined) {
		state.enginePowerKw = preset.powerKw;
	}
	if (preset.peakTorqueRpm !== undefined) {
		state.peakTorqueRpm = preset.peakTorqueRpm;
	}
	if (preset.peakTorqueNm !== undefined) {
		state.peakTorqueNm = preset.peakTorqueNm;
	}
	if (preset.peakPowerRpm !== undefined) {
		state.peakPowerRpm = preset.peakPowerRpm;
	}
	state.rotatingMassKg = preset.rotatingMassKg ?? 0;
	state.shiftTimeS = preset.shiftTimeS ?? 0;
	state.torqueCurvePoints = null;
	if (preset.runningGear !== undefined) {
		state.runningGear = { ...defaultRunningGear, ...preset.runningGear };
		state.drivetrainEff = efficiencyForLayout(state.runningGear.drivetrainLayout);
	}
	refs.primaryTire.value = preset.tire;
	refs.primaryFd.value = String(preset.fd);
	refs.primaryRedline.value = String(preset.redline);
	syncRoadLoadInputs(refs);
	syncEngineInputs(refs);
	syncRunningGearInputs(refs);
	renderGearsList(refs, () => render());
	render();
};

/**
 * @brief Resolve a dropdown value to preset data.
 * @param value Selected option value, possibly a custom: prefixed name.
 * @return Preset data or null for unknown values.
 */
const resolvePreset = (value: string): GearPreset | null => {
	if (value.startsWith(CUSTOM_PREFIX)) {
		return loadCustomPresets()[value.slice(CUSTOM_PREFIX.length)] ?? null;
	}
	return presets[value] ?? null;
};

/**
 * @brief Build grouped factory/community options in a preset selector.
 * @param select Target dropdown element.
 * @return void
 */
export const buildPresetOptions = (select: HTMLSelectElement): void => {
	const placeholder = select.querySelector('option[value=""]');
	const customs = Array.from(select.options).filter((o) => o.value.startsWith(CUSTOM_PREFIX));
	select.innerHTML = '';
	if (placeholder) {
		select.appendChild(placeholder);
	}
	for (const group of Object.keys(presetGroups)) {
		const ids = presetGroups[group];
		if (!ids || ids.length === 0) {
			continue;
		}
		const optgroup = document.createElement('optgroup');
		optgroup.label = t(GROUP_LABEL_KEYS[group] ?? 'preset.groupFactory');
		for (const id of ids) {
			const option = document.createElement('option');
			option.value = id;
			option.textContent = presetMeta[id]?.label ?? id;
			optgroup.appendChild(option);
		}
		select.appendChild(optgroup);
	}
	for (const custom of customs) {
		select.appendChild(custom);
	}
};

/**
 * @brief Rebuild the user-preset section of both dropdowns.
 * @param refs Cached DOM handles.
 * @return void
 */
export const refreshPresetOptions = (refs: ElementRefs): void => {
	buildPresetOptions(refs.presetSelector);
	buildPresetOptions(refs.btnLoadPresetComp);
	appendCustomOptions(refs.presetSelector);
	appendCustomOptions(refs.btnLoadPresetComp);
};

/**
 * @brief Append custom presets to a selector without duplicates.
 * @param selector Target dropdown element.
 * @return void
 */
const appendCustomOptions = (selector: HTMLSelectElement): void => {
	for (const option of Array.from(selector.options)) {
		if (option.value.startsWith(CUSTOM_PREFIX)) {
			option.remove();
		}
	}
	for (const name of Object.keys(loadCustomPresets()).sort()) {
		const option = document.createElement('option');
		option.value = `${CUSTOM_PREFIX}${name}`;
		option.textContent = name;
		selector.appendChild(option);
	}
};

/**
 * @brief Bind the preset vehicle dropdown.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindPresetEvents = (refs: ElementRefs, render: () => void): void => {
	buildPresetOptions(refs.presetSelector);
	buildPresetOptions(refs.btnLoadPresetComp);
	enhancePresetSearch(refs.presetSelector);
	refs.presetSelector.addEventListener('change', (e) => {
		const preset = resolvePreset((e.target as HTMLSelectElement).value);
		if (!preset) {
			return;
		}
		applyPreset(refs, preset, render);
	});
};
