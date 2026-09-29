/**
 * @file shift-drops.test.ts
 * @brief Unit tests for shift-drop visibility helpers.
 */
import { describe, expect, it } from 'vitest';
import { isPeakVisible } from '../src/services/graph/graph-shift-drops';
import { describeAllShiftDeltas, describeShiftDelta } from '../src/core/math/shift-math';
import type { PeakPoint, PlotFrame } from '../src/core/models';

/**
 * @brief Build a fixed frame fixture.
 * @return PlotFrame for visibility tests.
 */
const makeFrame = (): PlotFrame => ({
	width: 800,
	height: 500,
	paddingTop: 25,
	paddingRight: 30,
	paddingBottom: 40,
	paddingLeft: 55,
	plotWidth: 715,
	plotHeight: 435,
	maxSpeed: 300,
	maxRpm: 8000,
});

/**
 * @brief Build a peak point at a given X.
 * @param endX Canvas X coordinate.
 * @return PeakPoint fixture.
 */
const makePeak = (endX: number): PeakPoint => ({
	gear: 1,
	speed: 60,
	endX,
	endY: 100,
	ratio: 3.5,
	color: '#ef4444',
});

describe('isPeakVisible', () => {
	it('accepts peaks inside the plot', () => {
		expect(isPeakVisible(makeFrame(), makePeak(400))).toBe(true);
	});
	it('rejects peaks outside the plot', () => {
		expect(isPeakVisible(makeFrame(), makePeak(10))).toBe(false);
		expect(isPeakVisible(makeFrame(), makePeak(900))).toBe(false);
	});
});

describe('describeShiftDelta', () => {
	it('compares landing rpm and shift speed of one pair', () => {
		const d = describeShiftDelta([3.58, 2.05], 0, 7000, 4.1, 1.935, [3.58, 2.0], 4.1, 1.935, 7000);
		expect(d).not.toBeNull();
		expect(d?.fromIndex).toBe(0);
		expect(d?.dShiftSpeed).toBeCloseTo(0, 6);
		expect(d?.dLandingRpm).not.toBe(0);
	});
	it('returns null on invalid pairs', () => {
		expect(describeShiftDelta([3.58], 0, 7000, 4.1, 1.935, [3.3, 2.0], 4.1, 1.935, 7000)).toBeNull();
		expect(describeShiftDelta([3.58, 2.05], 0, 0, 4.1, 1.935, [3.3, 2.0], 4.1, 1.935, 7000)).toBeNull();
	});
	it('covers every shared pair and skips nothing valid', () => {
		const all = describeAllShiftDeltas([3.58, 2.05, 1.38], 7000, 4.1, 1.935, [3.3, 2.0, 1.35], 4.1, 1.935, 7000);
		expect(all).toHaveLength(2);
		expect(all[0].fromIndex).toBe(0);
		expect(all[1].fromIndex).toBe(1);
		expect(describeAllShiftDeltas([], 7000, 4.1, 1.935, [3.3], 4.1, 1.935, 7000)).toEqual([]);
	});
});
