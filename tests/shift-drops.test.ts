/**
 * @file shift-drops.test.ts
 * @brief Unit tests for shift-drop visibility helpers.
 */
import { describe, expect, it } from 'vitest';
import { isPeakVisible } from '../src/services/graph/graph-shift-drops';
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
