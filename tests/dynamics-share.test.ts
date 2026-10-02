/**
 * @file dynamics-share.test.ts
 * @brief Extended v0.7 sharing while preserving compact-token and legacy chassis values.
 */
import { describe, expect, it } from 'vitest';
import { defaultState } from '../src/core/state/app-state';
import { decodeState, encodeState } from '../src/core/share/share-utils';

describe('v0.7 sidecar protocol', () => {
	it('keeps the default setup as a single existing compact token', () => {
		const hash = encodeState(defaultState);
		expect([...new URLSearchParams(hash).keys()]).toEqual(['c']);
	});
	it('round-trips settings, arrays and both running-gear extensions', () => {
		const setup = {
			...defaultState,
			dynamics: { ...defaultState.dynamics, limiter: 'bounce' as const, graphView: 'force' as const,
				abs: false, shiftTimesS: [0.1, 0.2, 0.3], cornerRadiusM: 120, useGearboxDefaults: false },
			runningGear: { ...defaultState.runningGear, frontWeightDistribution: 0.65, differentialPreloadNm: 80,
				awdFrontShare: 0.3, centerDiffLock: 0.9, torqueVectoring: 0.8, handbrakeApplied: true },
			compRunningGear: { ...defaultState.compRunningGear, differentialPreloadNm: 120, handbrakeDisengage: false },
		};
		const patch = decodeState(encodeState(setup));
		expect(patch.dynamics).toEqual(setup.dynamics);
		expect(patch.runningGear?.frontWeightDistribution).toBeCloseTo(0.65, 2);
		expect(patch.runningGear?.differentialPreloadNm).toBe(80);
		expect(patch.runningGear?.centerDiffLock).toBe(0.9);
		expect(patch.runningGear?.handbrakeApplied).toBe(true);
		expect(patch.compRunningGear?.differentialPreloadNm).toBe(120);
		expect(patch.compRunningGear?.handbrakeDisengage).toBe(false);
	});
	it('merges verbose dyno state without replacing the decoded chassis', () => {
		const setup = { ...defaultState, torqueCurvePoints: [{ rpm: 1000, torqueNm: 100 }, { rpm: 6000, torqueNm: 180 }],
			runningGear: { ...defaultState.runningGear, wheelbaseMm: 3000, differentialPreloadNm: 50 } };
		const patch = decodeState(encodeState(setup));
		expect(patch.runningGear?.wheelbaseMm).toBe(3000);
		expect(patch.runningGear?.differentialPreloadNm).toBe(50);
		expect(patch.torqueCurvePoints).toHaveLength(2);
	});
	it('ignores malformed enums, out-of-range values, empty array cells and injected keys', () => {
		expect(decodeState('d_abs=yes&d_graphView=oops&d_shiftTimesS=0.1,,0.2&rg_dp=999&d_cornerRadiusM=NaN')).toEqual({});
		const patch = decodeState('d_abs=false&d_cornerRadiusM=-1&rg_af=2&d___proto__=polluted');
		expect(patch.dynamics?.abs).toBe(false);
		expect(patch.dynamics?.cornerRadiusM).toBe(defaultState.dynamics.cornerRadiusM);
		expect(patch.runningGear).toBeUndefined();
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});
});
