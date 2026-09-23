/**
 * @file setup-matrix.test.ts
 * @brief Unit tests for the setup troubleshooting matrix and guide content.
 */
import { describe, expect, it } from 'vitest';
import { ISSUES, PHASES, SETUP_MATRIX, getFixes } from '../src/core/setup/setup-matrix';
import type { CornerPhase, HandlingIssue } from '../src/core/setup/setup-matrix';
import { FEEL_GUIDE, PROCEDURE_STEPS, PYROMETER_GUIDE, localiseFeel, localiseStep } from '../src/core/setup/setup-guide-content';
import { dictionaries } from '../src/core/i18n/dictionaries';
import type { DictKey } from '../src/core/i18n/dictionaries';
import { t } from '../src/core/i18n/language';
import { severityDictKey } from '../src/components/card';
import { isIssue, isPhase } from '../src/services/events/setup-guide-events';

/**
 * @brief Collect every dictionary key referenced by setup data.
 * @return Referenced keys without duplicates.
 */
const collectSetupKeys = (): DictKey[] => {
	const keys = new Set<DictKey>();
	for (const phase of PHASES) {
		for (const issue of ISSUES) {
			for (const fix of SETUP_MATRIX[phase][issue]) {
				keys.add(fix.actionKey);
				keys.add(fix.detailKey);
				if (fix.tradeoffKey) {
					keys.add(fix.tradeoffKey);
				}
			}
		}
	}
	for (const section of FEEL_GUIDE) {
		keys.add(section.titleKey);
		for (const cue of section.cues) {
			keys.add(cue.titleKey);
			keys.add(cue.bodyKey);
		}
	}
	keys.add(PYROMETER_GUIDE.titleKey);
	for (const cue of PYROMETER_GUIDE.cues) {
		keys.add(cue.titleKey);
		keys.add(cue.bodyKey);
	}
	for (const step of PROCEDURE_STEPS) {
		keys.add(step.titleKey);
		keys.add(step.bodyKey);
	}
	return [...keys];
};

describe('setup matrix coverage', () => {
	it('covers all three corner phases and four issues', () => {
		expect(PHASES).toEqual(['entry', 'mid', 'exit']);
		expect(ISSUES).toEqual(['understeer', 'oversteer', 'transfer', 'bottoming']);
		for (const phase of PHASES) {
			for (const issue of ISSUES) {
				expect(SETUP_MATRIX[phase][issue].length).toBeGreaterThanOrEqual(2);
			}
		}
	});
	it('returns fixes sorted by rank with resolvable bilingual copy', () => {
		for (const phase of PHASES) {
			for (const issue of ISSUES) {
				const fixes = getFixes(phase, issue);
				const ranks = fixes.map((fix) => fix.rank);
				expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
				for (const fix of fixes) {
					expect(t(fix.actionKey, 'en').length).toBeGreaterThan(0);
					expect(t(fix.actionKey, 'it').length).toBeGreaterThan(0);
					expect(t(fix.detailKey, 'en').length).toBeGreaterThan(0);
					expect(t(fix.detailKey, 'it').length).toBeGreaterThan(0);
					expect(['low', 'medium', 'high']).toContain(fix.severity);
				}
			}
		}
	});
	it('references only dictionary keys present in both languages', () => {
		for (const key of collectSetupKeys()) {
			expect(dictionaries.en[key].length).toBeGreaterThan(0);
			expect(dictionaries.it[key].length).toBeGreaterThan(0);
		}
	});
	it('exposes the front-ARB versus aero trade-off case', () => {
		const fixes = getFixes('entry', 'understeer');
		const arb = fixes.find((fix) => t(fix.actionKey, 'en').includes('ARB'));
		expect(arb?.tradeoffKey).toBeDefined();
		if (arb?.tradeoffKey) {
			expect(t(arb.tradeoffKey, 'en')).toMatch(/aero/i);
		}
	});
	it('returns an empty list for unknown phase or issue', () => {
		expect(getFixes('apex' as CornerPhase, 'understeer')).toEqual([]);
		expect(getFixes('mid', 'drift' as HandlingIssue)).toEqual([]);
	});
});

describe('setup guide content', () => {
	it('covers entry, mid and exit feel sections with cues', () => {
		expect(FEEL_GUIDE.map((section) => section.phase)).toEqual(['entry', 'mid', 'exit']);
		for (const section of FEEL_GUIDE) {
			expect(section.cues.length).toBeGreaterThanOrEqual(2);
		}
	});
	it('lists eight ordered procedure steps with resolvable copy', () => {
		expect(PROCEDURE_STEPS).toHaveLength(8);
		expect(PROCEDURE_STEPS.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		for (const step of PROCEDURE_STEPS) {
			expect(t(step.titleKey, 'en').length).toBeGreaterThan(0);
			expect(t(step.titleKey, 'it').length).toBeGreaterThan(0);
		}
	});
});

describe('setup wizard helpers', () => {
	it('maps every severity to its badge dictionary key', () => {
		expect(severityDictKey('low')).toBe('setup.sevLow');
		expect(severityDictKey('medium')).toBe('setup.sevMedium');
		expect(severityDictKey('high')).toBe('setup.sevHigh');
	});
	it('accepts known phases and issues, rejects unknown values', () => {
		expect(isPhase('entry')).toBe(true);
		expect(isPhase('mid')).toBe(true);
		expect(isPhase('exit')).toBe(true);
		expect(isPhase('apex')).toBe(false);
		expect(isPhase('')).toBe(false);
		expect(isIssue('understeer')).toBe(true);
		expect(isIssue('oversteer')).toBe(true);
		expect(isIssue('transfer')).toBe(true);
		expect(isIssue('bottoming')).toBe(true);
		expect(isIssue('drift')).toBe(false);
		expect(isIssue('')).toBe(false);
	});
	it('localises feel sections and steps to Italian', () => {
		const feel = localiseFeel(FEEL_GUIDE[0], 'it');
		expect(feel.title).toBe(dictionaries.it[FEEL_GUIDE[0].titleKey]);
		expect(feel.cues[0].title).toBe(dictionaries.it[FEEL_GUIDE[0].cues[0].titleKey]);
		expect(feel.cues[0].body).toBe(dictionaries.it[FEEL_GUIDE[0].cues[0].bodyKey]);
		const step = localiseStep(PROCEDURE_STEPS[0], 'it');
		expect(step.n).toBe(1);
		expect(step.title).toBe(dictionaries.it[PROCEDURE_STEPS[0].titleKey]);
		expect(step.body).toBe(dictionaries.it[PROCEDURE_STEPS[0].bodyKey]);
	});
});
