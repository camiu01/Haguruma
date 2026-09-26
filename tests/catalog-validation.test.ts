/**
 * @file catalog-validation.test.ts
 * @brief Unit tests for the strict catalog contract validator.
 */
import { describe, expect, it } from 'vitest';
import { catalogEntries, validateCatalogEntry } from '../src/config/car-catalog';

describe('validateCatalogEntry', () => {
	it('accepts every shipped catalog entry', () => {
		expect(catalogEntries.length).toBeGreaterThan(0);
		for (const entry of catalogEntries) {
			expect(validateCatalogEntry(entry)).toEqual([]);
		}
	});
	it('rejects missing fields and rising gears', () => {
		expect(validateCatalogEntry(null).length).toBeGreaterThan(0);
		expect(validateCatalogEntry({ id: 'x' }).length).toBeGreaterThan(0);
		const rising = {
			id: 'x',
			label: 'X',
			group: 'factory',
			preset: { tire: '205/55R16', fd: 4.1, redline: 7000, gears: [1.0, 2.0] },
		};
		expect(validateCatalogEntry(rising)).toContain('preset.gears must be strictly decreasing');
	});
	it('rejects unknown drivetrain enums', () => {
		const bad = {
			id: 'x',
			label: 'X',
			group: 'factory',
			preset: { tire: '205/55R16', fd: 4.1, redline: 7000, gears: [3.0, 2.0], runningGear: { drivetrainLayout: '4WD', differentialType: 'open' } },
		};
		expect(validateCatalogEntry(bad).length).toBeGreaterThan(0);
	});
});
