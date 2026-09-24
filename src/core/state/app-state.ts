/**
 * @file app-state.ts
 * @brief Default state and mutable singleton store.
 */
import type { AppState, RunningGear } from '../models';

/**
 * Default chassis and running-gear parameters.
 * @brief Factory baseline for load-transfer physics.
 * @returns Default RunningGear value.
 */
export const defaultRunningGear: RunningGear = {
	frontWeightDistribution: 0.52,
	centerOfGravityHeightMm: 450,
	wheelbaseMm: 2570,
	trackWidthMm: 1480,
	roadFrictionCoefficient: 1.10,
	drivetrainLayout: 'FWD',
	differentialType: 'open',
	differentialBias: 0.25,
	differentialCoastBias: 0,
	springRateFrontNmm: 35,
	springRateRearNmm: 32,
	lateralG: 0,
	liftCoefficient: 0.15,
	liftReferenceAreaM2: 2.0,
	downforceFrontShare: 0.52,
};

/**
 * Default application state.
 * @brief Initial powertrain setup shown on first load.
 * @returns Default AppState value.
 */
export const defaultState: AppState = {
	unit: 'kmh',
	powerUnit: 'kw',
	primaryTire: '205/55R16',
	primaryFd: 4.10,
	primaryRedline: 7200,
	maxGraphSpeed: 300,
	gears: [3.58, 2.05, 1.38, 1.0, 0.81, 0.68],
	reverseRatio: null,
	compareEnabled: false,
	compTire: '225/45R17',
	compFd: 3.90,
	compGears: [3.58, 2.05, 1.38, 1.0, 0.81, 0.68],
	compRedline: 7200,
	compMassKg: 1200,
	compCd: 0.30,
	compFrontalAreaM2: 2.0,
	compPowerKw: 110,
	compPeakTorqueRpm: 4500,
	compPeakTorqueNm: 180,
	compPeakPowerRpm: 6500,
	roadLoadEnabled: true,
	vehicleMassKg: 1200,
	dragCd: 0.30,
	frontalAreaM2: 2.0,
	rollingCrr: 0.012,
	enginePowerKw: 110,
	drivetrainEff: 0.85,
	roadGradePercent: 0,
	rollingFactor: 0.975,
	peakTorqueRpm: 4500,
	peakTorqueNm: 180,
	peakPowerRpm: 6500,
	rotatingMassKg: 0,
	shiftTimeS: 0,
	runningGear: { ...defaultRunningGear },
	compRunningGear: { ...defaultRunningGear },
	setupGuide: { phase: 'mid', issue: 'understeer' },
};

/**
 * Mutable singleton store shared by all renderers.
 * @purpose Avoid prop drilling in this small vanilla-TS app.
 */
export const state: AppState = {
	...defaultState,
	gears: [...defaultState.gears],
	compGears: [...defaultState.compGears],
	runningGear: { ...defaultRunningGear },
	compRunningGear: { ...defaultRunningGear },
	setupGuide: { ...defaultState.setupGuide },
};
