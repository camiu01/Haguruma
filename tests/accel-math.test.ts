/**
 * @file accel-math.test.ts
 * @brief Unit tests for the time-step acceleration solver.
 */
import { describe, expect, it } from 'vitest';
import { QUARTER_MILE_M, simulateAcceleration, type SimInput } from '../src/core/math/accel-math';
import type { EngineCurve } from '../src/core/math/traction-math';

/** Default curve: 110 kW turbo-ish hatch. */
const curve: EngineCurve = {
	redline: 7000,
	peakTorqueRpm: 4000,
	peakTorqueNm: 300,
	peakPowerRpm: 6000,
	peakPowerKw: 220,
};

/**
 * Build a baseline simulation input.
 * @brief Defaults to a 1400 kg RWD sports car on sticky tires.
 * @param overrides Partial fields replacing the baseline.
 * @return Complete SimInput.
 */
const makeInput = (overrides: Partial<SimInput> = {}): SimInput => ({
	massKg: 1400,
	gears: [3.2, 2.1, 1.5, 1.15, 0.92, 0.76],
	fd: 3.7,
	circM: 2.05,
	curve,
	drivetrainEff: 0.85,
	rotatingMassKg: 0,
	shiftTimeS: 0,
	dragCd: 0.32,
	frontalAreaM2: 2.0,
	rollingCrr: 0.012,
	roadGradePercent: 0,
	...overrides,
});

describe('simulateAcceleration', () => {
	it('completes a realistic 0-100 and quarter mile', () => {
		const r = simulateAcceleration(makeInput());
		expect(r.time0To100S).not.toBeNull();
		expect(r.quarterMileS).not.toBeNull();
		expect(r.trapSpeedKmh).not.toBeNull();
		expect(r.time0To100S as number).toBeGreaterThan(2);
		expect(r.time0To100S as number).toBeLessThan(12);
		expect(r.quarterMileS as number).toBeGreaterThan(r.time0To100S as number);
		expect(r.trapSpeedKmh as number).toBeGreaterThan(100);
		expect(r.distanceM).toBeGreaterThanOrEqual(QUARTER_MILE_M);
		expect(r.distanceM).toBeLessThan(QUARTER_MILE_M + 1);
	});

	it('is deterministic for identical inputs', () => {
		const a = simulateAcceleration(makeInput());
		const b = simulateAcceleration(makeInput());
		expect(a.time0To100S).toBe(b.time0To100S);
		expect(a.quarterMileS).toBe(b.quarterMileS);
		expect(a.trapSpeedKmh).toBe(b.trapSpeedKmh);
	});

	it('slows down when effective mass grows', () => {
		const light = simulateAcceleration(makeInput({ massKg: 1400 }));
		const heavy = simulateAcceleration(makeInput({ massKg: 1800 }));
		expect(heavy.time0To100S as number).toBeGreaterThan(light.time0To100S as number);
	});

	it('slows down when rotating mass grows', () => {
		const none = simulateAcceleration(makeInput({ rotatingMassKg: 0 }));
		const heavy = simulateAcceleration(makeInput({ rotatingMassKg: 400 }));
		expect(heavy.time0To100S as number).toBeGreaterThan(none.time0To100S as number);
	});

	it('slows down when shift time grows', () => {
		const instant = simulateAcceleration(makeInput({ shiftTimeS: 0 }));
		const slow = simulateAcceleration(makeInput({ shiftTimeS: 0.3 }));
		expect(slow.time0To100S as number).toBeGreaterThan(instant.time0To100S as number);
	});

	it('speeds up launch when launchRpm holds clutch slip torque', () => {
		const idle = simulateAcceleration(makeInput({ launchRpm: undefined }));
		const slipped = simulateAcceleration(makeInput({ launchRpm: 3500 }));
		expect(slipped.time0To100S as number).toBeLessThan(idle.time0To100S as number);
	});

	it('reflects physical inertias per gear when provided', () => {
		const staticNone = simulateAcceleration(makeInput({ rotatingMassKg: 0 }));
		const withInertias = simulateAcceleration(
			makeInput({ engineInertiaKgM2: 0.2, wheelInertiaKgM2: 1.2, rotatingMassKg: 0 }),
		);
		expect(withInertias.time0To100S as number).toBeGreaterThan(staticNone.time0To100S as number);
	});

	it('falls back to static rotatingMassKg when inertias are absent', () => {
		const base = makeInput({ rotatingMassKg: 300 });
		const withGarbageInertias = makeInput({ rotatingMassKg: 300, engineInertiaKgM2: Number.NaN });
		expect(simulateAcceleration(withGarbageInertias).time0To100S).toBe(simulateAcceleration(base).time0To100S);
	});

	it('clamps an out-of-range launchRpm instead of throwing', () => {
		const high = simulateAcceleration(makeInput({ launchRpm: 99999 }));
		const redlineHit = simulateAcceleration(makeInput({ launchRpm: curve.redline }));
		expect(high.time0To100S).not.toBeNull();
		expect(high.time0To100S).toBe(redlineHit.time0To100S);
	});

	it('returns null metrics for invalid mass', () => {
		const r = simulateAcceleration(makeInput({ massKg: 0 }));
		expect(r.time0To100S).toBeNull();
		expect(r.quarterMileS).toBeNull();
		expect(r.trapSpeedKmh).toBeNull();
	});

	it('returns null metrics for a garbage curve', () => {
		const r = simulateAcceleration(makeInput({ curve: { ...curve, redline: Number.NaN } }));
		expect(r.time0To100S).toBeNull();
		expect(r.quarterMileS).toBeNull();
	});

	it('returns null metrics for empty gears', () => {
		const r = simulateAcceleration(makeInput({ gears: [] }));
		expect(r.time0To100S).toBeNull();
		expect(r.quarterMileS).toBeNull();
	});

	it('exports the exact quarter-mile distance', () => {
		expect(QUARTER_MILE_M).toBeCloseTo(402.33928, 5);
	});
});
