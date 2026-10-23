/**
 * @file i18n.test.ts
 * @brief Unit tests for the per-language dictionaries and lookup.
 */
import { describe, expect, it } from 'vitest';
import { de, dictionaries, en, es, fr, it as itDict } from '../src/core/i18n/dictionaries';
import { setLang, t } from '../src/core/i18n/language';

/** Translated locales sharing the English key set. */
const TRANSLATED = { it: itDict, de, es, fr };

/** Labels that must never fall back to English copy. */
const TRANSLATED_KEYS = ['gears.add', 'nav.language', 'share.label'] as const;

describe('dictionaries', () => {
	it('covers identical keys in every language', () => {
		const expected = Object.keys(en).sort();
		for (const [lang, dict] of Object.entries(TRANSLATED)) {
			expect(Object.keys(dict).sort(), lang).toEqual(expected);
		}
	});
	it('keeps every value non-empty in every language', () => {
		for (const [lang, dict] of Object.entries(dictionaries)) {
			for (const [key, value] of Object.entries(dict)) {
				expect(value.trim().length, `${lang}:${key}`).toBeGreaterThan(0);
			}
		}
	});
	it('translates the shared labels in every language', () => {
		for (const [lang, dict] of Object.entries(TRANSLATED)) {
			for (const key of TRANSLATED_KEYS) {
				expect(dict[key], `${lang}:${key}`).not.toBe(en[key]);
			}
		}
	});
	it('translates known keys to Italian', () => {
		expect(dictionaries.it['gears.add']).toBe('Aggiungi marcia');
		expect(dictionaries.it['gear.prefix']).toBe('Marcia');
	});
});

describe('t', () => {
	it('returns English by default', () => {
		setLang('en');
		expect(t('gears.add')).toBe('Add Gear');
	});
	it('returns the active language', () => {
		for (const [lang, dict] of Object.entries(TRANSLATED)) {
			setLang(lang as keyof typeof TRANSLATED);
			expect(t('gears.add'), lang).toBe(dict['gears.add']);
		}
		setLang('en');
	});
	it('supports an explicit language override', () => {
		expect(t('th.power', 'it')).toBe('Pot. rich.');
		expect(t('th.power', 'de')).toBe(de['th.power']);
	});
});
