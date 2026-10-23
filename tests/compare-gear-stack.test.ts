/**
 * @file compare-gear-stack.test.ts
 * @brief Unit tests for the pure helpers of the parameterized gear stacks.
 */
import { describe, expect, it } from 'vitest';
import { compStackDrifted, stepRatio } from '../src/components/gear-list';

describe('stepRatio micro stepper', () => {
	it('applies the 0.005 increment in both directions and rounds to 3 decimals', () => {
		expect(stepRatio(2.05, 1)).toBe(2.055);
		expect(stepRatio(2.05, -1)).toBe(2.045);
		expect(stepRatio(3.58, 1)).toBe(3.585);
	});
	it('clamps into the gear-ratio palette bounds', () => {
		expect(stepRatio(0.401, -1)).toBe(0.4);
		expect(stepRatio(5.998, 1)).toBe(6.0);
		expect(stepRatio(6.0, 1)).toBe(6.0);
		expect(stepRatio(0.4, -1)).toBe(0.4);
	});
	it('applies a zero direction as a no-op', () => {
		expect(stepRatio(2.05, 0)).toBe(2.05);
	});
});

describe('compStackDrifted rebuild rule', () => {
	it('rebuilds when the displayed count differs from state', () => {
		expect(compStackDrifted([], [3.58, 2.05])).toBe(true);
		expect(compStackDrifted([3.58], [3.58, 2.05])).toBe(true);
	});
	it('rebuilds when any displayed value drifted or is unparsable', () => {
		expect(compStackDrifted([3.58, 2.06], [3.58, 2.05])).toBe(true);
		expect(compStackDrifted([3.58, null], [3.58, 2.05])).toBe(true);
	});
	it('keeps the cheap path when inputs already match state', () => {
		expect(compStackDrifted([3.58, 2.05], [3.58, 2.05])).toBe(false);
	});
});
