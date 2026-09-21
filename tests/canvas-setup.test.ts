/**
 * @file canvas-setup.test.ts
 * @brief Unit tests for linear canvas coordinate mapping.
 */
import { describe, expect, it } from 'vitest';
import { toX, toY } from '../src/services/graph/canvas-setup';
import type { PlotFrame } from '../src/core/models';

/**
 * @brief Build a deterministic plot frame for mapping tests.
 * @return Fixed PlotFrame fixture.
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

describe('toX', () => {
	it('maps zero to the left padding', () => {
		expect(toX(makeFrame(), 0)).toBe(55);
	});
	it('maps max speed to the right edge', () => {
		expect(toX(makeFrame(), 300)).toBeCloseTo(770, 5);
	});
	it('is linear at half scale', () => {
		expect(toX(makeFrame(), 150)).toBeCloseTo(412.5, 5);
	});
});

describe('toY', () => {
	it('maps zero to the plot bottom', () => {
		expect(toY(makeFrame(), 0)).toBe(460);
	});
	it('maps max rpm to the plot top', () => {
		expect(toY(makeFrame(), 8000)).toBe(25);
	});
});
