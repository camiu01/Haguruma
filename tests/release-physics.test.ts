/**
 * @file release-physics.test.ts
 * @brief Advanced braking, powertrain and diagnostic regression checks.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { defaultRunningGear } from '../src/core/state/app-state';
import { simulateBraking, brakingTireForce } from '../src/core/math/braking-simulation';
import { limiterTorqueFactor, mappedEfficiency } from '../src/core/math/powertrain-math';
import { diagnoseTire, conflictingAdjustments } from '../src/core/setup/setup-diagnostics';
import { speedKmh, rpmFromKmh } from '../src/core/math/speed-math';
import { tractiveForceAt } from '../src/core/math/traction-math';
import { apexGearAdvice, downshiftAdvice } from '../src/core/math/corner-advisor';
import { handbrakeForceAtSpeed, combinedAxleBraking } from '../src/core/math/handbrake-math';
import { maxDriveForceAtSpeed } from '../src/core/math/dynamics-math';

const curve = { redline: 7000, peakTorqueRpm: 4000, peakTorqueNm: 300, peakPowerRpm: 6000, peakPowerKw: 220 };

describe('advanced powertrain', () => {
	it('cannot borrow unused front grip to over-brake the rear axle', () => {
		const service = { forceN: 5000, frontForceN: 3000, rearForceN: 2000, frontCapacityN: 6000, rearCapacityN: 4000,
			frontLock: false, rearLock: false };
		const combined = combinedAxleBraking(service, { ...defaultRunningGear, drivetrainLayout: 'RWD' }, 5000, 5000, 4000);
		expect(combined.forceN).toBe(7000);
		expect(combined.lockRisk).toBe(true);
	});
	it('uses axle capacities for ideal active AWD and releases rear drive with the center clutch', () => {
		const rg = { ...defaultRunningGear, drivetrainLayout: 'AWD' as const, awdFrontShare: 0.5 };
		const fixed = maxDriveForceAtSpeed(rg, 1400, 80, 20000, 5).limitN;
		const active = maxDriveForceAtSpeed({ ...rg, activeCenter: true }, 1400, 80, 20000, 5).limitN;
		const free = maxDriveForceAtSpeed({ ...rg, activeCenter: true, centerDisengaged: true }, 1400, 80, 20000, 5).limitN;
		const front = maxDriveForceAtSpeed({ ...rg, drivetrainLayout: 'FWD' }, 1400, 80, 20000, 5).limitN;
		expect(active).toBeGreaterThanOrEqual(fixed); expect(free).toBeCloseTo(front);
	});
	it('models rear handbrake force and its reduction during forward load transfer', () => {
		const rg = { ...defaultRunningGear, handbrakeFraction: 0.8 };
		expect(handbrakeForceAtSpeed(rg, 1400, 80, 0)).toBeGreaterThan(0);
		expect(handbrakeForceAtSpeed(rg, 1400, 80, -5)).toBeLessThan(handbrakeForceAtSpeed(rg, 1400, 80, 0));
		expect(handbrakeForceAtSpeed({ ...rg, handbrakeFraction: 0 }, 1400, 80, 0)).toBe(0);
	});
	it('uses measured efficiency samples and a safe constant fallback', () => {
		expect(mappedEfficiency([{ rpm: 4000, load: 1, efficiency: 0.91 }], 4000, 1, 0.85)).toBe(0.91);
		expect(mappedEfficiency([{ rpm: NaN, load: 1, efficiency: 0.9 }], 4000, 1, 0.85)).toBe(0.85);
	});
	it('cuts torque at the limiter and bounds the bounce window', () => {
		expect(limiterTorqueFactor(6999, 7000, 0)).toBe(1);
		expect(limiterTorqueFactor(7000, 7000, 0)).toBe(0);
		expect(limiterTorqueFactor(7050, 7000, 0.06, 'bounce')).toBe(1);
		expect(limiterTorqueFactor(7200, 7000, 0.06, 'bounce')).toBe(0);
	});
	it('rejects an over-rev downshift', () => {
		expect(downshiftAdvice(250, 1, 3.5, 4.1, 2, curve, defaultRunningGear, 1400, 0.85)).toBeNull();
	});
	it('provides a feasible apex gear below redline', () => {
		const advice = apexGearAdvice(50, 1, [3.5, 2.1, 1.4, 1], 4.1, 2, curve);
		expect(advice?.rpm).toBeLessThan(curve.redline);
	});
});

describe('braking profiles', () => {
	const input = { speedKmh: 100, massKg: 1400, runningGear: defaultRunningGear, frontBias: 0.65,
		abs: true, dragCd: 0.3, areaM2: 2, gradePercent: 0 };
	it('reserves lateral tire grip while braking in a corner', () => {
		const straight = brakingTireForce(input, 80, 5, 0);
		const corner = brakingTireForce({ ...input, runningGear: { ...defaultRunningGear, lateralG: 0.8 } }, 80, 5, 0);
		expect(corner.forceN).toBeLessThan(straight.forceN);
		expect(corner.frontForceN).toBeLessThanOrEqual(corner.frontCapacityN);
		expect(corner.rearForceN).toBeLessThanOrEqual(corner.rearCapacityN);
	});
	it('stops with a monotonically decreasing speed profile', () => {
		const stop = simulateBraking(input);
		expect(stop.distanceM).toBeGreaterThan(20);
		expect(stop.distanceM).toBeLessThan(80);
		expect(stop.points.at(-1)?.speedKmh).toBe(0);
		expect(stop.points.every((point, i) => i === 0 || point.speedKmh <= stop.points[i - 1].speedKmh)).toBe(true);
	});
	it('needs more distance on a low-grip surface', () => {
		const wet = simulateBraking({ ...input, runningGear: { ...defaultRunningGear, roadFrictionCoefficient: 0.5 } });
		expect(wet.distanceM).toBeGreaterThan(simulateBraking(input).distanceM!);
	});
	it('flags rear lock without ABS at an extreme rear bias', () => {
		const stop = simulateBraking({ ...input, abs: false, frontBias: 0.1 });
		expect(stop.rearLock).toBe(true);
	});
	it('returns no predicted stop for invalid input', () => {
		expect(simulateBraking({ ...input, massKg: 0 }).distanceM).toBeNull();
	});
	it('starts both reference profiles at distance zero and includes the complete stop', () => {
		for (const speedKmh of [100, 200]) {
			const stop = simulateBraking({ ...input, speedKmh });
			expect(stop.points[0]).toMatchObject({ timeS: 0, distanceM: 0, speedKmh });
			expect(stop.points.at(-1)?.distanceM).toBe(stop.distanceM);
			expect(stop.points.every((point) => Number.isFinite(point.decelMps2))).toBe(true);
		}
		expect(simulateBraking({ ...input, speedKmh: 0 })).toMatchObject({ distanceM: 0, timeS: 0 });
	});
});

describe('setup diagnostics', () => {
	it('identifies pressure and camber patterns without certifying a prescription', () => {
		expect(diagnoseTire({ inner: 80, center: 95, outer: 80 })).toContain('diag.pressureHigh');
		expect(diagnoseTire({ inner: 100, center: 85, outer: 75 })).toContain('diag.camberHigh');
		expect(diagnoseTire({ inner: NaN, center: 85, outer: 75 })).toEqual(['lab.invalid']);
	});
	it('flags opposing same-axle spring and ARB adjustments', () => {
		expect(conflictingAdjustments([{ axle: 'rear', component: 'spring', direction: 'softer' },
			{ axle: 'rear', component: 'arb', direction: 'stiffer' }])).toEqual(['rear']);
	});
});

describe('physical properties', () => {
	it('roundtrips speed and RPM over a broad finite domain', () => {
		fc.assert(fc.property(fc.double({ min: 500, max: 15000, noNaN: true }), fc.double({ min: 0.4, max: 6, noNaN: true }),
			fc.double({ min: 1, max: 8, noNaN: true }), fc.double({ min: 1, max: 3, noNaN: true }), (rpm, ratio, fd, circ) => {
				const speed = speedKmh(rpm, ratio, fd, circ);
				expect(Number.isFinite(speed)).toBe(true);
				expect(rpmFromKmh(speed, ratio, fd, circ)).toBeCloseTo(rpm, 7);
				expect(speedKmh(rpm + 100, ratio, fd, circ)).toBeGreaterThan(speed);
			}), { numRuns: 300 });
	});
	it('wheel force remains finite and grows with gearing at a fixed RPM', () => {
		fc.assert(fc.property(fc.double({ min: 0.4, max: 5, noNaN: true }), (ratio) => {
			const force = tractiveForceAt(4000, ratio, 4.1, 0.3, curve, 0.85);
			expect(Number.isFinite(force)).toBe(true);
			expect(tractiveForceAt(4000, ratio + 0.1, 4.1, 0.3, curve, 0.85)).toBeGreaterThan(force);
		}), { numRuns: 300 });
	});
});
