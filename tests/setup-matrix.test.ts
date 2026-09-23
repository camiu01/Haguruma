/**
 * @file setup-matrix.test.ts
 * @brief Unit tests for the setup troubleshooting matrix and guide content.
 */
import { describe, expect, it } from 'vitest';
import { ISSUES, PHASES, SETUP_MATRIX, getFixes, pickLang } from '../src/core/setup/setup-matrix';
import type { CornerPhase, HandlingIssue } from '../src/core/setup/setup-matrix';
import { FEEL_GUIDE, PROCEDURE_STEPS, localiseFeel, localiseStep } from '../src/core/setup/setup-guide-content';
import { severityDictKey } from '../src/components/setup-guide';
import { isIssue, isPhase } from '../src/services/events/setup-guide-events';

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
	it('returns fixes sorted by rank with non-empty bilingual copy', () => {
		for (const phase of PHASES) {
			for (const issue of ISSUES) {
				const fixes = getFixes(phase, issue);
				const ranks = fixes.map((fix) => fix.rank);
				expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
				for (const fix of fixes) {
					expect(fix.action.en.length).toBeGreaterThan(0);
					expect(fix.action.it.length).toBeGreaterThan(0);
					expect(fix.detail.en.length).toBeGreaterThan(0);
					expect(fix.detail.it.length).toBeGreaterThan(0);
					expect(['low', 'medium', 'high']).toContain(fix.severity);
				}
			}
		}
	});
	it('exposes the front-ARB versus aero trade-off case', () => {
		const fixes = getFixes('entry', 'understeer');
		const arb = fixes.find((fix) => fix.action.en.includes('ARB'));
		expect(arb?.tradeoff?.en).toMatch(/aero/i);
	});
	it('picks the active language copy', () => {
		const fixes = getFixes('mid', 'understeer');
		expect(pickLang(fixes[0].action, 'en')).toBe(fixes[0].action.en);
		expect(pickLang(fixes[0].action, 'it')).toBe(fixes[0].action.it);
	});
});

describe('setup guide content', () => {
	it('covers entry, mid and exit feel sections with cues', () => {
		expect(FEEL_GUIDE.map((section) => section.phase)).toEqual(['entry', 'mid', 'exit']);
		for (const section of FEEL_GUIDE) {
			expect(section.cues.length).toBeGreaterThanOrEqual(2);
		}
	});
	it('lists eight ordered procedure steps with bilingual copy', () => {
		expect(PROCEDURE_STEPS).toHaveLength(8);
		expect(PROCEDURE_STEPS.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		for (const step of PROCEDURE_STEPS) {
			expect(step.title.en.length).toBeGreaterThan(0);
			expect(step.title.it.length).toBeGreaterThan(0);
		}
	});
	it('returns an empty list for unknown phase or issue', () => {
		expect(getFixes('apex' as CornerPhase, 'understeer')).toEqual([]);
		expect(getFixes('mid', 'drift' as HandlingIssue)).toEqual([]);
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
		expect(feel.title).toBe(FEEL_GUIDE[0].title.it);
		expect(feel.cues[0].title).toBe(FEEL_GUIDE[0].cues[0].title.it);
		expect(feel.cues[0].body).toBe(FEEL_GUIDE[0].cues[0].body.it);
		const step = localiseStep(PROCEDURE_STEPS[0], 'it');
		expect(step.n).toBe(1);
		expect(step.title).toBe(PROCEDURE_STEPS[0].title.it);
		expect(step.body).toBe(PROCEDURE_STEPS[0].body.it);
	});
});
