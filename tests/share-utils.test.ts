/**
 * @file share-utils.test.ts
 * @brief Unit tests for URL share encoding and decoding.
 */
import { describe, expect, it } from 'vitest';
import { applySharedState, decodeState, encodeState } from '../src/core/share/share-utils';
import { defaultState, state } from '../src/core/state/app-state';
import { defaultRunningGear } from '../src/core/state/app-state';

describe('encodeState/decodeState', () => {
	it('roundtrips primary and compare setups', () => {
		const hash = encodeState({ ...defaultState, primaryFd: 4.77, compFd: 4.1, compareEnabled: true });
		const patch = decodeState(`#${hash}`);
		expect(patch.primaryFd).toBe(4.77);
		expect(patch.compFd).toBe(4.1);
		expect(patch.compareEnabled).toBe(true);
	});
	it('roundtrips grade, tire factor and engine anchors', () => {
		const hash = encodeState({
			...defaultState,
			roadGradePercent: 8,
			rollingFactor: 0.97,
			peakTorqueRpm: 4500,
			peakTorqueNm: 180,
			peakPowerRpm: 6500,
		});
		const patch = decodeState(`#${hash}`);
		expect(patch.roadGradePercent).toBe(8);
		expect(patch.rollingFactor).toBeCloseTo(0.97, 5);
		expect(patch.peakTorqueRpm).toBe(4500);
		expect(patch.peakTorqueNm).toBe(180);
		expect(patch.peakPowerRpm).toBe(6500);
	});
	it('rejects invalid tire and gears', () => {
		const patch = decodeState('#tire=BAD&g=99&fd=0');
		expect(patch.primaryTire).toBeUndefined();
		expect(patch.gears).toBeUndefined();
		expect(patch.primaryFd).toBeUndefined();
	});
	it('returns empty patch for empty hash', () => {
		expect(decodeState('')).toEqual({});
		expect(decodeState('#')).toEqual({});
	});
	it('roundtrips running-gear keys', () => {
		const hash = encodeState({ ...defaultState, runningGear: { ...defaultRunningGear, frontWeightDistribution: 0.58, roadFrictionCoefficient: 1.1 } });
		const patch = decodeState(`#${hash}`);
		expect(patch.runningGear?.frontWeightDistribution).toBeCloseTo(0.58, 2);
		expect(patch.runningGear?.roadFrictionCoefficient).toBeCloseTo(1.1, 2);
		expect(patch.compRunningGear?.roadFrictionCoefficient).toBeCloseTo(1.1, 2);
	});
	it('decodes old hashes without running-gear keys', () => {
		const patch = decodeState('#tire=205%2F55R16&fd=4.1&rl=7200');
		expect(patch.primaryFd).toBe(4.1);
		expect(patch.runningGear).toBeUndefined();
		expect(patch.compRunningGear).toBeUndefined();
	});
});

describe('applySharedState', () => {
	it('applies valid patch to live store and clones arrays', () => {
		const before = [...state.gears];
		const ok = applySharedState({ primaryFd: 4.77, gears: [3.0, 2.0] });
		expect(ok).toBe(true);
		expect(state.primaryFd).toBe(4.77);
		expect(state.gears).toEqual([3.0, 2.0]);
		state.primaryFd = before.length > 0 ? defaultState.primaryFd : defaultState.primaryFd;
		state.gears = [...defaultState.gears];
	});
	it('returns false for empty patch', () => {
		expect(applySharedState({})).toBe(false);
	});
});
