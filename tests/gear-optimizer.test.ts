/**
 * @file gear-optimizer.test.ts
 * @brief Unit tests for the heuristic gearset solver.
 */
import { describe, expect, it } from 'vitest';
import { optimizeGearset } from '../src/core/math/gear-optimizer';

const BASE = {
	gearCount: 5,
	redline: 7200,
	circM: 1.95,
	fd: 4.1,
	targetTopSpeedKmh: 220,
	maxDrop: 0.35,
};

describe('optimizeGearset', () => {
	it('proposes a decreasing gearset of the requested count', () => {
		const solved = optimizeGearset(BASE);
		expect(solved?.ratios).toHaveLength(5);
		for (let idx = 1; idx < (solved?.ratios.length ?? 0); idx += 1) {
			expect(solved?.ratios[idx]).toBeLessThan(solved?.ratios[idx - 1] ?? 0);
		}
	});
	it('lands top-gear Vmax near the target', () => {
		const solved = optimizeGearset(BASE);
		expect(solved?.topSpeedKmh).toBeGreaterThan(180);
		expect(solved?.topSpeedKmh).toBeLessThan(260);
	});
	it('respects generous drop limits', () => {
		const solved = optimizeGearset({ ...BASE, gearCount: 6, maxDrop: 0.5 });
		expect(solved?.withinLimits).toBe(true);
	});
	it('rejects invalid input', () => {
		expect(optimizeGearset({ ...BASE, gearCount: 1 })).toBeNull();
		expect(optimizeGearset({ ...BASE, maxDrop: 0 })).toBeNull();
		expect(optimizeGearset({ ...BASE, circM: 0 })).toBeNull();
	});
});
