/**
 * @file unit-events.ts
 * @brief Bind kmh/mph and kW/cv toggle buttons with localStorage persistence.
 */
import { state } from '../../core/state/app-state';
import {
	formatPower,
	formatPowerInput,
	fromDisplayPower,
	getPowerUnitLabel,
	getUnitLabel,
	storePowerUnit,
	storeUnit,
} from '../../core/units/unit-utils';
import type { PowerUnit } from '../../core/models';
import { powerFromTorque } from '../../core/math/traction-math';
import type { ElementRefs } from '../dom/element-refs';

const ACTIVE_BTN = 'px-3 py-1 text-xs font-semibold rounded bg-gray-200 text-black';
const IDLE_BTN = 'px-3 py-1 text-xs font-semibold rounded text-gray-400 hover:text-white';

/**
 * Bind kmh/mph toggle buttons.
 * @brief Switch display unit, persist it and refresh labels.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindUnitEvents = (refs: ElementRefs, render: () => void): void => {
	refs.unitKmh.addEventListener('click', () => {
		if (state.unit === 'kmh') {
			return;
		}
		state.unit = 'kmh';
		storeUnit('kmh');
		refs.unitKmh.className = ACTIVE_BTN;
		refs.unitMph.className = IDLE_BTN;
		applyUnitLabels(refs);
		if (state.maxGraphSpeed === 180) {
			state.maxGraphSpeed = 300;
			refs.graphMaxSpeed.value = '300';
		}
		render();
	});
	refs.unitMph.addEventListener('click', () => {
		if (state.unit === 'mph') {
			return;
		}
		state.unit = 'mph';
		storeUnit('mph');
		refs.unitMph.className = ACTIVE_BTN;
		refs.unitKmh.className = IDLE_BTN;
		applyUnitLabels(refs);
		if (state.maxGraphSpeed === 300) {
			state.maxGraphSpeed = 180;
			refs.graphMaxSpeed.value = '180';
		}
		render();
	});
	bindPowerUnitEvents(refs, render);
};

/**
 * Bind kW/cv power unit toggle buttons.
 * @brief Switch power display unit, persist it and refresh labels/inputs.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
const bindPowerUnitEvents = (refs: ElementRefs, render: () => void): void => {
	refs.powerUnitKw.addEventListener('click', () => setPowerUnit(refs, 'kw', render));
	refs.powerUnitCv.addEventListener('click', () => setPowerUnit(refs, 'cv', render));
};

/**
 * Apply a power unit choice.
 * @brief No-op when already active; otherwise persist, restyle and refresh inputs.
 * @param refs Cached DOM handles.
 * @param unit Requested power unit.
 * @param render Full refresh callback.
 * @return void
 */
const setPowerUnit = (refs: ElementRefs, unit: PowerUnit, render: () => void): void => {
	if (state.powerUnit === unit) {
		return;
	}
	const previous = state.powerUnit;
	state.powerUnit = unit;
	storePowerUnit(unit);
	convertPowerInputs(refs, previous, unit);
	syncPowerUnitToggle(refs);
	applyPowerLabels(refs);
	render();
};

/**
 * Re-express every power input in the new display unit.
 * @brief Converts free-form fields from the previous unit and re-syncs state-backed ones.
 * @param refs Cached DOM handles.
 * @param previous Unit the inputs currently show.
 * @param unit New display unit.
 * @return void
 */
const convertPowerInputs = (refs: ElementRefs, previous: PowerUnit, unit: PowerUnit): void => {
	refs.powerInput.value = formatPowerInput(state.enginePowerKw, unit);
	refs.compPower.value = formatPowerInput(state.compPowerKw, unit);
	const customRaw = parseFloat(refs.customPower.value);
	if (Number.isFinite(customRaw) && customRaw > 0) {
		refs.customPower.value = formatPowerInput(fromDisplayPower(customRaw, previous), unit);
	}
	syncEnginePowerAt(refs);
};

/**
 * Refresh the derived power-at-torque-peak readout in the active unit.
 * @param refs Cached DOM handles.
 * @return void
 */
const syncEnginePowerAt = (refs: ElementRefs): void => {
	refs.powerAtDisplay.value = formatPower(powerFromTorque(state.peakTorqueNm, state.peakTorqueRpm), state.powerUnit);
};

/**
 * Update every unit caption in the layout.
 * @brief Keep table and input labels in sync.
 * @param refs Cached DOM handles.
 * @return void
 */
export const applyUnitLabels = (refs: ElementRefs): void => {
	refs.unitLabels.forEach((el) => {
		el.textContent = getUnitLabel(state.unit);
	});
	applyPowerLabels(refs);
};

/**
 * Update every power unit caption in the layout.
 * @brief Keep kW/cv suffixes next to power labels in sync.
 * @param refs Cached DOM handles.
 * @return void
 */
export const applyPowerLabels = (refs: ElementRefs): void => {
	const label = getPowerUnitLabel(state.powerUnit);
	refs.powerUnitLabels.forEach((el) => {
		el.textContent = label;
	});
};

/**
 * Sync kmh/mph toggle styling from state.
 * @brief Mirror toggle styling without triggering render.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncUnitToggle = (refs: ElementRefs): void => {
	refs.unitKmh.className = state.unit === 'kmh' ? ACTIVE_BTN : IDLE_BTN;
	refs.unitMph.className = state.unit === 'mph' ? ACTIVE_BTN : IDLE_BTN;
};

/**
 * Sync kW/cv toggle styling from state.
 * @brief Mirror power toggle styling without triggering render.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncPowerUnitToggle = (refs: ElementRefs): void => {
	refs.powerUnitKw.className = state.powerUnit === 'kw' ? ACTIVE_BTN : IDLE_BTN;
	refs.powerUnitCv.className = state.powerUnit === 'cv' ? ACTIVE_BTN : IDLE_BTN;
};
