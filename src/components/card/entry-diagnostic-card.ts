/**
 * @file entry-diagnostic-card.ts
 * @brief Braking and corner-entry diagnostic card.
 */
import type { Lang } from '../../core/i18n/dictionaries';
import { feelSectionFor } from '../../core/setup/setup-guide-content';
import type { CardOptions } from './base-card';
import { FeelCard } from './feel-card';

/** Props for the entry diagnostic card. */
export interface EntryDiagnosticCardOptions extends CardOptions {
	/** Active interface language. */
	lang: Lang;
}

/**
 * @brief Entry-phase feel cues: bias, engine braking, coast lock, pitch rate.
 */
export class EntryDiagnosticCard extends FeelCard {
	/**
	 * @brief Fix the entry feel section, keep language as prop.
	 * @param options Card language.
	 * @return void
	 */
	constructor(options: EntryDiagnosticCardOptions) {
		super({ ...options, content: feelSectionFor('entry') });
	}
}
