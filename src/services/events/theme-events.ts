/**
 * @file theme-events.ts
 * @brief Theme sync entry (switching lives in the drawer segment).
 */
import type { ElementRefs } from '../dom/element-refs';
import type { Theme } from '../../core/theme/theme';
import { syncThemeSegment } from './drawer-utils-events';

/**
 * @brief Get the next theme in the dark -> oled -> light cycle.
 * @param theme Current active theme.
 * @return Next theme to activate.
 */
export const nextTheme = (theme: Theme): Theme => {
	if (theme === 'dark') {
		return 'oled';
	}
	if (theme === 'oled') {
		return 'light';
	}
	return 'dark';
};

/**
 * @brief Bind theme controls (drawer segment owns its listeners).
 * @param _refs Cached DOM handles, kept for signature consistency.
 * @param _render Full refresh callback, kept for signature consistency.
 * @return void
 */
export const bindThemeEvents = (_refs: ElementRefs, _render: () => void): void => {
	return;
};

/**
 * @brief Sync the drawer theme segment from state.
 * @brief Keep selection truthful after restore or share load.
 * @param _refs Cached DOM handles, kept for signature consistency.
 * @return void
 */
export const syncThemeToggle = (_refs: ElementRefs): void => {
	syncThemeSegment();
};
