/**
 * @file tire-math.test.ts
 * @brief Unit tests for tire string parsing.
 */
import { describe, expect, it } from 'vitest';
import { clampRollingFactor, dynamicCircumferenceM, effectiveCircumferenceM, loadedDynamicRadiusM, parseTire, tireGrowthFactorAtSpeed } from '../src/core/math/tire-math';

describe('parseTire', () => {
	it('parses a valid spec', () => {
		const parsed = parseTire('205/55R16');
		expect(parsed).not.toBeNull();
		expect(parsed?.width).toBe(205);
		expect(parsed?.rimInch).toBe(16);
	});
	it('computes a realistic circumference', () => {
		const parsed = parseTire('205/55R16');
		expect(parsed?.circumferenceMm).toBeGreaterThan(1800);
		expect(parsed?.circumferenceMm).toBeLessThan(2100);
	});
	it('accepts lowercase input', () => {
		expect(parseTire('205/55r16')).not.toBeNull();
	});
	it('rejects invalid input', () => {
		expect(parseTire('invalid')).toBeNull();
		expect(parseTire('')).toBeNull();
	});
});

describe('effectiveCircumferenceM', () => {
	it('applies the ISO/ETRTO 0.975 factor by default', () => {
		const parsed = parseTire('205/55R16');
		const dyn = effectiveCircumferenceM(parsed);
		expect(dyn).toBeCloseTo((parsed?.circumferenceM ?? 0) * 0.975, 6);
	});
	it('clamps the factor and rejects null geometry', () => {
		const parsed = parseTire('205/55R16');
		expect(clampRollingFactor(2)).toBe(1.0);
		expect(clampRollingFactor(Number.NaN)).toBe(0.975);
		expect(effectiveCircumferenceM(null)).toBe(0);
		expect(effectiveCircumferenceM(parsed, 1.0)).toBeCloseTo(parsed?.circumferenceM ?? 0, 6);
	});
});

describe('loadedDynamicRadiusM', () => {
	it('reproduces the ISO factor at typical corner loads', () => {
		const r = loadedDynamicRadiusM(1.9852, 3433, 0);
		expect(r * 2 * Math.PI).toBeCloseTo(1.9852 * 0.976, 2);
	});
	it('shrinks with load and grows with speed', () => {
		const base = loadedDynamicRadiusM(1.9852, 3000, 0);
		expect(loadedDynamicRadiusM(1.9852, 5000, 0)).toBeLessThan(base);
		expect(loadedDynamicRadiusM(1.9852, 4500, 0)).toBeLessThan(base);
		expect(loadedDynamicRadiusM(1.9852, 3000, 250)).toBeGreaterThan(base);
	});
	it('floors extreme loads and rejects bad input', () => {
		const geo = 1.9852 / (2 * Math.PI);
		expect(loadedDynamicRadiusM(1.9852, 1e9, 0)).toBeCloseTo(geo / 2, 6);
		expect(loadedDynamicRadiusM(0, 3000, 0)).toBe(0);
		expect(loadedDynamicRadiusM(1.9852, Number.NaN, 0)).toBe(0);
		expect(loadedDynamicRadiusM(1.9852, 3000, 0, 0)).toBe(0);
	});
});

describe('tireGrowthFactorAtSpeed', () => {
	it('is 1 at standstill and grows with speed', () => {
		expect(tireGrowthFactorAtSpeed(0)).toBe(1);
		const city = tireGrowthFactorAtSpeed(50);
		const fast = tireGrowthFactorAtSpeed(200);
		expect(fast).toBeGreaterThan(city);
		expect(city).toBeGreaterThan(1);
	});
	it('caps growth at about 3 percent', () => {
		expect(tireGrowthFactorAtSpeed(250)).toBeCloseTo(1.03, 4);
		expect(tireGrowthFactorAtSpeed(400)).toBeCloseTo(1.03, 4);
	});
	it('matches the dynamic circumference helper', () => {
		const parsed = parseTire('225/45R17');
		const base = effectiveCircumferenceM(parsed);
		expect(dynamicCircumferenceM(parsed, 0.975, 0)).toBeCloseTo(base, 6);
		expect(dynamicCircumferenceM(parsed, 0.975, 250)).toBeCloseTo(base * 1.03, 4);
	});
});
