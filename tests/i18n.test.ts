/**
 * @file i18n.test.ts
 * @brief Unit tests for the EN/IT dictionaries and lookup.
 */
import { describe, expect, it } from 'vitest';
import { dictionaries, en, it as itDict } from '../src/core/i18n/dictionaries';
import { setLang, t } from '../src/core/i18n/language';

describe('dictionaries', () => {
	it('covers identical keys in both languages', () => {
		expect(Object.keys(itDict).sort()).toEqual(Object.keys(en).sort());
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
	it('returns Italian when active', () => {
		setLang('it');
		expect(t('gears.add')).toBe('Aggiungi marcia');
		setLang('en');
	});
	it('supports an explicit language override', () => {
		expect(t('th.power', 'it')).toBe('Pot. rich.');
	});
});
