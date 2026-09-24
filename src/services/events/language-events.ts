/**
 * @file language-events.ts
 * @brief Bind the EN/IT language toggle.
 */
import { applyI18n, getLang, setLang } from '../../core/i18n/language';
import type { Lang } from '../../core/i18n/dictionaries';
import type { ElementRefs } from '../dom/element-refs';
import { renderGearsList } from '../../components/gear-list';
import { renderSetupGuide } from '../../components/setup-guide';
import { renderCruise } from '../../components/cruise-card';
import { applyPowerLabels } from './unit-events';

const ACTIVE_BTN = 'px-3 py-1 text-xs font-semibold rounded bg-gray-200 text-black';
const IDLE_BTN = 'px-3 py-1 text-xs font-semibold rounded text-gray-400 hover:text-white';

/**
 * @brief Paint the language toggle to match the active language.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncLangToggle = (refs: ElementRefs): void => {
	const lang = getLang();
	refs.langEn.className = lang === 'en' ? ACTIVE_BTN : IDLE_BTN;
	refs.langIt.className = lang === 'it' ? ACTIVE_BTN : IDLE_BTN;
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
	refs.langEn.addEventListener('click', () => switchTo('en'));
	refs.langIt.addEventListener('click', () => switchTo('it'));
};
