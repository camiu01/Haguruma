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
	it('accepts optional final drives containing the stock fd', () => {
		const byId = Object.fromEntries(catalogEntries.map((e) => [e.id, e]));
		for (const id of ['miata_na6', 'ae86_trueno', 's2000_ap1']) {
			const drives = byId[id].preset.finalDrives ?? [];
			expect(drives.length).toBeGreaterThanOrEqual(2);
			expect(drives).toContain(byId[id].preset.fd);
		}
	});
	it('rejects final drives missing the stock fd', () => {
		const bad = {
			id: 'x',
			label: 'X',
			group: 'factory',
			preset: { tire: '205/55R16', fd: 4.1, redline: 7000, gears: [3.0, 2.0], finalDrives: [4.3, 4.77] },
		};
		expect(validateCatalogEntry(bad)).toContain('preset.finalDrives must contain the stock fd');
	});
});
