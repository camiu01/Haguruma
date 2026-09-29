/**
 * @file recovery-math.test.ts
 * @brief Unit tests for gear-drop recovery time.
 */
import { describe, expect, it } from 'vitest';
import { gearDropRecoveryMs } from '../src/core/math/recovery-math';

describe('gearDropRecoveryMs', () => {
	it('matches hand computation for a 1500 rpm window', () => {
		const ms = gearDropRecoveryMs(4000, 5500, 3.58 * 4.1, 1.935, 1500, 3000);
		const rpmToKmh = (1.935 * 60) / (1000 * 3.58 * 4.1);
		const expected = ((((1500 * rpmToKmh) / 3.6) / (3000 / 1500)) * 1000);
		expect(ms).toBeCloseTo(expected, 6);
		expect(ms).toBeGreaterThan(0);
	});
	it('shrinks with residual force and vanishes at target', () => {
		const slow = gearDropRecoveryMs(4000, 5500, 14.678, 1.935, 1500, 1500);
		const fast = gearDropRecoveryMs(4000, 5500, 14.678, 1.935, 1500, 6000);
		expect(fast).toBeLessThan(slow);
		expect(gearDropRecoveryMs(5500, 5500, 14.678, 1.935, 1500, 3000)).toBe(0);
		expect(gearDropRecoveryMs(6000, 5500, 14.678, 1.935, 1500, 3000)).toBe(0);
	});
	it('returns Infinity without drive and 0 on invalid input', () => {
		expect(gearDropRecoveryMs(4000, 5500, 14.678, 1.935, 1500, 0)).toBe(Number.POSITIVE_INFINITY);
		expect(gearDropRecoveryMs(0, 5500, 14.678, 1.935, 1500, 3000)).toBe(0);
		expect(gearDropRecoveryMs(4000, 5500, 0, 1.935, 1500, 3000)).toBe(0);
		expect(gearDropRecoveryMs(Number.NaN, 5500, 14.678, 1.935, 1500, 3000)).toBe(0);
	});
});
