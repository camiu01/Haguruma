/**
 * @file unit-utils.test.ts
 * @brief Unit tests for speed/power unit helpers and RPM scaling.
 */
import { describe, expect, it } from 'vitest';
import {
	formatPower,
	formatPowerInput,
	fromDisplayPower,
	getMaxRpm,
	getPowerUnitLabel,
	getSpeedStep,
	getUnitLabel,
	parsePowerUnit,
	toDisplayPower,
} from '../src/core/units/unit-utils';

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

describe('power unit helpers', () => {
	it('labels kW and cv', () => {
		expect(getPowerUnitLabel('kw')).toBe('kW');
		expect(getPowerUnitLabel('cv')).toBe('cv');
	});
	it('parses only known power units', () => {
		expect(parsePowerUnit('kw')).toBe('kw');
		expect(parsePowerUnit('cv')).toBe('cv');
		expect(parsePowerUnit('hp')).toBeNull();
		expect(parsePowerUnit(null)).toBeNull();
	});
	it('round-trips display conversion', () => {
		expect(fromDisplayPower(toDisplayPower(110, 'cv'), 'cv')).toBeCloseTo(110, 6);
		expect(toDisplayPower(110, 'kw')).toBe(110);
	});
	it('formats power strings with the active unit', () => {
		expect(formatPower(110, 'kw')).toBe('110.0 kW');
		expect(formatPower(110, 'cv')).toBe('149.6 cv');
	});
	it('formats bare input numbers', () => {
		expect(formatPowerInput(110, 'kw')).toBe('110.0');
		expect(formatPowerInput(110, 'cv')).toBe('149.6');
	});
	it('converts cv entries back to kW', () => {
		expect(fromDisplayPower(149.6, 'cv')).toBeCloseTo(110, 1);
	});
});
