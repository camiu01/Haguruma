/**
 * @file compare-utils.test.ts
 * @brief Unit tests for the dual-setup comparison helpers.
 */
import { describe, expect, it } from 'vitest';
import { diffTopSpeeds, formatCompGears, parseCompGears, topsForSetup } from '../src/core/compare/compare-utils';

describe('parseCompGears', () => {
	it('parses comma-separated ratios', () => {
		expect(parseCompGears('3.58, 2.05, 1.38')).toEqual([3.58, 2.05, 1.38]);
	});
	it('rejects out-of-range ratios', () => {
		expect(parseCompGears('3.58, 99')).toBeNull();
		expect(parseCompGears('')).toBeNull();
	});
	it('rejects more than 8 gears', () => {
		expect(parseCompGears('1,1,1,1,1,1,1,1,1')).toBeNull();
	});
});

describe('formatCompGears', () => {
	it('joins ratios with comma space', () => {
		expect(formatCompGears([3.58, 2.05])).toBe('3.58, 2.05');
	});
});

describe('topsForSetup', () => {
	it('shorter final drive lowers every top speed', () => {
		const tall = topsForSetup([3.58, 1.0], 4.1, 1.985, 7200, 'kmh');
		const short = topsForSetup([3.58, 1.0], 4.77, 1.985, 7200, 'kmh');
		expect(short[0]).toBeLessThan(tall[0]);
		expect(short[1]).toBeLessThan(tall[1]);
	});
});

describe('diffTopSpeeds', () => {
	it('aligns 5-speed vs 6-speed gearsets with null', () => {
		expect(diffTopSpeeds([50, 90], [48, 88, 120])).toEqual([-2, -2, null]);
	});
	it('returns positive delta when secondary is taller', () => {
		expect(diffTopSpeeds([50], [55])).toEqual([5]);
	});
});
