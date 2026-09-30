/**
 * @file header-bar.ts
 * @brief Live readouts for the fixed top bar chips.
 */
import { state } from '../core/state/app-state';
import { t } from '../core/i18n/language';
import type { ElementRefs } from '../services/dom/element-refs';

/**
 * Refresh the unit/level chip and the active car label.
 * @brief Keeps the header honest after preset loads, unit swaps and level
 * @brief changes without giving the static markup an i18n key per state.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderHeader = (refs: ElementRefs): void => {
	setText('header-unit-label', t(state.unit === 'mph' ? 'header.chipImperial' : 'header.chipMetric'));
	setText('header-level-label', levelLabel().toUpperCase());
	setText('header-car-name', activeCarLabel(refs));
};

/**
 * @brief Resolve the active setup-level label.
 * @return Translated level name.
 */
const levelLabel = (): string => {
	if (state.setupLevel === 'easy') {
		return t('setup.levelEasy');
	}
	if (state.setupLevel === 'medium') {
		return t('setup.levelMedium');
	}
	return t('setup.levelFull');
};

/**
 * Read the selected preset option as the active car label.
 * @brief Falls back to the placeholder while no preset is loaded.
 * @param refs Cached DOM handles.
 * @return Car model string shown in the header trigger.
 */
const activeCarLabel = (refs: ElementRefs): string => {
	const option = refs.presetSelector.selectedOptions[0];
	if (!option || !refs.presetSelector.value) {
		return t('header.presetPlaceholder');
	}
	return option.textContent ?? t('header.presetPlaceholder');
};

/**
 * @brief Write text into one optional element by id.
 * @param id Target element id.
 * @param value Text written with textContent.
 * @return void
 */
const setText = (id: string, value: string): void => {
	const el = document.getElementById(id);
	if (el) {
		el.textContent = value;
	}
};
