/**
 * @file catalog-quality.test.ts
 * @brief Lint every raw catalog file so loader filtering cannot hide corrupt data.
 */
import { describe, expect, it } from 'vitest';
import { isCatalogEntry, validateCatalogEntry } from '../src/config/car-catalog';
import { catalogQualityIssues } from '../src/config/catalog-quality';

const files = import.meta.glob('../src/config/cars/*.json', { eager: true, import: 'default' });

describe('catalog data-quality lint', () => {
	for (const [path, entry] of Object.entries(files)) {
		it(path, () => {
			expect(validateCatalogEntry(entry)).toEqual([]);
			if (!isCatalogEntry(entry)) throw new Error(`${path} is not a usable preset`);
			expect(catalogQualityIssues(entry.preset)).toEqual([]);
			expect(path.endsWith(`/${entry.id}.json`)).toBe(true);
		});
	}
	it('finds contradictory engine anchors and implausible mass', () => {
		const issues = catalogQualityIssues({
			tire: '205/55R16', fd: 4, redline: 7000, gears: [3, 2, 1], massKg: 20,
			powerKw: 20, peakTorqueRpm: 4000, peakPowerRpm: 6000, peakTorqueNm: 500,
		});
		expect(issues.some((issue) => issue.startsWith('massKg'))).toBe(true);
		expect(issues.some((issue) => issue.startsWith('power at the torque'))).toBe(true);
	});
});
