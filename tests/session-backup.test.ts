/**
 * @file session-backup.test.ts
 * @brief Unit tests for session exports and backup validation.
 */
import { describe, expect, it } from 'vitest';
import { sessionsToCsv, sessionsToJson } from '../src/core/telemetry/session-store';
import {
	countValidPresets,
	parseBackup,
	parsePresetsBundle,
} from '../src/core/backup/state-backup';

const RUN = {
	id: 'run-1',
	dateISO: '2026-10-08T00:00:00.000Z',
	name: 'Evening run',
	presetName: 'Miata',
	time0To100S: 8.2,
	quarterS: 16.1,
	trapKmh: 140.5,
	note: '',
};

describe('sessionsToCsv', () => {
	it('emits the MoTeC/AiM header plus rows', () => {
		const text = sessionsToCsv([RUN]);
		const lines = text.split('\n');
		expect(lines[0]).toBe('date_iso,name,preset,time_0_100_s,quarter_s,trap_kmh,note');
		expect(lines[1]).toContain('8.20');
	});
	it('serializes an empty log as headers only', () => {
		expect(sessionsToCsv([]).split('\n')).toHaveLength(1);
		expect(JSON.parse(sessionsToJson([])).runs).toEqual([]);
	});
});

describe('parseBackup', () => {
	it('accepts a versioned envelope', () => {
		const backup = parseBackup(JSON.stringify({ schemaVersion: 1, values: { 'haguruma-lang': 'it' } }));
		expect(backup?.values['haguruma-lang']).toBe('it');
	});
	it('rejects corrupt or future envelopes', () => {
		expect(parseBackup('nope')).toBeNull();
		expect(parseBackup(JSON.stringify({ schemaVersion: 99, values: {} }))).toBeNull();
		expect(parseBackup(JSON.stringify({ schemaVersion: 1 }))).toBeNull();
	});
});

describe('parsePresetsBundle', () => {
	it('keeps valid presets and drops broken rows', () => {
		const presets = parsePresetsBundle(JSON.stringify({
			schemaVersion: 1,
			presets: {
				good: { tire: '205/55R16', fd: 4.1, redline: 7000, gears: [3.5, 2.1, 1.4] },
				bad: { tire: 'x', fd: -1 },
			},
		}));
		expect(countValidPresets(presets)).toBe(1);
		expect(presets.good.gears).toEqual([3.5, 2.1, 1.4]);
	});
	it('returns empty on corrupt text', () => {
		expect(parsePresetsBundle('nope')).toEqual({});
	});
});
