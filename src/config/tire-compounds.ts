/**
 * @file tire-compounds.ts
 * @brief Extensible catalog of tire compounds by treadwear rating.
 *
 * New compounds are added by appending one entry to TIRE_COMPOUNDS; the
 * running-gear selects, grip physics and share layer read from this catalog
 * only. gripGain multiplies the road friction coefficient, so the default
 * touring compound (gain 1.0) leaves every existing number untouched while
 * stickier rubber (200TW, 100TW, slick) raises the Kamm-circle budget.
 */
import type { DictKey } from '../core/i18n/dictionaries';

/**
 * One tire compound selectable from the running-gear UI.
 * @brief Catalog row mapping a UI id to treadwear and grip gain.
 */
export interface TireCompound {
	/** Stable option value stored in RunningGear.tireCompoundId. */
	id: string;
	/** i18n label key for the dropdown option. */
	labelKey: DictKey;
	/** UTQG treadwear rating (lower means stickier, 0 for slicks). */
	treadwear: number;
	/** Multiplier applied to the road friction coefficient. */
	gripGain: number;
}

/**
 * @brief Built-in tire compounds from eco touring to slick (append to extend).
 * @return Ordered catalog rows for the UI select.
 */
export const TIRE_COMPOUNDS: TireCompound[] = [
	{ id: 'eco_400', labelKey: 'running.tireEco', treadwear: 400, gripGain: 0.92 },
	{ id: 'touring_300', labelKey: 'running.tireTouring', treadwear: 300, gripGain: 1.0 },
	{ id: 'sport_200', labelKey: 'running.tireSport', treadwear: 200, gripGain: 1.08 },
	{ id: 'semi_100', labelKey: 'running.tireSemi', treadwear: 100, gripGain: 1.15 },
	{ id: 'slick', labelKey: 'running.tireSlick', treadwear: 0, gripGain: 1.22 },
];

/** Default compound id (neutral gain, preserves legacy grip numbers). */
export const DEFAULT_TIRE_COMPOUND_ID = 'touring_300';

/** UI ids in the tire compound catalog. */
export const TIRE_COMPOUND_IDS = new Set(TIRE_COMPOUNDS.map((c) => c.id));

/**
 * @brief Look up a catalog entry by id.
 * @param id Compound id from the select or state.
 * @return Matching compound, or null when unknown.
 */
export const findTireCompound = (id: string | undefined): TireCompound | null => {
	if (!id) {
		return null;
	}
	return TIRE_COMPOUNDS.find((c) => c.id === id) ?? null;
};

/**
 * @brief Grip multiplier for a compound id, legacy-safe.
 * @param id Compound id from state or a share payload.
 * @return Catalog gain, or 1.0 when the id is missing or unknown.
 */
export const gripGainFor = (id: string | undefined): number => {
	return findTireCompound(id)?.gripGain ?? 1.0;
};
