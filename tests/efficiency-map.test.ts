/**
 * @file efficiency-map.test.ts
 * @brief Measured-map import, sharing and solver consistency tests.
 */
import { expect, it } from 'vitest';
import { parseEfficiencyCsv, validateEfficiencyMap } from '../src/core/math/efficiency-map';
import { mappedEfficiency } from '../src/core/math/powertrain-math';
import { encodeState, decodeState } from '../src/core/share/share-utils';
import { defaultState } from '../src/core/state/app-state';
import { BENCHMARK_INPUT } from './fixtures/accel-benchmark';
import { simulateAcceleration } from '../src/core/math/accel-math';

const map = [{ rpm: 1000, load: 1, efficiency: 0.6 }, { rpm: 7000, load: 1, efficiency: 0.6 }];
it('reads measured maps in fractional units and rejects blank or percentage values', () => {
	expect(parseEfficiencyCsv('rpm;load;efficiency\n1000;1;0,6\n7000;1;0,6')).toEqual(map);
	expect(parseEfficiencyCsv('rpm,load,efficiency\n1000,,0.6\n7000,1,0.6')).toBeNull();
	expect(parseEfficiencyCsv('rpm,load,efficiency\n1000,1,60\n7000,1,60')).toBeNull();
	expect(validateEfficiencyMap([map[0], map[0]])).toBeNull();
});
it('preserves measured operating points without inventing a factory map', () => {
	expect(mappedEfficiency(map, 1000, 1, 0.85)).toBe(0.6);
	expect(mappedEfficiency(undefined, 1000, 1, 0.85)).toBe(0.85);
});
it('roundtrips dense maps alongside the legacy compact share token', () => {
	const dense = Array.from({ length: 256 }, (_, index) => ({ rpm: 1000 + 6000 * (index % 16) / 15,
		load: Math.floor(index / 16) / 15, efficiency: 0.6 + (index % 16) / 50 }));
	const simulation = { limiterMode: 'hard' as const, shiftTimesS: [0.2], efficiencyMap: dense };
	expect(decodeState(encodeState({ ...defaultState, simulation })).simulation).toEqual(simulation);
});
it('rejects invalid and oversized maps without discarding valid limiter settings', () => {
	expect(validateEfficiencyMap(Array.from({ length: 257 }, (_, i) => ({ ...map[0], rpm: 1000 + i })))).toBeNull();
	const params = new URLSearchParams();
	params.set('sim', JSON.stringify({ limiterMode: 'bounce', shiftTimesS: [0.2], efficiencyMap: [map[0], { ...map[1], load: 2 }] }));
	expect(decodeState('#' + params.toString()).simulation).toEqual({ limiterMode: 'bounce', shiftTimesS: [0.2] });
});
it('applies a less efficient measured map to the acceleration model', () => {
	const base = simulateAcceleration(BENCHMARK_INPUT);
	const measured = simulateAcceleration({ ...BENCHMARK_INPUT, efficiencyMap: map });
	expect(measured.time0To100S).toBeGreaterThan(base.time0To100S!);
});
