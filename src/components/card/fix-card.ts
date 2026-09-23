/**
 * @file fix-card.ts
 * @brief Ranked wizard adjustment card with severity badge and trade-off.
 */
import type { DictKey, Lang } from '../../core/i18n/dictionaries';
import { t } from '../../core/i18n/language';
import type { SetupFix, Severity } from '../../core/setup/setup-matrix';
import { Card, createEl } from './base-card';
import type { CardOptions } from './base-card';

/** Props for a wizard fix card. */
export interface FixCardOptions extends CardOptions {
	/** Fix entry rendered by the card. */
	fix: SetupFix;
	/** Active interface language. */
	lang: Lang;
}

/**
 * @brief Map a fix severity to its badge dictionary key.
 * @param severity Fix severity level.
 * @return Dictionary key for the localised badge label.
 */
export const severityDictKey = (severity: Severity): DictKey => {
	if (severity === 'low') {
		return 'setup.sevLow';
	}
	if (severity === 'medium') {
		return 'setup.sevMedium';
	}
	return 'setup.sevHigh';
};

/**
 * @brief Renders one ranked adjustment with its warning, when present.
 */
export class SetupFixCard extends Card<FixCardOptions> {
	/**
	 * @brief Build the fix card with rank, badge and optional trade-off.
	 * @return Detached fix element.
	 */
	render(): HTMLElement {
		const { fix, lang } = this.options;
		const card = createEl('article', 'setup-fix');
		const head = createEl('div', 'setup-fix-head');
		const rank = createEl('span', 'setup-rank');
		rank.textContent = String(fix.rank);
		const action = createEl('h4', 'setup-fix-title');
		action.textContent = t(fix.actionKey, lang);
		const badge = createEl('span', `setup-sev setup-sev-${fix.severity}`);
		badge.textContent = t(severityDictKey(fix.severity), lang);
		head.append(rank, action, badge);
		const detail = createEl('p', 'setup-fix-detail');
		detail.textContent = t(fix.detailKey, lang);
		card.append(head, detail);
		if (fix.tradeoffKey) {
			const warn = createEl('p', 'setup-tradeoff');
			warn.textContent = `${t('setup.tradeoff', lang)}: ${t(fix.tradeoffKey, lang)}`;
			card.appendChild(warn);
		}
		return card;
	}
}
