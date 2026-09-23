/**
 * @file pyrometer-guide-card.ts
 * @brief Tyre temperature reading guide card.
 */
import type { Lang } from '../../core/i18n/dictionaries';
import { PYROMETER_GUIDE } from '../../core/setup/setup-guide-content';
import type { CardOptions } from './base-card';
import { FeelCard } from './feel-card';

/** Props for the pyrometer guide card. */
export interface PyrometerGuideCardOptions extends CardOptions {
	/** Active interface language. */
	lang: Lang;
}

/**
 * @brief Pyrometer cues: hot pressures, camber spread, pressure shape.
 */
export class PyrometerGuideCard extends FeelCard {
	/**
	 * @brief Fix the pyrometer content, keep language as prop.
	 * @param options Card language.
	 * @return void
	 */
	constructor(options: PyrometerGuideCardOptions) {
		super({ ...options, content: PYROMETER_GUIDE });
	}
}
