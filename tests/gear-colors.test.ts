/**
 * @file gear-colors.test.ts
 * @brief Unit tests for the gear color palette.
 */
import { describe, expect, it } from 'vitest';
import { GEAR_COLORS, getGearColor } from '../src/config/gear-colors';

describe('GEAR_COLORS', () => {
	it('holds 8 distinct entries', () => {
		expect(GEAR_COLORS).toHaveLength(8);
		expect(new Set(GEAR_COLORS).size).toBe(8);
	});
});

describe('getGearColor', () => {
	it('maps first gears directly', () => {
		expect(getGearColor(0)).toBe(GEAR_COLORS[0]);
		expect(getGearColor(5)).toBe(GEAR_COLORS[5]);
	});
	it('wraps around the palette', () => {
		expect(getGearColor(8)).toBe(GEAR_COLORS[0]);
		expect(getGearColor(9)).toBe(GEAR_COLORS[1]);
	});
});
