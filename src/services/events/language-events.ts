/**
 * @file language-events.ts
 * @brief Bind the interface language toggle.
 */
import { applyI18n, getLang, setLang } from '../../core/i18n/language';
import { LANGS, type Lang } from '../../core/i18n/dictionaries';
import type { ElementRefs } from '../dom/element-refs';
import { renderGearsList } from '../../components/gear-list';
import { renderSetupGuide } from '../../components/setup-guide';
import { renderCruise } from '../../components/cruise-card';
import { applyPowerLabels } from './unit-events';

/**
 * @brief Resolve the toggle button of every supported language.
 * @brief Driven by `LANGS`, so adding a dictionary and a button is enough to
 * @brief make the language switchable: no per-language branch anywhere.
 * @param refs Cached DOM handles.
 * @return One button per language, in toggle order.
 */
const langButtons = (refs: ElementRefs): Record<Lang, HTMLButtonElement> => {
	return {
		en: refs.langEn,
		it: refs.langIt,
		de: refs.langDe,
		es: refs.langEs,
		fr: refs.langFr,
	};
};

/**
 * @brief Paint the language toggle to match the active language.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncLangToggle = (refs: ElementRefs): void => {
	const lang = getLang();
	const buttons = langButtons(refs);
	for (const code of LANGS) {
		buttons[code].classList.toggle('is-active', lang === code);
	}
};

/**
 * @brief Bind the language buttons and refresh all rendered text.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindLanguageEvents = (refs: ElementRefs, render: () => void): void => {
	const switchTo = (lang: Lang): void => {
		if (getLang() === lang) {
			return;
		}
		setLang(lang);
		applyI18n();
		applyPowerLabels(refs);
		syncLangToggle(refs);
		renderGearsList(refs, () => render());
		renderSetupGuide(refs);
		renderCruise(refs);
		render();
	};
	const buttons = langButtons(refs);
	for (const code of LANGS) {
		buttons[code].addEventListener('click', () => switchTo(code));
	}
};
