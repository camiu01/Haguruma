/**
 * @file theme-events.ts
 * @brief Bind single theme toggle cycling dark -> oled -> light.
 */
import { getTheme, setTheme, type Theme } from '../../core/theme/theme';
import type { ElementRefs } from '../dom/element-refs';

/**
 * @brief Theme labels shown inside the single toggle button.
 * @return Record mapping each theme to its button label.
 */
const themeLabels = (): Record<Theme, string> => ({
	dark: 'Dark',
	oled: 'OLED',
	light: 'Light',
});

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
 * @brief Bind the single theme toggle button.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindThemeEvents = (refs: ElementRefs, render: () => void): void => {
	refs.themeToggle.addEventListener('click', () => {
		setTheme(nextTheme(getTheme()));
		syncThemeToggle(refs);
		render();
	});
};

/**
 * @brief Sync the toggle button label from state.
 * @brief Keep header button aligned after restore or share load.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncThemeToggle = (refs: ElementRefs): void => {
	const active = getTheme();
	refs.themeToggle.textContent = themeLabels()[active];
	refs.themeToggle.setAttribute('aria-label', `Theme: ${active}`);
	refs.themeToggle.setAttribute('aria-checked', String(active !== 'light'));
	refs.themeToggle.title = `Theme: ${active} (click to switch)`;
};
