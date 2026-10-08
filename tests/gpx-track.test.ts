/**
 * @file gpx-track.test.ts
 * @brief Unit tests for GPX parsing and track summaries.
 */
import { describe, expect, it } from 'vitest';
import { parseGpx, summarizeTrack } from '../src/core/math/gpx-track';

const point = (lat: number, lon: number): string =>
	`<trkpt lat="${lat}" lon="${lon}"><ele>100</ele></trkpt>`;

const SQUARE = [
	'<?xml version="1.0"?>',
	'<gpx><trk><trkseg>',
	point(0, 0),
	point(0, 0.001),
	point(0.001, 0.001),
	point(0.001, 0),
	point(0, 0),
	'</trkseg></trk></gpx>',
].join('');

const STRAIGHT = [
	'<gpx><trk><trkseg>',
	point(0, 0),
	point(0, 0.001),
	point(0, 0.002),
	'</trkseg></trk></gpx>',
].join('');

describe('parseGpx', () => {
	it('reads trkpt triples in order', () => {
		const points = parseGpx(SQUARE);
		expect(points).toHaveLength(5);
		expect(points?.[1]).toMatchObject({ lat: 0, lon: 0.001, ele: 100 });
	});
	it('rejects empty or point-less files', () => {
		expect(parseGpx('')).toBeNull();
		expect(parseGpx('<gpx></gpx>')).toBeNull();
	});
});

describe('summarizeTrack', () => {
	it('finds corners on a square loop', () => {
		const summary = summarizeTrack(parseGpx(SQUARE) ?? []);
		expect(summary && summary.totalM > 400).toBe(true);
		expect(summary && summary.corners.length >= 1).toBe(true);
		expect(summary && summary.straights.length >= 1).toBe(true);
	});
	it('reports one straight on a straight line', () => {
		const summary = summarizeTrack(parseGpx(STRAIGHT) ?? []);
		expect(summary?.corners).toHaveLength(0);
		expect(summary?.straights).toHaveLength(1);
		expect(summary?.longestStraightM).toBeGreaterThan(200);
	});
	it('rejects tiny point lists', () => {
		expect(summarizeTrack([])).toBeNull();
	});
});
