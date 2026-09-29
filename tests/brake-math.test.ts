/**
 * @file brake-math.test.ts
 * @brief Unit tests for brake bias and stopping distance.
 */
import { describe, expect, it } from 'vitest';
import { REAR_LOCK_SHARE, idealBrakeBiasFront, stoppingDistanceM } from '../src/core/math/brake-math';
import { GRAVITY } from '../src/core/math/dynamics-math';

describe('idealBrakeBiasFront', () => {
	it('matches hand-computed load transfer at 1.2G', () => {
		const b = idealBrakeBiasFront(6867, 6867, 2.7, 0.5, 1.2);
		expect(b.frontDynN).toBeCloseTo(6867 + 13734 * 1.2 * (0.5 / 2.7), 3);
		expect(b.frontBias).toBeCloseTo(0.722, 2);
		expect(b.rearLockRisk).toBe(false);
	});
	it('flags rear lockup when the rear axle unloads', () => {
		const b = idealBrakeBiasFront(6867, 6867, 2.7, 0.5, 3);
		expect(b.rearDynN).toBe(0);
		expect(b.frontBias).toBe(1);
		expect(b.rearLockRisk).toBe(true);
		expect(REAR_LOCK_SHARE).toBe(0.2);
	});
	it('returns neutral zeros on invalid input', () => {
		expect(idealBrakeBiasFront(0, 0, 2.7, 0.5, 1)).toEqual({ frontBias: 0, frontDynN: 0, rearDynN: 0, rearLockRisk: false });
		expect(idealBrakeBiasFront(6867, 6867, 0, 0.5, 1).frontBias).toBe(0);
		expect(idealBrakeBiasFront(Number.NaN, 6867, 2.7, 0.5, 1).frontBias).toBe(0);
	});
});

describe('stoppingDistanceM', () => {
	it('matches v^2/2a at 100 km/h on mu 1.0', () => {
		const vms = 100 / 3.6;
		expect(stoppingDistanceM(100, 1.0, 1400)).toBeCloseTo((vms * vms) / (2 * GRAVITY), 6);
	});
	it('shortens with drag help and lengthens downhill', () => {
		const base = stoppingDistanceM(100, 1.0, 1400);
		expect(stoppingDistanceM(100, 1.0, 1400, 2000)).toBeLessThan(base);
		expect(stoppingDistanceM(100, 1.0, 1400, 0, -20000)).toBeGreaterThan(base);
	});
	it('returns 0 on invalid input and Infinity when deceleration is not positive', () => {
		expect(stoppingDistanceM(100, 0, 1400)).toBe(0);
		expect(stoppingDistanceM(-10, 1, 1400)).toBe(0);
		expect(stoppingDistanceM(100, 0.05, 1400, 0, -5000)).toBe(Number.POSITIVE_INFINITY);
	});
});
