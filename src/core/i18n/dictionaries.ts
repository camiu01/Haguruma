/**
 * @file dictionaries.ts
 * @brief Language map wiring the per-language dictionaries.
 */
import { en } from './dictionary.en';
import type { DictKey } from './dictionary.en';
import { it } from './dictionary.it';
import { de } from './dictionary.de';
import { es } from './dictionary.es';
import { fr } from './dictionary.fr';

export type { DictKey };
export { en, it, de, es, fr };

/** Supported interface languages, in toggle order. */
export const LANGS = ['en', 'it', 'de', 'es', 'fr'] as const;

/** Supported interface languages. */
export type Lang = (typeof LANGS)[number];

/** All dictionaries indexed by language. */
export const dictionaries: Record<Lang, Record<DictKey, string>> = { en, it, de, es, fr };

/**
 * @brief Narrow an arbitrary string to a supported language.
 * @param value Candidate language code, normally read from storage.
 * @return The matching language, or null when unsupported.
 */
export const asLang = (value: string | null | undefined): Lang | null => {
	return LANGS.includes(value as Lang) ? (value as Lang) : null;
};
