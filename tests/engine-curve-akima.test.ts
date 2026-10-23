/**
 * @file engine-curve-akima.test.ts
 * @brief Unit tests for Akima dyno interpolation (smooth, no overshoot).
 */
import { describe, expect, it } from 'vitest';
import { torqueAtRpm } from '../src/core/math/engine-curve-core';
import type { TorqueCurvePoint } from '../src/core/models';

const PEAKY: TorqueCurvePoint[] = [
	{ rpm: 1000, torqueNm: 100 },
	{ rpm: 2000, torqueNm: 150 },
	{ rpm: 3000, torqueNm: 220 },
	{ rpm: 4000, torqueNm: 180 },
	{ rpm: 5000, torqueNm: 160 },
	{ rpm: 6000, torqueNm: 140 },
];

describe('torqueAtRpm Akima', () => {
	it('invalidates cached tangents when a point is edited in place', () => {
		const points = PEAKY.map((point) => ({ ...point }));
		torqueAtRpm(points, 2500);
		points[2].torqueNm = 170;
		const fresh = points.map((point) => ({ ...point }));
		expect(torqueAtRpm(points, 2500)).toBe(torqueAtRpm(fresh, 2500));
		points.splice(2, 1);
		expect(torqueAtRpm(points, 2500)).toBe(torqueAtRpm(points.map((point) => ({ ...point })), 2500));
	});
	it('is exact at every measured node', () => {
		for (const p of PEAKY) {
			expect(torqueAtRpm(PEAKY, p.rpm)).toBeCloseTo(p.torqueNm, 6);
		}
	});
	it('never overshoots beyond neighbours on monotone runs', () => {
		for (let rpm = 1000; rpm < 3000; rpm += 50) {
			const t = torqueAtRpm(PEAKY, rpm);
			expect(t).toBeGreaterThanOrEqual(99);
			expect(t).toBeLessThanOrEqual(221);
		}
	});
	it('stays smooth across the peak (no linear kink)', () => {
		const before = torqueAtRpm(PEAKY, 2900);
		const at = torqueAtRpm(PEAKY, 3000);
		const after = torqueAtRpm(PEAKY, 3100);
		expect(at).toBeGreaterThan(before);
		expect(at).toBeGreaterThanOrEqual(after);
		expect(at - before).toBeLessThan(15);
		expect(at - after).toBeLessThan(15);
	});
	it('keeps the two-point linear fallback', () => {
		const two: TorqueCurvePoint[] = [
			{ rpm: 1000, torqueNm: 100 },
			{ rpm: 3000, torqueNm: 200 },
		];
		expect(torqueAtRpm(two, 2000)).toBeCloseTo(150, 6);
	});
});
