/**
 * @file mid-corner-card.ts
 * @brief Mid-corner apex and steady-state diagnostic card.
 */
import type { Lang } from '../../core/i18n/dictionaries';
import { feelSectionFor } from '../../core/setup/setup-guide-content';
import type { CardOptions } from './base-card';
import { FeelCard } from './feel-card';

/** Props for the mid-corner card. */
export interface MidCornerCardOptions extends CardOptions {
	/** Active interface language. */
	lang: Lang;
}

/**
 * @brief Mid-phase feel cues: mechanical balance and aero platform.
 */
export class MidCornerCard extends FeelCard {
	/**
	 * @brief Fix the mid feel section, keep language as prop.
	 * @param options Card language.
	 * @return void
	 */
	constructor(options: MidCornerCardOptions) {
		super({ ...options, content: feelSectionFor('mid') });
	}
}
