/**
 * @file dyno-csv.test.ts
 * @brief Unit tests for dyno CSV parsing, resampling and derived anchors.
 */
import { describe, expect, it } from 'vitest';
import { MAX_CURVE_POINTS, parseDynoCsv } from '../src/core/math/dyno-csv';
import { KW_TO_NM, powerFromTorque, sanitizeTorquePoints, torqueAtRpm, validateCurve } from '../src/core/math/traction-math';
import type { TorqueCurvePoint } from '../src/core/models';

describe('parseDynoCsv', () => {
	it('parses a header-less rpm,torque list', () => {
		const dyno = parseDynoCsv('1000,120\n2000,160\n3000,180\n4000,175\n5000,160');
		expect(dyno).not.toBeNull();
		expect(dyno!.points).toHaveLength(5);
		expect(dyno!.peakTorqueNm).toBe(180);
		expect(dyno!.peakTorqueRpm).toBe(3000);
	});
	it('parses an English header with named columns', () => {
		const dyno = parseDynoCsv('rpm,Nm\n1000,120\n2000,160\n3000,180');
		expect(dyno).not.toBeNull();
		expect(dyno!.points[0].rpm).toBe(1000);
		expect(dyno!.points[2].torqueNm).toBe(180);
	});
	it('parses Italian headers with semicolons and decimal commas', () => {
		const dyno = parseDynoCsv('giri;coppia\n1000;120,5\n2000;160,0\n3000;180,25');
		expect(dyno).not.toBeNull();
		expect(dyno!.points[1].torqueNm).toBeCloseTo(160, 6);
		expect(dyno!.points[2].torqueNm).toBeCloseTo(180.25, 6);
	});
	it('converts power-only files to torque via T = P x 9549.3 / n', () => {
		const dyno = parseDynoCsv('rpm,kW\n3000,60\n6000,120');
		expect(dyno).not.toBeNull();
		expect(dyno!.points[0].torqueNm).toBeCloseTo((60 * KW_TO_NM) / 3000, 3);
		expect(dyno!.points[1].torqueNm).toBeCloseTo((120 * KW_TO_NM) / 6000, 3);
	});
	it('treats cv columns as metric horsepower', () => {
		const kw = parseDynoCsv('rpm,kW\n3000,50\n6000,100');
		const cv = parseDynoCsv('rpm,cv\n3000,67.981\n6000,135.962');
		expect(kw).not.toBeNull();
		expect(cv).not.toBeNull();
		expect(kw!.points[1].torqueNm).toBeCloseTo(cv!.points[1].torqueNm, 1);
	});
	it('converts kgm torque columns to Nm', () => {
		const dyno = parseDynoCsv('rpm,kgm\n2000,20\n4000,22');
		expect(dyno).not.toBeNull();
		expect(dyno!.points[0].torqueNm).toBeCloseTo(20 * 9.80665, 3);
	});
	it('rejects unusable input', () => {
		expect(parseDynoCsv('')).toBeNull();
		expect(parseDynoCsv('rpm\n1000')).toBeNull();
		expect(parseDynoCsv('foo,bar\n1,2')).toBeNull();
		expect(parseDynoCsv('1000,120')).toBeNull();
	});
	it('resamples long pulls to the point cap', () => {
		const rows: string[] = ['rpm,Nm'];
		for (let rpm = 1000; rpm <= 7000; rpm += 10) {
			rows.push(`${rpm},150`);
		}
		const dyno = parseDynoCsv(rows.join('\n'));
		expect(dyno).not.toBeNull();
		expect(dyno!.points.length).toBeLessThanOrEqual(MAX_CURVE_POINTS);
		expect(dyno!.points.length).toBeGreaterThanOrEqual(2);
	});
	it('derives a consistent peak-power anchor', () => {
		const dyno = parseDynoCsv('1000,100\n3000,200\n6000,150');
		expect(dyno!.peakPowerRpm).toBe(6000);
		expect(dyno!.peakPowerKw).toBeCloseTo(powerFromTorque(150, 6000), 0);
	});
});

describe('torqueAtRpm', () => {
	const points: TorqueCurvePoint[] = [
		{ rpm: 1000, torqueNm: 100 },
		{ rpm: 3000, torqueNm: 200 },
	];
	it('interpolates linearly between points', () => {
		expect(torqueAtRpm(points, 2000)).toBeCloseTo(150, 6);
	});
	it('holds the end values outside the range', () => {
		expect(torqueAtRpm(points, 500)).toBe(100);
		expect(torqueAtRpm(points, 8000)).toBe(200);
	});
	it('returns zero on invalid input', () => {
		expect(torqueAtRpm([], 2000)).toBe(0);
		expect(torqueAtRpm(points, Number.NaN)).toBe(0);
	});
});

describe('validateCurve with dyno points', () => {
	const points: TorqueCurvePoint[] = [
		{ rpm: 1000, torqueNm: 100 },
		{ rpm: 3000, torqueNm: 200 },
		{ rpm: 6000, torqueNm: 150 },
	];
	it('overrides broken anchors with derived ones', () => {
		const curve = validateCurve({
			redline: 7200,
			peakTorqueRpm: 100,
			peakTorqueNm: 0,
			peakPowerRpm: 100,
			peakPowerKw: 0,
			points,
		});
		expect(curve).not.toBeNull();
		expect(curve!.peakTorqueNm).toBe(200);
		expect(curve!.peakTorqueRpm).toBe(3000);
		expect(curve!.peakPowerRpm).toBe(6000);
		expect(curve!.points).toHaveLength(3);
	});
	it('falls back to anchors when a single point survives', () => {
		const curve = validateCurve({
			redline: 7200,
			peakTorqueRpm: 4500,
			peakTorqueNm: 180,
			peakPowerRpm: 6500,
			peakPowerKw: 110,
			points: [{ rpm: 3000, torqueNm: 200 }],
		});
		expect(curve).not.toBeNull();
		expect(curve!.points ?? null).toBeNull();
		expect(curve!.peakTorqueNm).toBe(180);
	});
	it('drops invalid rows and needs two survivors', () => {
		expect(sanitizeTorquePoints([{ rpm: 100, torqueNm: 100 }, { rpm: 1000, torqueNm: 100 }])).toBeNull();
		expect(sanitizeTorquePoints([{ rpm: 1000, torqueNm: 100 }, { rpm: 1000, torqueNm: 140 }, { rpm: 2000, torqueNm: 120 }])).toHaveLength(2);
	});
});
