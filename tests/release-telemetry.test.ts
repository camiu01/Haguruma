/**
 * @file release-telemetry.test.ts
 * @brief Telemetry parsing, inverse-dyno, GPX and discrete optimization checks.
 */
import { describe, expect, it } from 'vitest';
import { parseTelemetryCsv, recoverGearRatios, inverseDyno } from '../src/core/math/telemetry-math';
import { gearsetCandidates, optimizeGearset } from '../src/core/math/gear-optimizer';
import { parseGpxTrack, summarizeTrack } from '../src/core/math/gpx-track';

describe('telemetry CSV', () => {
	it('reads canonical SI channels and rejects duplicate timestamps', () => {
		expect(parseTelemetryCsv('time,engine_rpm,wheel_speed_kmh,gear\n0,2000,40,2\n0,3000,60,2\n1,3000,60,2')).toHaveLength(2);
	});
	it('reads decimal-comma semicolon logs with a vendor preamble', () => {
		const rows = parseTelemetryCsv('MoTeC export\nTime;RPM;Speed;Gear\n0,0;2000;40,5;2\n1,0;2500;50,5;2');
		expect(rows[0].speedKmh).toBe(40.5);
	});
	it('rejects unsupported speed units instead of guessing', () => {
		expect(parseTelemetryCsv('time,rpm,speed_mph\n0,2000,40')).toEqual([]);
	});
	it('recovers the known ratio from multiple locked-clutch samples', () => {
		const rows = [40, 50, 60, 70].map((speedKmh, timeS) => ({ speedKmh, timeS, rpm: speedKmh * 2 * 4 / (2 * 0.06) }));
		expect(recoverGearRatios(rows, 2, 4)[0].ratio).toBeCloseTo(2);
	});
	it('does not derive torque across a gear change', () => {
		expect(inverseDyno([{ timeS: 0, rpm: 3000, speedKmh: 40, gear: 1 },
			{ timeS: 1, rpm: 2000, speedKmh: 50, gear: 2 }, { timeS: 2, rpm: 3000, speedKmh: 60, gear: 2 }],
		{ massKg: 1400, gears: [3, 2], fd: 4, circM: 2, efficiency: 0.85, dragCd: 0.3, areaM2: 2, rollingCrr: 0.01, gradePercent: 0 })).toBeNull();
	});
});

describe('discrete gearset optimizer', () => {
	it('satisfies target speed and maximum RPM drop', () => {
		const result = optimizeGearset(gearsetCandidates(3.5, 6), [3.5, 4, 4.5], 2, 7000, 240, 0.3);
		expect(result).not.toBeNull();
		expect(result!.topKmh).toBeGreaterThanOrEqual(240);
		expect(result!.gears.slice(1).every((ratio, i) => 1 - ratio / result!.gears[i] <= 0.3)).toBe(true);
	});
	it('returns no result when constraints cannot be satisfied', () => {
		expect(optimizeGearset([[3, 1]], [4], 2, 7000, 1000, 0.1)).toBeNull();
	});
	it('rejects gearing that places the second-gear corner in a torque dead spot', () => {
		const curve = { redline: 7000, peakTorqueRpm: 4000, peakTorqueNm: 300, peakPowerRpm: 6000, peakPowerKw: 180 };
		const candidates = [[3.5, 2.3, 1.6, 1.1, 0.8]];
		expect(optimizeGearset(candidates, [4], 2, 7000, 240, 0.4)).not.toBeNull();
		expect(optimizeGearset(candidates, [4], 2, 7000, 240, 0.4, { curve, cornerSpeedsKmh: [10, 20] })).toBeNull();
		expect(optimizeGearset(candidates, [4], 2, 7000, 240, 0.4, { curve, cornerSpeedsKmh: [60, 90] })).not.toBeNull();
	});
});

describe('GPX geometry', () => {
	it('parses both attribute orders and computes a nonzero distance', () => {
		const points = parseGpxTrack('<gpx><trkpt lat="45" lon="9"/><trkpt lon="9.001" lat="45"/></gpx>');
		expect(points).toHaveLength(2);
		expect(summarizeTrack(points).lengthM).toBeGreaterThan(50);
	});
	it('rejects entity declarations and out-of-range coordinates', () => {
		expect(parseGpxTrack('<!DOCTYPE gpx><trkpt lat="45" lon="9"/>')).toEqual([]);
		expect(parseGpxTrack('<trkpt lat="100" lon="9"/>')).toEqual([]);
		expect(parseGpxTrack('<trkpt lat=" " lon="9"/>')).toEqual([]);
	});
	it('groups collinear samples into a straight rather than using GPS sample spacing', () => {
		const points = Array.from({ length: 10 }, (_, index) => ({ lat: 0, lon: index * 0.001 }));
		const track = summarizeTrack(points);
		expect(track.longestStraightM).toBeCloseTo(track.lengthM, 1);
		expect(track.longestStraightM).toBeGreaterThan(track.longestSegmentM * 8);
	});
});
