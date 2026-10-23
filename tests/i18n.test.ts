/**
 * @file i18n.test.ts
 * @brief Unit tests for the dictionary set and the translation lookup.
 *
 * The dictionaries are a compile-time `Record<DictKey, string>`, so a missing
 * key is a type error. These tests cover what the type cannot: every shipped
 * language is fully translated (no empty values), the placeholders of each
 * string survive translation, and the lookup falls back the way the UI needs.
 */
import { describe, expect, it } from 'vitest';
import { asLang, dictionaries, en, it as itDict, LANGS, type Lang } from '../src/core/i18n/dictionaries';
import { setLang, t } from '../src/core/i18n/language';

/** Languages other than English, i.e. the ones that carry a translation. */
const TRANSLATED: Lang[] = LANGS.filter((lang) => lang !== 'en');

/** Every `{token}` placeholder of a string, sorted. */
const placeholders = (text: string): string[] => {
	return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
};

describe('dictionaries', () => {
	it('covers identical keys in every language', () => {
		const englishKeys = Object.keys(en).sort();
		for (const lang of TRANSLATED) {
			expect(Object.keys(dictionaries[lang]).sort(), `${lang} keys`).toEqual(englishKeys);
		}
	});

	it('translates every key of every language', () => {
		for (const lang of TRANSLATED) {
			const empty = Object.entries(dictionaries[lang])
				.filter(([, value]) => typeof value !== 'string' || value.trim() === '')
				.map(([key]) => key);
			expect(empty, `${lang} untranslated keys`).toEqual([]);
		}
	});

	it('keeps the placeholders of each string', () => {
		for (const lang of TRANSLATED) {
			for (const [key, source] of Object.entries(en)) {
				expect(placeholders(dictionaries[lang][key]), `${lang} ${key}`).toEqual(placeholders(source));
			}
		}
	});

	it('translates known keys', () => {
		expect(dictionaries.it['gears.add']).toBe('Aggiungi marcia');
		expect(dictionaries.it['gear.prefix']).toBe('Marcia');
	});

	it('ships the documented language set', () => {
		expect(LANGS).toEqual(['en', 'it', 'de', 'es', 'fr']);
	});
});

describe('asLang', () => {
	it('accepts a supported code', () => {
		expect(asLang('de')).toBe('de');
		expect(asLang('fr')).toBe('fr');
	});

	it('rejects anything else', () => {
		expect(asLang('pt')).toBeNull();
		expect(asLang('')).toBeNull();
		expect(asLang(null)).toBeNull();
		expect(asLang(undefined)).toBeNull();
	});
});

describe('t', () => {
	it('returns English by default', () => {
		setLang('en');
		expect(t('gears.add')).toBe('Add Gear');
	});

	it('returns Italian when active', () => {
		setLang('it');
		expect(t('gears.add')).toBe('Aggiungi marcia');
		setLang('en');
	});

	it('supports an explicit language override', () => {
		expect(t('th.power', 'it')).toBe('Pot. rich.');
	});

	it('falls back to English when a translation is blank', () => {
		const original = dictionaries.de['gears.add'];
		dictionaries.de['gears.add'] = '';
		try {
			expect(t('gears.add', 'de')).toBe('Add Gear');
		} finally {
			dictionaries.de['gears.add'] = original;
		}
	});
});
