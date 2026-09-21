/**
 * @file tire-math.test.ts
 * @brief Unit tests for tire string parsing.
 */
import { describe, expect, it } from 'vitest';
import { clampRollingFactor, effectiveCircumferenceM, parseTire } from '../src/core/math/tire-math';

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
