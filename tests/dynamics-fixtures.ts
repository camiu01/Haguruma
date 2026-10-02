/**
 * @file dynamics-fixtures.ts
 * @brief Shared realistic vehicle inputs for the v0.7 regression and benchmark suite.
 */
import { defaultRunningGear } from '../src/core/state/app-state';
import type { SimInput } from '../src/core/math/accel-math';
import type { BrakingInput } from '../src/core/math/braking-simulation';

/**
 * @brief Build a sports-car simulation without shared mutable chassis objects.
 * @param overrides Optional physical overrides.
 * @return Complete simulation input.
 */
export const dynamicsInput = (overrides: Partial<SimInput> = {}): SimInput => ({
	massKg: 1400, gears: [3.2, 2.1, 1.5, 1.15, 0.92, 0.76], fd: 3.7, circM: 2.05,
	curve: { redline: 7000, peakTorqueRpm: 4000, peakTorqueNm: 300, peakPowerRpm: 6000, peakPowerKw: 220 },
	drivetrainEff: 0.85, shiftTimeS: 0.15, efficiencyMap: true,
	runningGear: { ...defaultRunningGear, drivetrainLayout: 'RWD', differentialType: 'clutch_lsd', differentialBias: 0.6 },
	dragCd: 0.32, frontalAreaM2: 2, rollingCrr: 0.012, ...overrides,
});

/**
 * @brief Build a braking input with optional overrides.
 * @param overrides Optional road and brake settings.
 * @return Complete braking input.
 */
export const brakingInput = (overrides: Partial<BrakingInput> = {}): BrakingInput => ({
	massKg: 1400, runningGear: { ...defaultRunningGear, roadFrictionCoefficient: 1, liftCoefficient: 0 },
	abs: true, frontBias: 0.7, demandG: 1.4, dragCd: 0, frontalAreaM2: 0, rollingCrr: 0,
	...overrides,
});
