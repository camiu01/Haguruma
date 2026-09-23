/**
 * @file procedure-card.ts
 * @brief Systematic eight-step setup procedure card.
 */
import type { Lang } from '../../core/i18n/dictionaries';
import { localiseStep } from '../../core/setup/setup-guide-content';
import type { ProcedureStep } from '../../core/setup/setup-guide-content';
import { Card, createEl } from './base-card';
import type { CardOptions } from './base-card';

/** Props for the procedure card. */
export interface ProcedureCardOptions extends CardOptions {
	/** Ordered procedure steps. */
	steps: ProcedureStep[];
	/** Active interface language. */
	lang: Lang;
}

/**
 * @brief Renders the numbered engineering sequence, one change at a time.
 */
export class SetupProcedureCard extends Card<ProcedureCardOptions> {
	/**
	 * @brief Build the ordered step list with localised copy.
	 * @return Detached procedure element.
	 */
	render(): HTMLElement {
		const list = createEl('ol', 'setup-steps');
		for (const step of this.options.steps) {
			const local = localiseStep(step, this.options.lang);
			const item = createEl('li', 'setup-step');
			const num = createEl('span', 'setup-step-num');
			num.textContent = String(local.n);
			const body = createEl('div', 'setup-step-body');
			const title = createEl('h4', 'setup-step-title');
			title.textContent = local.title;
			const text = createEl('p', 'setup-step-text');
			text.textContent = local.body;
			body.append(title, text);
			item.append(num, body);
			list.appendChild(item);
		}
		return list;
	}
}
