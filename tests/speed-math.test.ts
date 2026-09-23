/**
 * @file speed-math.test.ts
 * @brief Unit tests for RPM to speed conversions.
 */
import { describe, expect, it } from 'vitest';
import { calculateRpm, calculateSpeed, MPH_PER_KMH } from '../src/core/math/speed-math';
import { parseTire } from '../src/core/math/tire-math';

describe('speed-math', () => {
	it('round-trips speed and rpm', () => {
		const circM = 1.985;
		const speed = calculateSpeed(7200, 1.0, 4.1, circM, 'kmh');
		const rpm = calculateRpm(speed, 1.0, 4.1, circM, 'kmh');
		expect(rpm).toBeCloseTo(7200, 0);
	});
	it('converts kmh to mph consistently', () => {
		const circM = 1.985;
		const kmh = calculateSpeed(5000, 1.0, 4.1, circM, 'kmh');
		const mph = calculateSpeed(5000, 1.0, 4.1, circM, 'mph');
		expect(mph).toBeCloseTo(kmh * MPH_PER_KMH, 8);
	});
	it('returns zero for invalid ratio', () => {
		expect(calculateSpeed(5000, 0, 4.1, 2.0, 'kmh')).toBe(0);
	});
	it('returns zero for zero or invalid circumference instead of NaN', () => {
		expect(calculateSpeed(5000, 1.0, 4.1, 0, 'kmh')).toBe(0);
		expect(calculateRpm(100, 1.0, 4.1, 0, 'kmh')).toBe(0);
		expect(calculateRpm(100, 1.0, 4.1, Number.NaN, 'kmh')).toBe(0);
	});
	it('computes the Eclipse reverse top speed near 61 kmh', () => {
		const tire = parseTire('195/60R15');
		expect(tire).not.toBeNull();
		const speed = calculateSpeed(7000, 3.083, 4.322, tire?.circumferenceM ?? 0, 'kmh');
		expect(speed).toBeGreaterThan(55);
		expect(speed).toBeLessThan(68);
	});
});
