/**
 * @file traction-math.test.ts
 * @brief Unit tests for torque, tractive force and optimal shift math.
 */
import { describe, expect, it } from 'vitest';
import {
	dynamicRadiusM,
	enginePowerAt,
	engineTorqueAt,
	optimalShiftFor,
	optimalShiftsForAll,
	powerFromTorque,
	torqueFromPower,
	tractiveForceAt,
	validateCurve,
	type EngineCurve,
} from '../src/core/math/traction-math';

/**
 * @brief Build a typical sport-engine curve fixture.
 * @return Validated engine anchors.
 */
const makeCurve = (): EngineCurve => ({
	redline: 7200,
	peakTorqueRpm: 4500,
	peakTorqueNm: 180,
	peakPowerRpm: 6500,
	peakPowerKw: 110,
});

describe('torqueFromPower/powerFromTorque', () => {
	it('round-trips through the 9550 constant', () => {
		expect(powerFromTorque(torqueFromPower(110, 6500), 6500)).toBeCloseTo(110, 5);
	});
	it('rejects invalid inputs', () => {
		expect(torqueFromPower(110, 0)).toBe(0);
		expect(powerFromTorque(-5, 4000)).toBe(0);
	});
});

describe('enginePowerAt/engineTorqueAt', () => {
	it('peaks at the power anchor', () => {
		const curve = makeCurve();
		const peak = enginePowerAt(6500, curve);
		expect(peak).toBeCloseTo(110, 0);
		expect(enginePowerAt(4500, curve)).toBeLessThan(peak);
	});
	it('droops slightly past peak power toward redline', () => {
		const curve = makeCurve();
		expect(enginePowerAt(7200, curve)).toBeLessThan(enginePowerAt(6500, curve));
	});
	it('torque matches power divided by speed', () => {
		const curve = makeCurve();
		const rpm = 4500;
		expect(engineTorqueAt(rpm, curve)).toBeCloseTo((enginePowerAt(rpm, curve) * 9550) / rpm, 3);
	});
});

describe('validateCurve', () => {
	it('clamps out-of-order anchors', () => {
		const curve = validateCurve({ ...makeCurve(), peakTorqueRpm: 7000, peakPowerRpm: 9000 });
		expect(curve?.peakPowerRpm).toBe(7200);
		expect(curve?.peakTorqueRpm).toBeLessThanOrEqual(curve?.peakPowerRpm ?? 0);
	});
	it('rejects missing power', () => {
		expect(validateCurve({ ...makeCurve(), peakPowerKw: 0 })).toBeNull();
	});
});

describe('tractiveForceAt/dynamicRadiusM', () => {
	it('scales with total ratio and efficiency', () => {
		const curve = makeCurve();
		const radius = dynamicRadiusM(1.935);
		const tall = tractiveForceAt(4500, 3.58, 4.1, radius, curve, 0.85);
		const short = tractiveForceAt(4500, 1.0, 4.1, radius, curve, 0.85);
		expect(tall).toBeGreaterThan(short);
		expect(tractiveForceAt(4500, 1.0, 4.1, radius, curve, 1.0)).toBeGreaterThan(short);
	});
	it('rejects invalid geometry', () => {
		expect(dynamicRadiusM(0)).toBe(0);
		expect(tractiveForceAt(4500, 1.0, 4.1, 0, makeCurve(), 0.85)).toBe(0);
	});
});

describe('optimalShiftFor/optimalShiftsForAll', () => {
	it('returns one prescription per gear change', () => {
		const gears = [3.58, 2.05, 1.38, 1.0];
		const shifts = optimalShiftsForAll(gears, 4.1, 1.935, makeCurve(), 0.85, 'kmh');
		expect(shifts).toHaveLength(3);
		expect(shifts[0].shiftRpm).toBeGreaterThan(shifts[0].landingRpm);
	});
	it('close ratios shift below redline (next gear catches up at high RPM)', () => {
		const shift = optimalShiftFor([1.0, 0.95], 0, 4.1, 1.935, makeCurve(), 0.85, 'kmh');
		expect(shift).not.toBeNull();
		expect(shift!.shiftRpm).toBeGreaterThan(2000);
		expect(shift!.shiftRpm).toBeLessThan(7200);
	});
	it('returns null without a curve', () => {
		expect(optimalShiftFor([3.58, 2.05], 0, 4.1, 1.935, null, 0.85, 'kmh')).toBeNull();
	});
});
