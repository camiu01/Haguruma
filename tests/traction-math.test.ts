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
	it('round-trips through the constant', () => {
		expect(powerFromTorque(torqueFromPower(110, 6500), 6500)).toBeCloseTo(110, 4);
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
		expect(engineTorqueAt(rpm, curve)).toBeCloseTo((enginePowerAt(rpm, curve) * 30000 / Math.PI) / rpm, 3);
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
	it('ignores low-rpm force wiggles and holds redline without a late crossing', () => {
		const hose = { ...makeCurve(), peakTorqueRpm: 1500, peakTorqueNm: 400 };
		const shift = optimalShiftFor([3.58, 2.05], 0, 4.1, 1.935, hose, 0.85, 'kmh');
		expect(shift).not.toBeNull();
		expect(shift!.shiftRpm).toBeGreaterThanOrEqual(7000);
	});
	it('returns null without a curve', () => {
		expect(optimalShiftFor([3.58, 2.05], 0, 4.1, 1.935, null, 0.85, 'kmh')).toBeNull();
	});
});

describe('dyno point curves', () => {
	const points = [
		{ rpm: 1000, torqueNm: 100 },
		{ rpm: 3000, torqueNm: 200 },
		{ rpm: 6000, torqueNm: 150 },
	];
	const curve = validateCurve({ ...makeCurve(), points });
	it('engineTorqueAt returns the measured torque directly', () => {
		expect(engineTorqueAt(3000, curve!)).toBeCloseTo(200, 6);
		const mid = engineTorqueAt(2000, curve!);
		expect(mid).toBeGreaterThan(100);
		expect(mid).toBeLessThan(200);
	});
	it('enginePowerAt equals T x n / 9549.3 on the measured curve', () => {
		expect(enginePowerAt(3000, curve!)).toBeCloseTo((200 * 3000) / (30000 / Math.PI), 3);
	});
	it('cuts to zero past the rev limiter', () => {
		expect(engineTorqueAt(8000, curve!)).toBe(0);
		expect(enginePowerAt(8000, curve!)).toBe(0);
	});
	it('tapers power past the last measured point toward the limiter', () => {
		const lastKw = (150 * 6000) / (30000 / Math.PI);
		const midKw = lastKw * (1 - 0.1 * ((6600 - 6000) / (7200 - 6000)));
		expect(enginePowerAt(6600, curve!)).toBeCloseTo(midKw, 3);
		expect(enginePowerAt(7200, curve!)).toBeCloseTo(lastKw * 0.9, 3);
	});
	it('keeps the anchor model without points', () => {
		const anchors = validateCurve(makeCurve());
		expect(engineTorqueAt(4500, anchors!)).toBeCloseTo(180, 0);
	});
});
