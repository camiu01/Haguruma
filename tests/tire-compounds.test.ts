/**
 * @file tire-compounds.test.ts
 * @brief Unit tests for the treadwear-rated tire compound catalog.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_TIRE_COMPOUND_ID, TIRE_COMPOUNDS, findTireCompound, gripGainFor } from '../src/config/tire-compounds';
import { t } from '../src/core/i18n/language';

describe('tire-compounds catalog', () => {
	it('ships eco, touring, sport 200TW, semislick and slick in order', () => {
		expect(TIRE_COMPOUNDS.map((c) => c.id)).toEqual(['eco_400', 'touring_300', 'sport_200', 'semi_100', 'slick']);
	});
	it('keeps treadwear descending and gains ascending inside sane bounds', () => {
		for (const c of TIRE_COMPOUNDS) {
			expect(c.gripGain).toBeGreaterThanOrEqual(0.85);
			expect(c.gripGain).toBeLessThanOrEqual(1.3);
		}
		for (let i = 1; i < TIRE_COMPOUNDS.length; i += 1) {
			expect(TIRE_COMPOUNDS[i].treadwear).toBeLessThan(TIRE_COMPOUNDS[i - 1].treadwear);
			expect(TIRE_COMPOUNDS[i].gripGain).toBeGreaterThan(TIRE_COMPOUNDS[i - 1].gripGain);
		}
		expect(findTireCompound('sport_200')?.treadwear).toBe(200);
	});
	it('resolves labels via i18n without falling back to raw keys', () => {
		for (const c of TIRE_COMPOUNDS) {
			const label = t(c.labelKey);
			expect(label).not.toBe(c.labelKey);
			expect(label.length).toBeGreaterThan(0);
		}
	});
	it('defaults to the neutral touring compound and stays legacy-safe', () => {
		expect(DEFAULT_TIRE_COMPOUND_ID).toBe('touring_300');
		expect(gripGainFor('touring_300')).toBe(1.0);
		expect(gripGainFor(undefined)).toBe(1.0);
		expect(gripGainFor('nope')).toBe(1.0);
		expect(findTireCompound(undefined)).toBeNull();
		expect(findTireCompound('nope')).toBeNull();
	});
});
