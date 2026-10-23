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

/** Supported interface languages, in selector order. */
export type Lang = 'en' | 'it' | 'de' | 'es' | 'fr';

/** All dictionaries indexed by language. */
export const dictionaries: Record<Lang, Record<DictKey, string>> = { en, it, de, es, fr };
