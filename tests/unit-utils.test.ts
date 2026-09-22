/**
 * @file unit-utils.test.ts
 * @brief Unit tests for speed unit helpers and RPM scaling.
 */
import { describe, expect, it } from 'vitest';
import { getMaxRpm, getSpeedStep, getUnitLabel } from '../src/core/units/unit-utils';

describe('getSpeedStep', () => {
	it('uses 50 kmh steps', () => {
		expect(getSpeedStep('kmh')).toBe(50);
	});
	it('uses 25 mph steps', () => {
		expect(getSpeedStep('mph')).toBe(25);
	});
});

describe('getUnitLabel', () => {
	it('labels kmh correctly', () => {
		expect(getUnitLabel('kmh')).toBe('km/h');
	});
	it('labels mph correctly', () => {
		expect(getUnitLabel('mph')).toBe('mph');
	});
});

describe('getMaxRpm', () => {
	it('rounds redline up with headroom', () => {
		expect(getMaxRpm(7200)).toBe(8500);
		expect(getMaxRpm(9000)).toBe(9500);
	});
	it('handles exact thousands', () => {
		expect(getMaxRpm(8000)).toBe(8500);
	});
});
