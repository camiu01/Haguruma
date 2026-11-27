/**
 * @file pyrometer-axle-math.test.ts
 * @brief Four-corner balance, side and drift-instability verdicts.
 */
import { describe, expect, it } from 'vitest';
import { cornerMean, diagnoseAxles, type CornerSet, type CornerTemps } from '../src/core/math/pyrometer-axle-math';

/**
 * @brief Flat tire reading at one temperature.
 * @param c Temperature in °C.
 * @return Three equal zones.
 */
const flat = (c: number): CornerTemps => ({ inner: c, center: c, outer: c });

/**
 * @brief Build a corner set from four flat temperatures.
 * @param fl Front left.
 * @param fr Front right.
 * @param rl Rear left.
 * @param rr Rear right.
 * @return Corner set.
 */
const set = (fl: number, fr: number, rl: number, rr: number): CornerSet => ({ fl: flat(fl), fr: flat(fr), rl: flat(rl), rr: flat(rr) });

describe('pyrometer-axle-math', () => {
	it('averages the three zones', () => {
		expect(cornerMean({ inner: 80, center: 90, outer: 100 })).toBe(90);
	});

	it('reports balanced axles and sides inside the tolerance', () => {
		const d = diagnoseAxles(set(85, 86, 88, 89), 2.2);
		expect(d.axle).toBe('balanced');
		expect(d.side).toBe('balanced');
		expect(d.driftRisk).toBe(false);
	});

	it('flags a hot front axle as understeer', () => {
		expect(diagnoseAxles(set(100, 100, 85, 85), 2.2).axle).toBe('front-hot');
	});

	it('flags a hot rear axle and drift risk when the rear outer edges run hotter', () => {
		const d = diagnoseAxles(set(85, 85, 100, 100), 2.2);
		expect(d.axle).toBe('rear-hot');
		expect(d.frontRearDeltaC).toBeCloseTo(15, 5);
		expect(d.driftRisk).toBe(true);
	});

	it('reads which side the circuit loads', () => {
		expect(diagnoseAxles(set(100, 85, 100, 85), 2.2).side).toBe('left-hot');
		expect(diagnoseAxles(set(85, 100, 85, 100), 2.2).side).toBe('right-hot');
	});

	it('gives per-corner camber advice from the single-tire rules', () => {
		const s = set(85, 85, 85, 85);
		s.fl = { inner: 70, center: 85, outer: 95 };
		expect(diagnoseAxles(s, 2.2).corners.fl.camber).toBe('more-negative');
	});
});
