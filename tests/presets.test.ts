/**
 * @file presets.test.ts
 * @brief Unit tests for factory vehicle presets.
 */
import { describe, expect, it } from 'vitest';
import { presets } from '../src/config/presets';
import { parseTire } from '../src/core/math/tire-math';
import catalog from '../src/config/car-catalog.json';

describe('presets', () => {
	it('exposes eighteen catalog vehicles', () => {
		expect(Object.keys(presets)).toHaveLength(18);
	});
	it('holds valid tires, ratios and redlines', () => {
		for (const key of Object.keys(presets)) {
			const preset = presets[key];
			expect(parseTire(preset.tire)).not.toBeNull();
			expect(preset.fd).toBeGreaterThan(1);
			expect(preset.redline).toBeGreaterThanOrEqual(6000);
			expect(preset.gears.length).toBeGreaterThanOrEqual(4);
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
			sierra_rs_cosworth: 3.36,
			mr2_sw20_turbo: 3.545,
			r5_gt_turbo: 3.727,
			samurai_sj413: 3.466,
			caterham_seven_160: 3.583,
			rx7_fb_12a: 3.542,
			tvr_griffith_500: 2.76,
			uno_turbo_ie: 3.91,
			porsche_930_turbo: 3.0,
			focus_rs_mk1: 3.56,
			ae86_trueno: 3.56,
			viper_rt10: 2.9,
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
	it('ships a valid runningGear on every preset', () => {
		const layouts = ['FWD', 'RWD', 'AWD'];
		const diffs = ['open', 'torsen', 'clutch_lsd', 'spool'];
		for (const key of Object.keys(presets)) {
			const rg = presets[key].runningGear;
			expect(rg).toBeDefined();
			expect(rg?.frontWeightDistribution).toBeGreaterThanOrEqual(0.4);
			expect(rg?.frontWeightDistribution).toBeLessThanOrEqual(0.7);
			expect(rg?.roadFrictionCoefficient).toBeGreaterThanOrEqual(0.5);
			expect(rg?.roadFrictionCoefficient).toBeLessThanOrEqual(1.3);
			expect(layouts).toContain(rg?.drivetrainLayout);
			expect(diffs).toContain(rg?.differentialType);
		}
	});
});

describe('car-catalog', () => {
	it('uses unique ids with non-empty labels', () => {
		const ids = (catalog as unknown[]).map((e) => (e as { id: string }).id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const entry of catalog as unknown[]) {
			const typed = entry as { label: string; group: string };
			expect(typed.label.length).toBeGreaterThan(0);
			expect(['factory', 'community']).toContain(typed.group);
		}
	});
	it('ships valid runningGear enums without legacy lsd values', () => {
		const layouts = ['FWD', 'RWD', 'AWD'];
		const diffs = ['open', 'torsen', 'clutch_lsd', 'spool'];
		const raw = JSON.stringify(catalog);
		expect(raw).not.toContain('"lsd"');
		for (const entry of catalog as unknown[]) {
			const typed = entry as { preset: { runningGear: Record<string, string> } };
			expect(typed.preset.runningGear).toBeDefined();
			expect(layouts).toContain(typed.preset.runningGear.drivetrainLayout);
			expect(diffs).toContain(typed.preset.runningGear.differentialType);
		}
	});
});
