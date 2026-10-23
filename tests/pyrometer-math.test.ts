/**
 * @file pyrometer-math.test.ts
 * @brief Unit tests for the 3-zone pyrometer camber and hot-pressure advice.
 */
import { describe, expect, it } from 'vitest';
import {
	CAMBER_TOLERANCE_C,
	MAX_PRESSURE_STEP_BAR,
	PRESSURE_STEP_BAR,
	PRESSURE_TOLERANCE_C,
	WINDOW_TOLERANCE_C,
	camberAdvice,
	centerEdgeSpread,
	innerOuterSpread,
	pressureAdvice,
	windowVerdict,
} from '../src/core/math/pyrometer-math';

describe('thresholds', () => {
	it('ships the documented defaults', () => {
		expect(CAMBER_TOLERANCE_C).toBe(8);
		expect(PRESSURE_TOLERANCE_C).toBe(6);
		expect(PRESSURE_STEP_BAR).toBe(0.05);
		expect(MAX_PRESSURE_STEP_BAR).toBe(0.3);
		expect(WINDOW_TOLERANCE_C).toBe(15);
	});
});

describe('innerOuterSpread', () => {
	it('is positive when the inner edge is hotter', () => {
		expect(innerOuterSpread(90, 78)).toBe(12);
	});

	it('is negative when the outer edge is hotter', () => {
		expect(innerOuterSpread(70, 88)).toBe(-18);
	});

	it('is zero when both edges match', () => {
		expect(innerOuterSpread(80, 80)).toBe(0);
	});
});

describe('centerEdgeSpread', () => {
	it('compares the centre against the mean of the two edges', () => {
		expect(centerEdgeSpread(88, 82, 76)).toBe(9);
	});

	it('is negative when the centre is the coolest zone', () => {
		expect(centerEdgeSpread(70, 80, 80)).toBe(-10);
	});
});

describe('camberAdvice', () => {
	it('asks for less negative camber when the inner edge is hot', () => {
		expect(camberAdvice(90, 78)).toBe('less-negative');
	});

	it('asks for less negative camber past the tolerance with a custom bound', () => {
		expect(camberAdvice(91, 82, 8)).toBe('less-negative');
	});

	it('asks for more negative camber when the outer edge is hot', () => {
		expect(camberAdvice(78, 90)).toBe('more-negative');
	});

	it('asks for more negative camber past the tolerance with a custom bound', () => {
		expect(camberAdvice(82, 91, 8)).toBe('more-negative');
	});

	it('stays balanced exactly at the tolerance', () => {
		expect(camberAdvice(90, 82)).toBe('balanced');
		expect(camberAdvice(82, 90)).toBe('balanced');
	});

	it('stays balanced just inside a wider tolerance', () => {
		expect(camberAdvice(90, 82, 12)).toBe('balanced');
	});

	it('returns less-negative for a hotter inside edge', () => {
		expect(camberAdvice(88, 76)).toBe('less-negative');
	});
});

describe('pressureAdvice', () => {
	it('stays balanced exactly at the tolerance', () => {
		expect(pressureAdvice(82, 76, 76, 2.2)).toEqual({ action: 'balanced', deltaBar: 0 });
		expect(pressureAdvice(70, 76, 76, 2.2)).toEqual({ action: 'balanced', deltaBar: 0 });
	});

	it('lowers the pressure when the centre runs hot', () => {
		expect(pressureAdvice(90, 76, 76, 2.2)).toEqual({ action: 'lower', deltaBar: 0.3 });
	});

	it('raises the pressure when the centre runs cool', () => {
		expect(pressureAdvice(62, 76, 76, 2.2)).toEqual({ action: 'raise', deltaBar: 0.3 });
	});

	it('clamps the correction at 0.30 bar', () => {
		expect(pressureAdvice(120, 76, 76, 2.2)).toEqual({ action: 'lower', deltaBar: 0.3 });
		expect(pressureAdvice(30, 76, 76, 2.2)).toEqual({ action: 'raise', deltaBar: 0.3 });
	});

	it('quantises the correction in 0.05 bar steps', () => {
		expect(pressureAdvice(82.5, 76, 76, 2.2).deltaBar).toBe(0.05);
		expect(pressureAdvice(83.4, 76, 76, 2.2).deltaBar).toBe(0.05);
		expect(pressureAdvice(84.6, 76, 76, 2.2).deltaBar).toBe(0.15);
		expect(pressureAdvice(87, 76, 76, 2.2).deltaBar).toBe(0.25);
	});

	it('always suggests at least one step once past the tolerance', () => {
		expect(pressureAdvice(82.4, 76, 76, 2.2).deltaBar).toBe(0.05);
	});

	it('never bleeds the hot pressure below the floor', () => {
		expect(pressureAdvice(90, 76, 76, 1.05)).toEqual({ action: 'lower', deltaBar: 0.05 });
		expect(pressureAdvice(90, 76, 76, 1)).toEqual({ action: 'balanced', deltaBar: 0 });
	});

	it('leaves a raise unclamped by the pressure floor', () => {
		expect(pressureAdvice(62, 76, 76, 1)).toEqual({ action: 'raise', deltaBar: 0.3 });
	});
});

describe('windowVerdict', () => {
	it('reports optimal at the default target', () => {
		expect(windowVerdict(82, 88, 76, 85)).toBe('optimal');
	});

	it('treats the lower boundary as inside the window', () => {
		expect(windowVerdict(69, 70, 71, 85)).toBe('optimal');
		expect(windowVerdict(68, 70, 71, 85)).toBe('cold');
	});

	it('treats the upper boundary as inside the window', () => {
		expect(windowVerdict(75, 100, 125, 85)).toBe('optimal');
		expect(windowVerdict(76, 100, 127, 85)).toBe('hot');
	});

	it('reports cold below the window', () => {
		expect(windowVerdict(60, 62, 64, 85)).toBe('cold');
	});

	it('reports hot above the window', () => {
		expect(windowVerdict(110, 112, 114, 85)).toBe('hot');
	});

	it('honours a custom window half width', () => {
		expect(windowVerdict(80, 80, 80, 85, 3)).toBe('cold');
		expect(windowVerdict(83, 83, 83, 85, 3)).toBe('optimal');
		expect(windowVerdict(88, 88, 88, 85, 3)).toBe('optimal');
		expect(windowVerdict(89, 89, 89, 85, 3)).toBe('hot');
	});
});
