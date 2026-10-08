/**
 * @file header-bar.ts
 * @brief Live readouts for the fixed top bar chips.
 */
import { state } from '../core/state/app-state';
import { t } from '../core/i18n/language';

/**
 * Refresh the unit/level chip.
 * @brief Keeps the header honest after unit swaps and level changes.
 * @return void
 */
export const renderHeader = (): void => {
	setText('header-unit-label', t(state.unit === 'mph' ? 'header.chipImperial' : 'header.chipMetric'));
	setText('header-level-label', levelLabel().toUpperCase());
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
