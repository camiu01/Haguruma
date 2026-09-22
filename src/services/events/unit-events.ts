/**
 * @file unit-events.ts
 * @brief Bind kmh/mph toggle buttons with localStorage persistence.
 */
import { state } from '../../core/state/app-state';
import { getUnitLabel, storeUnit } from '../../core/units/unit-utils';
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
