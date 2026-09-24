/**
 * @file inertia-math.test.ts
 * @brief Unit tests for equivalent rotating-mass reflection.
 */
import { describe, expect, it } from 'vitest';
import { equivalentRotatingMassKg, launchRotatingMassKg } from '../src/core/math/inertia-math';

describe('equivalentRotatingMassKg', () => {
	it('reflects engine inertia through the total ratio', () => {
		const m = equivalentRotatingMassKg({
			engineInertiaKgM2: 0.2,
			wheelInertiaKgM2: 1.2,
			gearRatio: 3.5,
			fd: 4.0,
			dynRadiusM: 0.3,
			wheelCount: 4,
		});
		const ratio = 3.5 * 4.0;
		const expected = (0.2 * ratio * ratio + 4 * 1.2) / (0.3 * 0.3);
		expect(m).toBeCloseTo(expected, 6);
		expect(m).toBeGreaterThan(0);
	});

	it('grows with a shorter first gear', () => {
		const base = { engineInertiaKgM2: 0.2, wheelInertiaKgM2: 1.2, fd: 4.0, dynRadiusM: 0.3 };
		const tall = equivalentRotatingMassKg({ ...base, gearRatio: 1.0 });
		const short = equivalentRotatingMassKg({ ...base, gearRatio: 4.0 });
		expect(short).toBeGreaterThan(tall);
	});

	it('returns 0 for invalid inputs', () => {
		expect(
			equivalentRotatingMassKg({
				engineInertiaKgM2: Number.NaN,
				wheelInertiaKgM2: 1,
				gearRatio: 3,
				fd: 4,
				dynRadiusM: 0.3,
			}),
		).toBe(0);
		expect(
			equivalentRotatingMassKg({
				engineInertiaKgM2: 0.2,
				wheelInertiaKgM2: 1,
				gearRatio: 0,
				fd: 4,
				dynRadiusM: 0.3,
			}),
		).toBe(0);
	});
});

describe('launchRotatingMassKg', () => {
	it('uses first gear of the gearset', () => {
		const m = launchRotatingMassKg(0.2, 1.2, [3.5, 2.1, 1.4], 4.0, 0.3);
		const expected = equivalentRotatingMassKg({
			engineInertiaKgM2: 0.2,
			wheelInertiaKgM2: 1.2,
			gearRatio: 3.5,
			fd: 4.0,
			dynRadiusM: 0.3,
		});
		expect(m).toBeCloseTo(expected, 6);
	});

	it('returns 0 for an empty gearset', () => {
		expect(launchRotatingMassKg(0.2, 1.2, [], 4.0, 0.3)).toBe(0);
	});
});
