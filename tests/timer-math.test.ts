/**
 * @file timer-math.test.ts
 * @brief Unit tests for phone speed-series splits.
 */
import { describe, expect, it } from 'vitest';
import { splitsFromSpeedSeries } from '../src/core/math/timer-math';

/**
 * @brief Build a linear 0-120 km/h series at 1 s steps.
 * @return Seven samples from standstill.
 */
const ramp = (): { t: number; speedKmh: number }[] => {
	const out: { t: number; speedKmh: number }[] = [];
	for (let idx = 0; idx <= 6; idx += 1) {
		out.push({ t: idx, speedKmh: idx * 20 });
	}
	return out;
};

describe('splitsFromSpeedSeries', () => {
	it('interpolates the 0-100 crossing', () => {
		const splits = splitsFromSpeedSeries(ramp());
		expect(splits.time0To100S).toBe(5);
		expect(splits.time0To60S).toBeCloseTo(4.83, 2);
	});
	it('leaves unreached marks null', () => {
		const splits = splitsFromSpeedSeries(ramp());
		expect(splits.time0To160S).toBeNull();
		expect(splits.quarterS).toBeNull();
		expect(splits.trapKmh).toBeNull();
	});
	it('times the quarter mile on a long fast series', () => {
		const trace: { t: number; speedKmh: number }[] = [];
		for (let idx = 0; idx <= 40; idx += 1) {
			trace.push({ t: idx * 0.5, speedKmh: Math.min(220, idx * 11) });
		}
		const splits = splitsFromSpeedSeries(trace);
		expect(splits.quarterS).not.toBeNull();
		expect(splits.trapKmh).not.toBeNull();
		expect(splits.sixtyFtS).not.toBeNull();
	});
	it('returns nulls on tiny input', () => {
		const splits = splitsFromSpeedSeries([]);
		expect(splits.time0To100S).toBeNull();
	});
});
