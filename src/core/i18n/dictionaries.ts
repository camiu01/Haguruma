/**
 * @file dictionaries.ts
 * @brief Language map wiring the per-language dictionaries.
 */
import { en } from './dictionary.en';
import type { DictKey } from './dictionary.en';
import { it } from './dictionary.it';

export type { DictKey };
export { en, it };

/** Supported interface languages. */
export type Lang = 'en' | 'it';

/** All dictionaries indexed by language. */
export const dictionaries: Record<Lang, Record<DictKey, string>> = { en, it };
