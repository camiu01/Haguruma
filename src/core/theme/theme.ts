/**
 * @file theme.ts
 * @brief OLED / dark / light theme state with DOM application.
 */

/** Supported UI themes. */
export type Theme = 'dark' | 'oled' | 'light';

const STORAGE_KEY = 'haguruma-theme';

/** Currently active theme. */
let currentTheme: Theme = 'dark';

/**
 * @brief Check for a browser DOM (false under vitest node environment).
 * @return True when document may be touched.
 */
const hasDom = (): boolean => typeof document !== 'undefined';

/**
 * @brief Get the active theme.
 * @return Active theme code.
 */
export const getTheme = (): Theme => currentTheme;

/**
 * @brief Validate a raw theme value.
 * @param raw Candidate value from storage or URL.
 * @return Theme or null when invalid.
 */
export const parseTheme = (raw: string | null): Theme | null => {
	if (raw === 'dark' || raw === 'oled' || raw === 'light') {
		return raw;
	}
	return null;
};

/**
 * @brief Set the active theme, persist it and update the DOM.
 * @param theme Theme to activate.
 * @return void
 */
export const setTheme = (theme: Theme): void => {
	currentTheme = theme;
	try {
		if (hasDom()) {
			window.localStorage.setItem(STORAGE_KEY, theme);
		}
	} catch {
		return;
	}
	applyThemeToDom();
};

/**
 * @brief Apply the active theme to the document element.
 * @return void
 */
export const applyThemeToDom = (): void => {
	if (!hasDom()) {
		return;
	}
	document.documentElement.dataset.theme = currentTheme;
	document.documentElement.classList.toggle('dark', currentTheme !== 'light');
};

/**
 * @brief Restore the persisted theme on startup.
 * @return Active theme after restore.
 */
export const initTheme = (): Theme => {
	if (!hasDom()) {
		return currentTheme;
	}
	try {
		const stored = parseTheme(window.localStorage.getItem(STORAGE_KEY));
		if (stored) {
			currentTheme = stored;
		}
	} catch {
		return currentTheme;
	}
	applyThemeToDom();
	return currentTheme;
};
