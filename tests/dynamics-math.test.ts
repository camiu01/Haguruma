/**
 * @file dynamics-math.test.ts
 * @brief Unit tests for load transfer, Kamm limits, diffs and spin onset.
 */
import { describe, expect, it } from 'vitest';
import {
	GRAVITY,
	TORSEN_TBR,
	compressionMm,
	criticalWheelspinSpeed,
	diffLimit,
	downforceN,
	drivenWheelsLoad,
	kammLimit,
	lateralTransfer,
	longitudinalTransfer,
	maxDriveForceAtSpeed,
	staticAxleLoads,
	wheelLoads,
} from '../src/core/math/dynamics-math';
import { defaultRunningGear } from '../src/core/state/app-state';
import type { RunningGear } from '../src/core/models';

/**
 * @brief Build a mild FWD running-gear setup.
 * @return Test RunningGear value.
 */
const mildGear = (): RunningGear => ({
	...defaultRunningGear,
	drivetrainLayout: 'FWD',
	differentialType: 'open',
	roadFrictionCoefficient: 1.1,
	lateralG: 0,
});

describe('staticAxleLoads', () => {
	it('splits 1200kg by 0.52 front share', () => {
		const loads = staticAxleLoads(1200, 0.52);
		expect(loads.frontN).toBeCloseTo(1200 * GRAVITY * 0.52, 6);
		expect(loads.rearN).toBeCloseTo(1200 * GRAVITY * 0.48, 6);
	});
	it('returns zero on invalid mass', () => {
		expect(staticAxleLoads(0, 0.52).frontN).toBe(0);
		expect(staticAxleLoads(Number.NaN, 0.52).rearN).toBe(0);
	});
});

describe('transfers', () => {
	it('moves load rearward on accel and forward on braking', () => {
		expect(longitudinalTransfer(1200, 5, 450, 2570)).toBeGreaterThan(0);
		expect(longitudinalTransfer(1200, -5, 450, 2570)).toBeLessThan(0);
		expect(longitudinalTransfer(1200, 5, 450, 0)).toBe(0);
	});
	it('returns zero lateral transfer when latG is zero', () => {
		expect(lateralTransfer(1200, 0, 450, 1480)).toBe(0);
		expect(lateralTransfer(1200, 1, 450, 1480)).toBeGreaterThan(0);
	});
	it('never throws on NaN or zero geometry', () => {
		expect(() => longitudinalTransfer(Number.NaN, 5, 450, 2570)).not.toThrow();
		expect(() => lateralTransfer(1200, 1, 450, 0)).not.toThrow();
		expect(() => wheelLoads(mildGear(), Number.NaN, Number.NaN)).not.toThrow();
		expect(() => downforceN(1, 2, Number.NaN)).not.toThrow();
		expect(() => compressionMm(1000, 0)).not.toThrow();
	});
});

describe('wheelLoads', () => {
	it('conserves total weight and clamps negatives', () => {
		const loads = wheelLoads(mildGear(), 1200, 3);
		const total = loads.fl + loads.fr + loads.rl + loads.rr;
		expect(total).toBeCloseTo(1200 * GRAVITY, 3);
		const hard = wheelLoads(mildGear(), 1200, 50);
		expect(hard.fl).toBeGreaterThanOrEqual(0);
		expect(hard.fr).toBeGreaterThanOrEqual(0);
	});
	it('moves the full per-axle share from inner to outer wheel', () => {
		const rg = { ...mildGear(), lateralG: 1 };
		const loads = wheelLoads(rg, 1200, 0);
		const dLat = 1200 * GRAVITY * 1 * (450 / 1480);
		const fLat = dLat * 0.52;
		const stat = 1200 * GRAVITY * 0.52;
		expect(loads.fl).toBeCloseTo(stat / 2 - fLat, 3);
		expect(loads.fr).toBeCloseTo(stat / 2 + fLat, 3);
		expect(loads.fr - loads.fl).toBeCloseTo(2 * fLat, 3);
	});
	it('picks inner as left when latG is positive', () => {
		const rg = { ...mildGear(), drivetrainLayout: 'RWD' as const, lateralG: 1 };
		const picked = drivenWheelsLoad(rg, { fl: 1000, fr: 2000, rl: 1500, rr: 2500 });
		expect(picked.innerN).toBe(1500);
		expect(picked.outerN).toBe(2500);
	});
});

describe('kammLimit', () => {
	it('returns full mu*Fz without lateral load', () => {
		expect(kammLimit(1.1, 3000, 0)).toBeCloseTo(3300, 6);
	});
	it('returns zero when lateral demand exceeds grip', () => {
		expect(kammLimit(1.1, 3000, 3300)).toBe(0);
		expect(kammLimit(1.1, 3000, 9999)).toBe(0);
	});
});

describe('diffLimit', () => {
	it('models open as twice the inner wheel', () => {
		expect(diffLimit('open', 0.25, 1000, 3000)).toBe(2000);
	});
	it('models spool as the sum of both wheels', () => {
		expect(diffLimit('spool', 0.25, 1000, 3000)).toBe(4000);
	});
	it('models torsen with the bias ratio', () => {
		expect(diffLimit('torsen', 0.25, 1000, 3000)).toBeCloseTo(1000 * (1 + TORSEN_TBR), 6);
	});
	it('interpolates clutch bias between open-like and spool-like', () => {
		const lo = diffLimit('clutch_lsd', 0, 1000, 3000);
		const hi = diffLimit('clutch_lsd', 1, 1000, 3000);
		expect(lo).toBe(2000);
		expect(hi).toBe(4000);
	});
});

describe('maxDriveForceAtSpeed', () => {
	it('flags spin when engine force exceeds the limit', () => {
		const rg = mildGear();
		const calm = maxDriveForceAtSpeed(rg, 1200, 20, 0, 0);
		expect(calm.limitN).toBeGreaterThan(0);
		expect(calm.isSpin).toBe(false);
		const spin = maxDriveForceAtSpeed(rg, 1200, 20, calm.limitN + 1, 0);
		expect(spin.isSpin).toBe(true);
		expect(spin.perWheelN).toBeCloseTo(spin.limitN / 2, 6);
	});
});

describe('criticalWheelspinSpeed', () => {
	it('spins in first gear but not in a tall top gear', () => {
		const curve = { redline: 7200, peakTorqueRpm: 4500, peakTorqueNm: 180, peakPowerRpm: 6500, peakPowerKw: 110 };
		const out = criticalWheelspinSpeed([3.58, 0.68], 4.1, 1.93, curve, 0.85, mildGear(), 1200, 'kmh');
		expect(out).toHaveLength(2);
		expect(out[0]).not.toBeNull();
		expect(out[1]).toBeNull();
	});
});
