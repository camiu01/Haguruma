/**
 * @file release-storage.test.ts
 * @brief Backup safety, advanced share extensions and GPS session regression checks.
 */
import { describe, expect, it } from 'vitest';
import { parseStateBackup, exportStateBackup, restoreStateBackup, parseGarageImport } from '../src/core/presets/backup-store';
import { parsePerformanceSession } from '../src/core/presets/performance-store';
import { measurePerformanceSession } from '../src/core/math/performance-session';
import { defaultState } from '../src/core/state/app-state';
import { encodeState, decodeState } from '../src/core/share/share-utils';
import { parseSimulationSettings } from '../src/core/presets/simulation-settings';

describe('backup storage', () => {
	const car = { tire: '205/55R16', fd: 4.1, redline: 7000, gears: [3.3, 1.9] };
	it('accepts single-car, legacy and versioned garage files', () => {
		expect(parseGarageImport(JSON.stringify(car), 'Road car.json')?.['Road car'].fd).toBe(4.1);
		expect(parseGarageImport(JSON.stringify({ mine: car }), 'garage.json')?.mine.fd).toBe(4.1);
		expect(parseGarageImport(JSON.stringify({ schemaVersion: 1, presets: { mine: car } }), 'garage.json')?.mine.fd).toBe(4.1);
	});
	it('rejects a whole garage with any bad entry instead of importing a subset', () => {
		expect(parseGarageImport(JSON.stringify({ good: car, bad: { tire: 'invalid' } }), 'garage.json')).toBeNull();
		expect(parseGarageImport('{"__proto__":{"tire":"205/55R16","fd":4,"redline":7000,"gears":[3,2]}}', 'garage.json')).toBeNull();
	});
	it('preserves and independently clones advanced settings through garage JSON', () => {
		const simulation = { limiterMode: 'bounce' as const, shiftTimesS: [0.2],
			efficiencyMap: [{ rpm: 1000, load: 1, efficiency: 0.7 }, { rpm: 7000, load: 1, efficiency: 0.8 }] };
		const garage = parseGarageImport(JSON.stringify({ mine: { ...car, simulation } }), 'garage.json');
		expect(garage?.mine.simulation).toEqual(simulation);
		const copy = parseSimulationSettings(simulation)!;
		copy.shiftTimesS[0] = 1;
		copy.efficiencyMap![0].efficiency = 0.5;
		expect(simulation.shiftTimesS[0]).toBe(0.2);
		expect(simulation.efficiencyMap[0].efficiency).toBe(0.7);
		expect(parseGarageImport(JSON.stringify({ mine: { ...car, simulation: { ...simulation, shiftTimesS: [99] } } }), 'garage.json')).toBeNull();
	});
	it('exports only known application values', () => {
		const values = new Map([['secret', 'not-app-data'], ['haguruma-theme', 'oled']]);
		const text = exportStateBackup({ getItem: (key) => values.get(key) ?? null });
		expect(text).not.toContain('not-app-data');
		expect(parseStateBackup(text)).toEqual({ 'haguruma-theme': 'oled' });
	});
	it('rejects unknown keys and future schema versions', () => {
		expect(parseStateBackup('{"schemaVersion":1,"values":{"secret":"value"}}')).toBeNull();
		expect(parseStateBackup('{"schemaVersion":99,"values":{}}')).toBeNull();
	});
	it('sanitizes sessions inside the full backup before restoring them', () => {
		const session = JSON.stringify({ schemaVersion: 1, samples: [{ timeS: 0, speedKmh: 0, accuracyM: 3, latitude: 45 }] });
		const parsed = parseStateBackup(JSON.stringify({ schemaVersion: 1, values: { 'haguruma-performance-session': session } }));
		expect(parsed?.['haguruma-performance-session']).not.toContain('latitude');
	});
	it('rejects invalid known values at the write boundary', () => {
		const storage = { getItem: (): null => null, setItem: (): never => { throw new Error('must not write'); }, removeItem: (): void => {} };
		expect(restoreStateBackup(storage, { 'haguruma-theme': 'invalid' })).toBe(false);
	});
	it('rolls back earlier writes after a storage failure', () => {
		const values = new Map([['haguruma-theme', 'dark'], ['haguruma-unit', 'kmh']]);
		const storage = {
			getItem: (key: string): string | null => values.get(key) ?? null,
			setItem: (key: string, value: string): void => {
				if (key === 'haguruma-unit' && value === 'mph') throw new Error('quota');
				values.set(key, value);
			},
			removeItem: (key: string): void => { values.delete(key); },
		};
		expect(restoreStateBackup(storage, { 'haguruma-theme': 'light', 'haguruma-unit': 'mph' })).toBe(false);
		expect(values.get('haguruma-theme')).toBe('dark');
		expect(values.get('haguruma-unit')).toBe('kmh');
	});
});

