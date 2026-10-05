/**
 * @file braking-simulation.test.ts
 * @brief Stopping profile, wheel-lock, ABS and signed-road-load regression.
 */
import { describe, expect, it } from 'vitest';
import { brakingAtSpeed, simulateBraking } from '../src/core/math/braking-simulation';
import { brakingInput } from './dynamics-fixtures';

describe('stopping integration', () => {
	it('matches constant-deceleration distance and time with ideal bias and no cycling', () => {
		const rg = { ...brakingInput().runningGear, centerOfGravityHeightMm: 0 };
		const result = simulateBraking(brakingInput({ runningGear: rg, frontBias: rg.frontWeightDistribution, demandG: 0.8 }));
		expect(result.distanceM).toBeCloseTo((100 / 3.6) ** 2 / (2 * 0.8 * 9.81), 7);
		expect(result.timeS).toBeCloseTo(100 / 3.6 / (0.8 * 9.81), 7);
		expect(result.samples.at(-1)?.speedKmh).toBe(0);
		expect(result.maxLockedWheels).toBe(0);
	});
	it('models wheel lock without ABS and recovers grip with ABS', () => {
		const locked = simulateBraking(brakingInput({ abs: false, demandG: 2 }));
		const abs = simulateBraking(brakingInput({ abs: true, demandG: 2 }));
		expect(locked.maxLockedWheels).toBeGreaterThan(0);
		expect(abs.maxLockedWheels).toBe(0);
		expect(abs.distanceM!).toBeLessThan(locked.distanceM!);
		expect(brakingAtSpeed(brakingInput(), 100, 0).decelMps2)
			.not.toBe(brakingAtSpeed(brakingInput(), 100, 1 / 24).decelMps2);
	});
	it('includes speed-dependent aero assistance and road friction', () => {
		const baseline = simulateBraking(brakingInput(), 200);
		const aero = simulateBraking(brakingInput({ dragCd: 0.4, frontalAreaM2: 2.2 }), 200);
		const slick = simulateBraking(brakingInput({ runningGear: { ...brakingInput().runningGear, tireCompoundId: 'slick' } }), 200);
		expect(aero.distanceM!).toBeLessThan(baseline.distanceM!);
		expect(slick.distanceM!).toBeLessThan(baseline.distanceM!);
		const samples = aero.samples;
		expect(samples[0].decelMps2).toBeGreaterThan(samples.at(-1)!.decelMps2);
	});
	it('gets longer downhill and returns null for an unstoppable run', () => {
		const baseline = simulateBraking(brakingInput());
		expect(simulateBraking(brakingInput({ roadGradePercent: -10 })).distanceM!).toBeGreaterThan(baseline.distanceM!);
		expect(simulateBraking(brakingInput({ demandG: 0, roadGradePercent: -20 })).distanceM).toBeNull();
	});
	it('handles invalid inputs and zero friction without NaN', () => {
		expect(simulateBraking(brakingInput({ massKg: NaN })).samples).toEqual([]);
		expect(simulateBraking(brakingInput(), Infinity).distanceM).toBeNull();
		expect(simulateBraking(brakingInput({ frontBias: NaN })).distanceM).toBeNull();
		expect(simulateBraking(brakingInput({ runningGear: { ...brakingInput().runningGear, roadFrictionCoefficient: 0 } })).distanceM).toBeNull();
	});
	it('reports monotonically increasing distance and declining speed', () => {
		const result = simulateBraking(brakingInput(), 200);
		for (let i = 1; i < result.samples.length; i += 1) {
			expect(result.samples[i].distanceM).toBeGreaterThan(result.samples[i - 1].distanceM);
			expect(result.samples[i].speedKmh).toBeLessThan(result.samples[i - 1].speedKmh);
		}
	});
	it('does not double-count grip when service brakes and engine braking overlap', () => {
		const input = brakingInput({ demandG: 3, engineBrakeN: 10000 });
		const result = brakingAtSpeed(input, 100);
		expect(result.decelMps2).toBeLessThanOrEqual(9.81 + 0.001);
		expect(result.lockedWheels).toBe(0);
	});
});
