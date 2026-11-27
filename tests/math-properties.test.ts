/**
 * @file math-properties.test.ts
 * @brief Property-based tests (fast-check) for the speed and traction math.
 *
 * Random drivetrains check the invariants the hand-written cases cannot cover
 * exhaustively: results are always finite, speed is monotonic in RPM and in
 * gearing, the RPM/speed pair round-trips, and tractive force never goes
 * negative or non-finite.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { rpmFromKmh, speedKmh } from '../src/core/math/speed-math';
import { dynamicRadiusM, tractiveForceAt, type EngineCurve } from '../src/core/math/traction-math';

const rpmArb = fc.double({ min: 0, max: 20000, noNaN: true });
const ratioArb = fc.double({ min: 0.3, max: 6, noNaN: true });
const fdArb = fc.double({ min: 2, max: 6, noNaN: true });
const circArb = fc.double({ min: 1.2, max: 2.8, noNaN: true });
const anyNumber = fc.oneof(fc.double(), fc.constant(Number.NaN), fc.constant(Infinity), fc.constant(-Infinity));

const curve: EngineCurve = {
	redline: 7200,
	peakTorqueRpm: 4500,
	peakTorqueNm: 180,
	peakPowerRpm: 6500,
	peakPowerKw: 110,
};

describe('speed-math properties', () => {
	it('always returns a finite, non-negative speed, even for garbage input', () => {
		fc.assert(
			fc.property(anyNumber, anyNumber, anyNumber, anyNumber, (rpm, gear, fd, circ) => {
				const v = speedKmh(rpm, gear, fd, circ);
				expect(Number.isFinite(v)).toBe(true);
				expect(v).toBeGreaterThanOrEqual(0);
			}),
		);
	});

	it('is monotonic in engine speed', () => {
		fc.assert(
			fc.property(rpmArb, rpmArb, ratioArb, fdArb, circArb, (a, b, gear, fd, circ) => {
				const [lo, hi] = a <= b ? [a, b] : [b, a];
				expect(speedKmh(lo, gear, fd, circ)).toBeLessThanOrEqual(speedKmh(hi, gear, fd, circ) + 1e-9);
			}),
		);
	});

	it('gets slower as the overall ratio gets shorter', () => {
		fc.assert(
			fc.property(rpmArb, ratioArb, ratioArb, fdArb, circArb, (rpm, a, b, fd, circ) => {
				const [tall, short] = a <= b ? [a, b] : [b, a];
				expect(speedKmh(rpm, short, fd, circ)).toBeLessThanOrEqual(speedKmh(rpm, tall, fd, circ) + 1e-9);
			}),
		);
	});

	it('round-trips RPM through speed', () => {
		fc.assert(
			fc.property(fc.double({ min: 500, max: 20000, noNaN: true }), ratioArb, fdArb, circArb, (rpm, gear, fd, circ) => {
				const back = rpmFromKmh(speedKmh(rpm, gear, fd, circ), gear, fd, circ);
				expect(Math.abs(back - rpm) / rpm).toBeLessThan(1e-9);
			}),
		);
	});
});

describe('traction-math properties', () => {
	it('never produces a negative or non-finite tractive force', () => {
		fc.assert(
			fc.property(rpmArb, ratioArb, fdArb, circArb, fc.double({ min: 0.5, max: 1, noNaN: true }), (rpm, gear, fd, circ, eff) => {
				const force = tractiveForceAt(rpm, gear, fd, dynamicRadiusM(circ), curve, eff);
				expect(Number.isFinite(force)).toBe(true);
				expect(force).toBeGreaterThanOrEqual(0);
			}),
		);
	});

	it('scales tractive force with the overall ratio at a fixed RPM', () => {
		fc.assert(
			fc.property(fc.double({ min: 1000, max: 7000, noNaN: true }), ratioArb, ratioArb, fdArb, circArb, (rpm, a, b, fd, circ) => {
				const [tall, short] = a <= b ? [a, b] : [b, a];
				const r = dynamicRadiusM(circ);
				expect(tractiveForceAt(rpm, short, fd, r, curve, 0.85)).toBeGreaterThanOrEqual(tractiveForceAt(rpm, tall, fd, r, curve, 0.85) - 1e-9);
			}),
		);
	});

	it('returns a finite dynamic radius for any input', () => {
		fc.assert(fc.property(anyNumber, (circ) => Number.isFinite(dynamicRadiusM(circ))));
	});
});
