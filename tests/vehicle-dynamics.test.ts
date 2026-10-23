/**
 * @file vehicle-dynamics.test.ts
 * @brief Fuel cut, transfer feedback, mapped efficiency and active differential regression.
 */
import { describe, expect, it } from 'vitest';
import { drivetrainEfficiencyAt, EFFICIENCY_MAP } from '../src/core/math/drivetrain-map';
import { axleCapacityN, centerCapacityN } from '../src/core/math/active-differential';
import { transferredDriveForce, wheelForceAt } from '../src/core/math/drive-force';
import { maxDriveForceAtSpeed, wheelLoads } from '../src/core/math/dynamics-math';
import { gearShiftTimeS, limiterMultiplier } from '../src/core/math/powertrain-control';
import { simulateAcceleration } from '../src/core/math/accel-math';
import { dynamicsInput } from './dynamics-fixtures';

describe('load-dependent efficiency', () => {
	it('matches every normalized node and interpolates between nodes', () => {
		for (let i = 0; i < 5; i += 1) for (let j = 0; j < 5; j += 1) {
			expect(drivetrainEfficiencyAt(0.85, i * 1750, 7000, j * 75, 300)).toBeCloseTo(0.85 * EFFICIENCY_MAP[i][j], 10);
		}
		const mid = drivetrainEfficiencyAt(0.85, 2625, 7000, 112.5, 300);
		expect(mid).toBeCloseTo(0.85 * (0.93 + 0.98 + 0.92 + 0.97) / 4, 10);
	});
	it('penalizes light load and high speed without creating power', () => {
		expect(drivetrainEfficiencyAt(0.85, 7000, 7000, 50, 300)).toBeLessThan(drivetrainEfficiencyAt(0.85, 3500, 7000, 300, 300));
		expect(drivetrainEfficiencyAt(0.85, 7000, 7000, 50, 300, 'AWD')).toBeLessThan(drivetrainEfficiencyAt(0.85, 7000, 7000, 50, 300, 'FWD'));
		expect(drivetrainEfficiencyAt(NaN, 1000, 7000, 100, 300)).toBe(0);
		const input = dynamicsInput();
		expect(wheelForceAt(6500, 3, 4, 0.3, input.curve!, 0.85, input.runningGear, true))
			.toBeLessThan(wheelForceAt(6500, 3, 4, 0.3, input.curve!, 0.85));
	});
});

describe('instantaneous transfer', () => {
	it('conserves vertical weight after an inner wheel lifts', () => {
		const loads = wheelLoads({ ...dynamicsInput().runningGear!, lateralG: 2 }, 1400, 8);
		expect(loads.fl + loads.fr + loads.rl + loads.rr).toBeCloseTo(1400 * 9.81, 8);
		expect(loads.fl).toBe(0);
	});
	it('raises RWD launch capacity and reduces FWD capacity', () => {
		const input = dynamicsInput();
		for (const layout of ['FWD', 'RWD'] as const) {
			const rg = { ...input.runningGear!, drivetrainLayout: layout };
			const staticGrip = maxDriveForceAtSpeed(rg, input.massKg, 0, 20000, 0).limitN;
			const actual = transferredDriveForce(rg, input.massKg, input.massKg, 0, 20000, 0);
			expect(layout === 'FWD' ? actual < staticGrip : actual > staticGrip).toBe(true);
			const grip = maxDriveForceAtSpeed(rg, input.massKg, 0, actual, actual / input.massKg).limitN;
			expect(actual).toBeCloseTo(grip, 1);
		}
	});
	it('never bypasses zero longitudinal grip', () => {
		const input = dynamicsInput();
		const result = simulateAcceleration({ ...input, runningGear: { ...input.runningGear!, lateralG: 2 } });
		expect(result.time0To100S).toBeNull();
		expect(result.distanceM).toBe(0);
	});
	it('applies the delay of the departing gear and recomputes landing RPM', () => {
		const fast = simulateAcceleration(dynamicsInput({ shiftTimesS: [0, 0, 0, 0, 0] }));
		const slow = simulateAcceleration(dynamicsInput({ shiftTimesS: [0.6, 0.6, 0.6, 0.6, 0.6] }));
		expect(slow.time0To100S!).toBeGreaterThan(fast.time0To100S!);
	});
});

describe('powertrain control', () => {
	it('latches bounce fuel cut until the reset threshold', () => {
		const state = { cut: false };
		expect(limiterMultiplier(state, 7000, 7000, 'bounce')).toBe(0);
		expect(limiterMultiplier(state, 6900, 7000, 'bounce')).toBe(0);
		expect(limiterMultiplier(state, 6850, 7000, 'bounce')).toBe(1);
		expect(limiterMultiplier(state, 6999, 7000, 'hard')).toBe(1);
		expect(limiterMultiplier(state, 7000, 7000, 'hard')).toBe(0);
	});
	it('prioritizes per-gear timing, then global timing, then gearbox defaults', () => {
		expect(gearShiftTimeS(0, [0.1], 0.5, 'synchro')).toBe(0.1);
		expect(gearShiftTimeS(1, [0.1], 0.5, 'dog')).toBe(0.5);
		expect(gearShiftTimeS(1, [], undefined, 'dog')).toBe(0.08);
		expect(gearShiftTimeS(1, [], undefined, 'synchro')).toBe(0.3);
	});
});

describe('active and mechanical differentials', () => {
	it('uses axle preload before clutch slip without exceeding the outer tire', () => {
		const rg = dynamicsInput().runningGear!;
		expect(axleCapacityN({ ...rg, differentialBias: 0, differentialPreloadNm: 60 }, 0, 1000, 0, 0.3)).toBe(200);
		expect(axleCapacityN({ ...rg, differentialPreloadNm: 500 }, 100, 200, 0, 0.3)).toBe(300);
		expect(axleCapacityN({ ...rg, differentialType: 'open', differentialPreloadNm: 500 }, 100, 200, 0)).toBe(200);
	});
	it('never lets Torsen or vectoring invent wheel grip', () => {
		const rg = dynamicsInput().runningGear!;
		expect(axleCapacityN({ ...rg, differentialType: 'torsen' }, 500, 600, 0)).toBe(1100);
		expect(axleCapacityN({ ...rg, differentialType: 'open', torqueVectoring: 1 }, 100, 600, 0)).toBe(700);
	});
	it('adapts AWD split to grip and releases the center on handbrake turn-in', () => {
		const rg = { ...dynamicsInput().runningGear!, drivetrainLayout: 'AWD' as const, awdFrontShare: 0.5 };
		expect(centerCapacityN(rg, 2000, 6000).limitN).toBe(4000);
		const active = centerCapacityN({ ...rg, centerDiffLock: 1 }, 2000, 6000);
		expect(active).toEqual({ limitN: 8000, frontShare: 0.25 });
		expect(centerCapacityN({ ...rg, handbrakeApplied: true, handbrakeDisengage: true }, 2000, 6000).limitN).toBe(0);
		expect(centerCapacityN({ ...rg, handbrakeApplied: true, handbrakeDisengage: false }, 2000, 6000).limitN).toBe(4000);
	});
});
