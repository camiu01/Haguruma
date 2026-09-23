/**
 * @file feel-card.ts
 * @brief Shared rung rendering one feel-the-car section for phase cards.
 */
import type { Lang } from '../../core/i18n/dictionaries';
import { localiseFeel } from '../../core/setup/setup-guide-content';
import type { FeelContent } from '../../core/setup/setup-guide-content';
import { Card, createEl } from './base-card';
import type { CardOptions } from './base-card';

/** Props for a feel section card. */
export interface FeelCardOptions extends CardOptions {
	/** Feel content rendered by the card. */
	content: FeelContent;
	/** Active interface language. */
	lang: Lang;
}

/**
 * @brief Renders a titled cue list for one feel section.
 * @brief Entry, mid, exit and pyrometer cards share this rung.
 */
export class FeelCard extends Card<FeelCardOptions> {
	/**
	 * @brief Build the feel block with localised title and cues.
	 * @return Detached feel section element.
	 */
	render(): HTMLElement {
		const local = localiseFeel(this.options.content, this.options.lang);
		const block = createEl('div', 'setup-feel-block');
		const title = createEl('h4', 'setup-feel-title');
		title.textContent = local.title;
		block.appendChild(title);
		const list = createEl('ul', 'setup-feel-list');
		for (const cue of local.cues) {
			const item = createEl('li', 'setup-feel-item');
			const name = document.createElement('strong');
			name.textContent = cue.title;
			const text = document.createElement('span');
			text.textContent = ` — ${cue.body}`;
			item.append(name, text);
			list.appendChild(item);
		}
		block.appendChild(list);
		return block;
	}
}
