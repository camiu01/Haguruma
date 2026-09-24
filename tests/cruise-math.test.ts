/**
 * @file cruise-math.test.ts
 * @brief Unit tests for the highway cruising RPM/load check.
 */
import { describe, expect, it } from 'vitest';
import { CRUISE_MIN_RPM, cruiseCheck, type CruiseInput } from '../src/core/math/cruise-math';
import { rpmFromKmh } from '../src/core/math/speed-math';
import type { EngineCurve } from '../src/core/math/traction-math';

/** Baseline 110 kW hatch curve. */
const curve: EngineCurve = {
	redline: 7200,
	peakTorqueRpm: 4500,
	peakTorqueNm: 180,
	peakPowerRpm: 6500,
	peakPowerKw: 110,
};

/**
 * Build a baseline cruise input matching default state.
 * @param overrides Partial fields replacing the baseline.
 * @return Complete CruiseInput.
 */
const makeInput = (overrides: Partial<CruiseInput> = {}): CruiseInput => ({
	speedKmh: 130,
	gears: [3.58, 2.05, 1.38, 1.0, 0.81, 0.68],
	fd: 4.1,
	circM: 2.0,
	curve,
	drivetrainEff: 0.85,
	massKg: 1200,
	dragCd: 0.3,
	frontalAreaM2: 2.0,
	rollingCrr: 0.012,
	roadGradePercent: 0,
	...overrides,
});

describe('cruiseCheck', () => {
	it('selects a gear at or above the RPM floor', () => {
		const r = cruiseCheck(makeInput());
		expect(r).not.toBeNull();
		expect(r!.rpm).toBeGreaterThanOrEqual(CRUISE_MIN_RPM - 1);
	});

	it('computes RPM consistent with rpmFromKmh', () => {
		const input = makeInput();
		const r = cruiseCheck(input)!;
		const gear = input.gears[r.gearIndex];
		expect(r.rpm).toBeCloseTo(rpmFromKmh(130, gear, input.fd, input.circM), 6);
	});

	it('flags a power deficit at an absurd speed', () => {
		const r = cruiseCheck(makeInput({ speedKmh: 300 }));
		expect(r).not.toBeNull();
		expect(r!.verdict).toBe('over');
		expect(r!.engineLoadPct).toBeGreaterThan(100);
	});

	it('is comfortable at highway speed in a tall gear', () => {
		const r = cruiseCheck(makeInput({ speedKmh: 120 }));
		expect(r).not.toBeNull();
		expect(r!.verdict).toBe('ok');
		expect(r!.engineLoadPct).toBeLessThan(100);
	});

	it('returns null for invalid inputs', () => {
		expect(cruiseCheck(makeInput({ speedKmh: 0 }))).toBeNull();
		expect(cruiseCheck(makeInput({ gears: [] }))).toBeNull();
		expect(cruiseCheck(makeInput({ massKg: 0 }))).toBeNull();
		expect(cruiseCheck(makeInput({ curve: null as unknown as EngineCurve }))).toBeNull();
	});
});
