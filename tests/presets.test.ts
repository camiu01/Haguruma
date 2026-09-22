/**
 * @file presets.test.ts
 * @brief Unit tests for factory vehicle presets.
 */
import { describe, expect, it } from 'vitest';
import { presets } from '../src/config/presets';
import { parseTire } from '../src/core/math/tire-math';

describe('presets', () => {
	it('exposes six factory vehicles', () => {
		expect(Object.keys(presets)).toHaveLength(6);
	});
	it('holds valid tires, ratios and redlines', () => {
		for (const key of Object.keys(presets)) {
			const preset = presets[key];
			expect(parseTire(preset.tire)).not.toBeNull();
			expect(preset.fd).toBeGreaterThan(1);
			expect(preset.redline).toBeGreaterThanOrEqual(7000);
			expect(preset.gears.length).toBeGreaterThanOrEqual(5);
		}
	});
	it('orders gears from short to tall', () => {
		for (const key of Object.keys(presets)) {
			const gears = presets[key].gears;
			for (let i = 1; i < gears.length; i += 1) {
				expect(gears[i]).toBeLessThan(gears[i - 1]);
			}
		}
	});
	it('ships road-load power data on every preset', () => {
		for (const key of Object.keys(presets)) {
			const preset = presets[key];
			expect(preset.powerKw).toBeGreaterThan(0);
			expect(preset.massKg).toBeGreaterThan(0);
			expect(preset.dragCd).toBeGreaterThan(0);
			expect(preset.frontalAreaM2).toBeGreaterThan(0);
		}
	});
	it('ships a reverse ratio on every preset', () => {
		const expected: Record<string, number> = {
			eclipse_1g_gs: 3.083,
			miata_na6: 3.758,
			s2000_ap1: 2.8,
			e46_m3: 3.75,
			gr86: 3.438,
			porsche_gt3: 3.42,
		};
		for (const key of Object.keys(expected)) {
			expect(presets[key].reverseRatio).toBeCloseTo(expected[key], 3);
		}
	});
	it('ships the Eclipse 1G GS hero preset with exact owner data', () => {
		const eclipse = presets.eclipse_1g_gs;
		expect(eclipse.gears).toEqual([3.363, 1.947, 1.285, 0.939, 0.756]);
		expect(eclipse.fd).toBeCloseTo(4.322, 3);
		expect(eclipse.reverseRatio).toBeCloseTo(3.083, 3);
		expect(eclipse.massKg).toBe(1270);
		expect(eclipse.dragCd).toBeCloseTo(0.29, 2);
		expect(eclipse.frontalAreaM2).toBeCloseTo(1.95, 2);
	});
});
