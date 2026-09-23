/**
 * @file aero-math.test.ts
 * @brief Unit tests for secondary road-load physics.
 */
import { describe, expect, it } from 'vitest';
import { availableWheelKw, clampGrade, dragForce, dragLimitedSpeedKmh, gradeForce, kmhToMs, kwToHp, roadLoadPowerKw, rollingForce } from '../src/core/math/aero-math';

describe('kmhToMs', () => {
	it('converts 36 kmh to 10 m/s', () => {
		expect(kmhToMs(36)).toBeCloseTo(10, 5);
	});
});

describe('dragForce', () => {
	it('is zero at standstill', () => {
		expect(dragForce(0, 0.30, 2.0)).toBe(0);
	});
	it('grows with the square of speed', () => {
		const slow = dragForce(50, 0.30, 2.0);
		const fast = dragForce(100, 0.30, 2.0);
		expect(fast).toBeCloseTo(slow * 4, 5);
	});
	it('matches the textbook formula', () => {
		const v = 100 / 3.6;
		expect(dragForce(100, 0.30, 2.0)).toBeCloseTo(0.5 * 1.225 * 0.30 * 2.0 * v * v, 5);
	});
});

describe('rollingForce', () => {
	it('scales linearly with mass', () => {
		expect(rollingForce(1200, 0.012)).toBeCloseTo(1200 * 9.81 * 0.012, 5);
	});
	it('rejects non-positive inputs', () => {
		expect(rollingForce(0, 0.012)).toBe(0);
		expect(rollingForce(1200, 0)).toBe(0);
	});
});

describe('roadLoadPowerKw', () => {
	it('is zero at standstill', () => {
		expect(roadLoadPowerKw(0, 1270, 0.29, 1.95, 0.012)).toBe(0);
	});
	it('stays in a plausible band for the Eclipse at 200 kmh', () => {
		const kw = roadLoadPowerKw(200, 1270, 0.29, 1.95, 0.012);
		expect(kw).toBeGreaterThan(30);
		expect(kw).toBeLessThan(120);
	});
});

describe('kwToHp', () => {
	it('converts 100 kW to about 136 cv', () => {
		expect(kwToHp(100)).toBeCloseTo(135.96, 1);
	});
});

describe('availableWheelKw', () => {
	it('applies drivetrain efficiency', () => {
		expect(availableWheelKw(110, 0.85)).toBeCloseTo(93.5, 5);
	});
	it('returns zero for invalid inputs', () => {
		expect(availableWheelKw(0, 0.85)).toBe(0);
		expect(availableWheelKw(110, 0)).toBe(0);
	});
});

describe('dragLimitedSpeedKmh', () => {
	it('returns zero without power', () => {
		expect(dragLimitedSpeedKmh(0, 1270, 0.29, 1.95, 0.012)).toBe(0);
	});
	it('matches the Eclipse real-world anchor near 215-225 kmh', () => {
		const wheelKw = availableWheelKw(110, 0.85);
		const limit = dragLimitedSpeedKmh(wheelKw, 1270, 0.29, 1.95, 0.012);
		expect(limit).toBeGreaterThan(205);
		expect(limit).toBeLessThan(235);
	});
	it('rises with available power', () => {
		const slow = dragLimitedSpeedKmh(60, 1270, 0.29, 1.95, 0.012);
		const fast = dragLimitedSpeedKmh(120, 1270, 0.29, 1.95, 0.012);
		expect(fast).toBeGreaterThan(slow);
	});
	it('scales past 400 kmh for record power without a hard cap', () => {
		const limit = dragLimitedSpeedKmh(1500, 1000, 0.2, 1.2, 0.008);
		expect(limit).toBeGreaterThan(400);
		expect(limit).toBeLessThanOrEqual(600);
	});
	it('handles steep descents without NaN and stays bounded', () => {
		const limit = dragLimitedSpeedKmh(60, 1270, 0.29, 1.95, 0.012, -30);
		expect(Number.isFinite(limit)).toBe(true);
		expect(limit).toBeGreaterThanOrEqual(0);
		expect(limit).toBeLessThanOrEqual(600);
	});
	it('returns a crawl speed when power barely beats standstill load', () => {
		expect(dragLimitedSpeedKmh(1, 3000, 0.6, 4.0, 0.03, 30)).toBeLessThan(5);
	});
});

describe('gradeForce/clampGrade', () => {
	it('adds uphill power demand and clamps the slope', () => {
		expect(clampGrade(99)).toBe(30);
		expect(gradeForce(1270, 10)).toBeGreaterThan(0);
		expect(gradeForce(1270, -5)).toBeLessThan(0);
		const flat = roadLoadPowerKw(100, 1270, 0.29, 1.95, 0.012);
		const climb = roadLoadPowerKw(100, 1270, 0.29, 1.95, 0.012, 10);
		expect(climb).toBeGreaterThan(flat);
	});
});