describe('advanced shares', () => {
	it('roundtrips differential settings, limiter and shift times without changing the compact token', () => {
		const s = { ...defaultState, graphMode: 'force' as const, simulation: { limiterMode: 'bounce' as const, shiftTimesS: [0.1, 0.2] },
			runningGear: { ...defaultState.runningGear, awdFrontShare: 0.35, differentialPreloadNm: 100, centerDisengaged: false,
				activeCenter: true, handbrakeFraction: 0.7 } };
		const text = encodeState(s);
		expect(text).toContain('c=');
		const decoded = decodeState(text);
		expect(decoded.simulation).toEqual(s.simulation);
		expect(decoded.runningGear?.awdFrontShare).toBe(0.35);
		expect(decoded.runningGear?.differentialPreloadNm).toBe(100);
		expect(decoded.runningGear?.activeCenter).toBe(true);
		expect(decoded.runningGear?.handbrakeFraction).toBe(0.7);
		expect(decoded.graphMode).toBe('force');
	});
	it('rejects invalid active-center and handbrake share fields independently', () => {
		const params = new URLSearchParams(encodeState(defaultState));
		params.set('rgx', JSON.stringify({ activeCenter: 'yes', handbrakeFraction: 2, awdFrontShare: 0.3 }));
		const decoded = decodeState(params.toString());
		expect(decoded.runningGear?.activeCenter).toBeUndefined();
		expect(decoded.runningGear?.handbrakeFraction).toBeUndefined();
		expect(decoded.runningGear?.awdFrontShare).toBe(0.3);
	});
	it('ignores malformed extensions without losing the base setup', () => {
		const base = encodeState(defaultState);
		expect(decodeState(`${base}&sim=broken`).primaryTire).toBe(defaultState.primaryTire);
	});
});

describe('speed-only GPS sessions', () => {
	const samples = Array.from({ length: 31 }, (_, timeS) => ({ timeS, speedKmh: timeS * 5, accuracyM: 5 }));
	it('estimates a 0–100 split from an accurate standstill trace', () => {
		expect(measurePerformanceSession(samples).time0To100S).toBeCloseTo(20);
		expect(measurePerformanceSession(samples).quarterMileS).not.toBeNull();
	});
	it('rejects stale samples, rolling starts and weak accuracy', () => {
		expect(measurePerformanceSession([samples[0], samples[5]]).time0To100S).toBeNull();
		expect(measurePerformanceSession(samples.slice(2)).time0To100S).toBeNull();
		expect(measurePerformanceSession(samples.map((row) => ({ ...row, accuracyM: 30 }))).time0To100S).toBeNull();
	});
	it('strips location and unrecognized fields from stored sessions', () => {
		const stored = parsePerformanceSession(JSON.stringify({ schemaVersion: 1, samples: [{ ...samples[0], latitude: 45, longitude: 9 }] }));
		expect(stored).toEqual([samples[0]]);
	});
	it('interpolates quarter-mile distance using constant acceleration between samples', () => {
		const trace = Array.from({ length: 22 }, (_, timeS) => ({ timeS, speedKmh: timeS * 7.2, accuracyM: 2 }));
		expect(measurePerformanceSession(trace).quarterMileS).toBeCloseTo(Math.sqrt(402.336), 8);
	});
	it('rejects invalid stored traces and unsupported schema versions', () => {
		expect(parsePerformanceSession('{"schemaVersion":2,"samples":[]}')).toBeNull();
		expect(parsePerformanceSession(JSON.stringify({ schemaVersion: 1, samples: [samples[1], samples[0]] }))).toBeNull();
		expect(parsePerformanceSession(JSON.stringify({ schemaVersion: 1, samples: [{ ...samples[0], speedKmh: -1 }] }))).toBeNull();
	});
});
