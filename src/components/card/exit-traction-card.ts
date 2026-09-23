/**
 * @file exit-traction-card.ts
 * @brief Corner-exit on-throttle diagnostic card.
 */
import type { Lang } from '../../core/i18n/dictionaries';
import { feelSectionFor } from '../../core/setup/setup-guide-content';
import type { CardOptions } from './base-card';
import { FeelCard } from './feel-card';

/** Props for the exit traction card. */
export interface ExitTractionCardOptions extends CardOptions {
	/** Active interface language. */
	lang: Lang;
}

/**
 * @brief Exit-phase feel cues: wheelspin, power balance, squat, stops.
 */
export class ExitTractionCard extends FeelCard {
	/**
	 * @brief Fix the exit feel section, keep language as prop.
	 * @param options Card language.
	 * @return void
	 */
	constructor(options: ExitTractionCardOptions) {
		super({ ...options, content: feelSectionFor('exit') });
	}
}
