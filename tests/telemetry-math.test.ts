/**
 * @file telemetry-math.test.ts
 * @brief Unit tests for telemetry CSV parsing and gear recovery.
 */
import { describe, expect, it } from 'vitest';
import { estimateGearRatios, parseTelemetryCsv } from '../src/core/math/telemetry-math';

const TWO_GEARS = [
	'engine_rpm,wheel_speed_kmh',
	'3600,36', '3960,39.6', '4320,43.2', '4680,46.8', '5040,50.4', '5400,54',
	'4800,72', '5040,75.6', '5280,79.2', '5520,82.8', '5760,86.4', '6000,90',
].join('\n');

describe('parseTelemetryCsv', () => {
	it('reads a header log with rpm and speed columns', () => {
		const samples = parseTelemetryCsv(TWO_GEARS);
		expect(samples).toHaveLength(12);
		expect(samples?.[0]).toMatchObject({ rpm: 3600, speedKmh: 36 });
	});
	it('reads header-less time,rpm,speed rows', () => {
		const samples = parseTelemetryCsv('0.0,3200,41.2\n0.1,3300,42.5');
		expect(samples).toHaveLength(2);
		expect(samples?.[0]).toMatchObject({ t: 0, rpm: 3200, speedKmh: 41.2 });
	});
	it('accepts semicolons with decimal commas', () => {
		const samples = parseTelemetryCsv('engine_rpm;wheel_speed_kmh\n3200;41,2');
		expect(samples?.[0]).toMatchObject({ rpm: 3200, speedKmh: 41.2 });
	});
	it('converts mph columns to km/h', () => {
		const samples = parseTelemetryCsv('engine_rpm,speed_mph\n3200,25');
		expect(samples?.[0]?.speedKmh).toBeCloseTo(40.23, 2);
	});
	it('rejects empty or unusable logs', () => {
		expect(parseTelemetryCsv('')).toBeNull();
		expect(parseTelemetryCsv('engine_rpm,wheel_speed_kmh\nabc,def')).toBeNull();
	});
});

describe('estimateGearRatios', () => {
	it('recovers two gears from a mixed log', () => {
		const samples = parseTelemetryCsv(TWO_GEARS);
		const gears = estimateGearRatios(samples ?? [], 2);
		expect(gears).toHaveLength(2);
		expect(gears?.[0].gear).toBe(1);
		expect(gears?.[0].ratio).toBeCloseTo(12, 1);
		expect(gears?.[1].ratio).toBeCloseTo(8, 1);
		expect(gears?.[0].slipPct).toBe(0);
	});
	it('flags clutch slip as off-cluster samples', () => {
		const rows = ['engine_rpm,wheel_speed_kmh'];
		for (const rpm of [4000, 4000, 4067, 4133, 4200, 4267, 4333, 4400, 4467, 4533]) {
			rows.push(`${rpm},40`);
		}
		const gears = estimateGearRatios(parseTelemetryCsv(rows.join('\n')) ?? [], 2);
		expect(gears).toHaveLength(1);
		expect(gears?.[0].slipPct).toBeGreaterThan(0);
	});
	it('rejects tiny or invalid input', () => {
		expect(estimateGearRatios([], 2)).toBeNull();
		expect(estimateGearRatios(parseTelemetryCsv('1000,20') ?? [], 0)).toBeNull();
	});
});
