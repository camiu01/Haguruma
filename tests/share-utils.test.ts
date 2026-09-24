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
	it('roundtrips rotating mass and shift time', () => {
		const hash = encodeState({ ...defaultState, rotatingMassKg: 120, shiftTimeS: 0.15 });
		const patch = decodeState(`#${hash}`);
		expect(patch.rotatingMassKg).toBe(120);
		expect(patch.shiftTimeS).toBeCloseTo(0.15, 5);
	});
	it('decodes old hashes without simulation keys', () => {
		const patch = decodeState('#fd=4.1&rl=7200');
		expect(patch.rotatingMassKg).toBeUndefined();
		expect(patch.shiftTimeS).toBeUndefined();
	});
	it('rejects out-of-range simulation keys', () => {
		const patch = decodeState('#rot=9999&sft=50');
		expect(patch.rotatingMassKg).toBeUndefined();
		expect(patch.shiftTimeS).toBeUndefined();
	});
	it('roundtrips advanced differential lock keys', () => {
		const hash = encodeState({
			...defaultState,
			runningGear: {
				...defaultRunningGear,
				differentialType: 'clutch_lsd',
				differentialModelId: 'lsd_1_5way',
				differentialBias: 0.5,
				differentialCoastBias: 0.25,
			},
		});
		const patch = decodeState(`#${hash}`);
		expect(patch.runningGear?.differentialModelId).toBe('lsd_1_5way');
		expect(patch.runningGear?.differentialBias).toBeCloseTo(0.5, 5);
		expect(patch.runningGear?.differentialCoastBias).toBeCloseTo(0.25, 5);
	});
	it('ignores unknown differential model ids in old or foreign hashes', () => {
		const patch = decodeState('#rg_dm=not_a_model&rg_df=clutch_lsd');
		expect(patch.runningGear?.differentialModelId).not.toBe('not_a_model');
		expect(patch.runningGear?.differentialType).toBe('clutch_lsd');
	});
	it('omits running-gear block when only an unknown model id is present', () => {
		const patch = decodeState('#rg_dm=not_a_model');
		expect(patch.runningGear).toBeUndefined();
	});
	it('roundtrips downforce and dyno-curve keys', () => {
		const hash = encodeState({
			...defaultState,
			torqueCurvePoints: [
				{ rpm: 1000, torqueNm: 120 },
				{ rpm: 3000, torqueNm: 200 },
				{ rpm: 6000, torqueNm: 150 },
			],
			runningGear: { ...defaultRunningGear, liftCoefficient: 1.2, liftReferenceAreaM2: 1.6, downforceFrontShare: 0.45 },
		});
		const patch = decodeState(`#${hash}`);
		expect(patch.torqueCurvePoints).not.toBeNull();
		expect(patch.torqueCurvePoints?.map((p) => p.rpm)).toEqual([1000, 3000, 6000]);
		expect(patch.torqueCurvePoints?.[1].torqueNm).toBeCloseTo(200, 1);
		expect(patch.runningGear?.liftCoefficient).toBeCloseTo(1.2, 2);
		expect(patch.runningGear?.liftReferenceAreaM2).toBeCloseTo(1.6, 2);
		expect(patch.runningGear?.downforceFrontShare).toBeCloseTo(0.45, 2);
		expect(patch.compRunningGear?.liftCoefficient).toBeCloseTo(0.15, 2);
	});
	it('decodes old hashes without curve or downforce keys', () => {
		const patch = decodeState('#fd=4.1&rl=7200');
		expect(patch.torqueCurvePoints).toBeUndefined();
		expect(patch.runningGear).toBeUndefined();
	});
	it('rejects a curve with a single valid point', () => {
		const patch = decodeState('#curve=3000:200');
		expect(patch.torqueCurvePoints).toBeUndefined();
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
	it('applies dyno curve patches with cloned points', () => {
		const ok = applySharedState({ torqueCurvePoints: [{ rpm: 1000, torqueNm: 100 }, { rpm: 2000, torqueNm: 120 }] });
		expect(ok).toBe(true);
		expect(state.torqueCurvePoints).toHaveLength(2);
		state.torqueCurvePoints = null;
	});
	it('clears the dyno curve when the patch value is null', () => {
		state.torqueCurvePoints = [{ rpm: 1000, torqueNm: 100 }, { rpm: 2000, torqueNm: 120 }];
		applySharedState({ torqueCurvePoints: null });
		expect(state.torqueCurvePoints).toBeNull();
	});
	it('returns false for empty patch', () => {
		expect(applySharedState({})).toBe(false);
	});
});
