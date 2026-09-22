/**
 * @file language.ts
 * @brief Active language state, translation lookup and DOM application.
 */
import { dictionaries, type DictKey, type Lang } from './dictionaries';

const STORAGE_KEY = 'haguruma-lang';

/** Currently active interface language. */
let currentLang: Lang = 'en';

/**
 * @brief Check for a browser DOM (false under vitest node environment).
 * @return True when document and localStorage may be touched.
 */
const hasDom = (): boolean => typeof document !== 'undefined';

/**
 * @brief Read the persisted language without throwing on restricted storage.
 * @return Stored language or English by default.
 */
const readStoredLang = (): Lang => {
	if (!hasDom()) {
		return 'en';
	}
	try {
		return window.localStorage.getItem(STORAGE_KEY) === 'it' ? 'it' : 'en';
	} catch {
		return 'en';
	}
};

/**
 * @brief Persist the language choice without throwing on restricted storage.
 * @param lang Language to persist.
 * @return void
 */
const storeLang = (lang: Lang): void => {
	if (!hasDom()) {
		return;
	}
	try {
		window.localStorage.setItem(STORAGE_KEY, lang);
	} catch {
		return;
	}
};

/**
 * @brief Get the active language.
 * @return Active language code.
 */
export const getLang = (): Lang => currentLang;

/**
 * @brief Set the active language and persist the choice.
 * @param lang Language to activate.
 * @return void
 */
export const setLang = (lang: Lang): void => {
	currentLang = lang;
	storeLang(lang);
	if (hasDom()) {
		document.documentElement.lang = lang;
	}
};

/**
 * @brief Translate a dictionary key with English fallback.
 * @param key Dictionary key.
 * @param lang Language override, defaults to the active language.
 * @return Translated string, English text, or the key itself.
 */
export const t = (key: DictKey, lang: Lang = currentLang): string => {
	return dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
};

/**
 * @brief Apply the active language to every tagged static element.
 * @brief Elements use data-i18n for text, data-i18n-ph for placeholders, data-i18n-tip for tooltips.
 * @return void
 */
export const applyI18n = (): void => {
	if (!hasDom()) {
		return;
	}
	document.querySelectorAll('[data-i18n]').forEach((el) => {
		const key = (el as HTMLElement).dataset.i18n as DictKey | undefined;
		if (key) {
			el.textContent = t(key);
		}
	});
	document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
		const key = (el as HTMLElement).dataset.i18nPh as DictKey | undefined;
		if (key) {
			(el as HTMLInputElement).placeholder = t(key);
		}
	});
	document.querySelectorAll('[data-i18n-tip]').forEach((el) => {
		const key = (el as HTMLElement).dataset.i18nTip as DictKey | undefined;
		if (key) {
			el.setAttribute('title', t(key));
			el.setAttribute('data-tip', t(key));
			el.setAttribute('aria-label', t(key));
		}
	});
};

/**
 * @brief Restore the persisted language on startup.
 * @return Active language after restore.
 */
export const initLang = (): Lang => {
	currentLang = readStoredLang();
	if (hasDom()) {
		document.documentElement.lang = currentLang;
	}
	applyI18n();
	return currentLang;
};
