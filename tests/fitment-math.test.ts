/**
 * @file fitment-math.test.ts
 * @brief Unit tests for the rim-channel sizing and fitment classifier.
 */
import { describe, expect, it } from 'vitest';
import {
	classifyFitment,
	fitmentRatio,
	idealRimWidthInch,
	rimRangeForTire,
	tireRangeForRim,
} from '../src/core/math/fitment-math';

describe('rimRangeForTire', () => {
	it('centres a 205 tire on a 6.5 inch channel', () => {
		expect(rimRangeForTire(205)).toEqual({ min: 5.5, ideal: 6.5, max: 7.5 });
	});
	it('rejects widths outside the catalog span', () => {
		expect(rimRangeForTire(100)).toBeNull();
		expect(rimRangeForTire(500)).toBeNull();
		expect(rimRangeForTire(NaN)).toBeNull();
	});
});

describe('tireRangeForRim', () => {
	it('maps a 7.5 inch channel to the 210-270 tire window', () => {
		expect(tireRangeForRim(7.5)).toEqual({ min: 210, ideal: 240, max: 270 });
	});
	it('rejects channels outside the 4-14 inch span', () => {
		expect(tireRangeForRim(3)).toBeNull();
		expect(tireRangeForRim(20)).toBeNull();
	});
});

describe('idealRimWidthInch', () => {
	it('rounds the ideal channel to half inches', () => {
		expect(idealRimWidthInch(205)).toBe(6.5);
		expect(idealRimWidthInch(225)).toBe(7);
	});
	it('returns NaN on invalid widths', () => {
		expect(idealRimWidthInch(0)).toBeNaN();
	});
});

describe('classifyFitment', () => {
	it('walks the full balloon-to-stretch scale on a 205 tire', () => {
		expect(classifyFitment(205, 5)).toBe('balloon');
		expect(classifyFitment(205, 5.5)).toBe('bulge');
		expect(classifyFitment(205, 6.5)).toBe('square');
		expect(classifyFitment(205, 7.5)).toBe('flush');
		expect(classifyFitment(205, 8)).toBe('stretch');
	});
	it('returns null on invalid input', () => {
		expect(classifyFitment(0, 7)).toBeNull();
		expect(classifyFitment(205, 0)).toBeNull();
	});
});

describe('fitmentRatio', () => {
	it('reports the channel share of the section width', () => {
		expect(fitmentRatio(205, 6.5)).toBeCloseTo(0.805, 3);
		expect(fitmentRatio(0, 7)).toBeNaN();
	});
});
