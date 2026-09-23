/**
 * @file presets.ts
 * @brief Factory preset vehicles for the header dropdown.
 *
 * Reverse ratios from factory documentation: Eclipse 1G GS 3.083 (owner data),
 * Miata NA 5MT 3.758 (period spec sheet), S2000 AP1 2.800 (Honda press release),
 * E46 M3 3.75 (BMW ratio chart), GR86 6MT 3.438 (Toyota UK tech spec),
 * 911 GT3 ratio set 3.42 (Porsche press tech data).
 */
import type { GearPreset } from '../core/models';

/**
 * Factory preset vehicles for the header dropdown.
 * @brief Realistic starting points including the Eclipse 1G GS hero preset.
 */
export const presets: Record<string, GearPreset> = {
	eclipse_1g_gs: {
		tire: '195/60R15',
		fd: 4.322,
		redline: 7000,
		gears: [3.363, 1.947, 1.285, 0.939, 0.756],
		reverseRatio: 3.083,
		massKg: 1270,
		dragCd: 0.29,
		frontalAreaM2: 1.95,
		powerKw: 110,
		peakTorqueRpm: 4500,
		peakTorqueNm: 180,
		peakPowerRpm: 6500,
		runningGear: {
			frontWeightDistribution: 0.58, centerOfGravityHeightMm: 500, wheelbaseMm: 2570, trackWidthMm: 1460,
			roadFrictionCoefficient: 1.10, drivetrainLayout: 'FWD', differentialType: 'open', differentialBias: 0.25,
			springRateFrontNmm: 35, springRateRearNmm: 32, lateralG: 0,
		},
	},
	miata_na6: {
		tire: '185/60R14',
		fd: 4.3,
		redline: 7200,
		gears: [3.136, 1.888, 1.33, 1.0, 0.814],
		reverseRatio: 3.758,
		massKg: 960,
		dragCd: 0.38,
		frontalAreaM2: 1.7,
		powerKw: 85,
		peakTorqueRpm: 4500,
		peakTorqueNm: 140,
		peakPowerRpm: 6600,
		runningGear: {
			frontWeightDistribution: 0.52, centerOfGravityHeightMm: 420, wheelbaseMm: 2265, trackWidthMm: 1400,
			roadFrictionCoefficient: 1.10, drivetrainLayout: 'RWD', differentialType: 'open', differentialBias: 0.25,
			springRateFrontNmm: 35, springRateRearNmm: 32, lateralG: 0,
		},
	},
	s2000_ap1: {
		tire: '225/50R16',
		fd: 4.1,
		redline: 9000,
		gears: [3.133, 2.045, 1.481, 1.161, 0.971, 0.811],
		reverseRatio: 2.8,
		massKg: 1240,
		dragCd: 0.34,
		frontalAreaM2: 1.9,
		powerKw: 177,
		peakTorqueRpm: 6500,
		peakTorqueNm: 208,
		peakPowerRpm: 8300,
		runningGear: {
			frontWeightDistribution: 0.50, centerOfGravityHeightMm: 400, wheelbaseMm: 2400, trackWidthMm: 1470,
			roadFrictionCoefficient: 1.10, drivetrainLayout: 'RWD', differentialType: 'open', differentialBias: 0.25,
			springRateFrontNmm: 35, springRateRearNmm: 32, lateralG: 0,
		},
	},
	e46_m3: {
		tire: '255/40R18',
		fd: 3.62,
		redline: 8000,
		gears: [4.23, 2.53, 1.67, 1.23, 1.0, 0.83],
		reverseRatio: 3.75,
		massKg: 1495,
		dragCd: 0.32,
		frontalAreaM2: 2.05,
		powerKw: 252,
		peakTorqueRpm: 4900,
		peakTorqueNm: 365,
		peakPowerRpm: 7900,
		runningGear: {
			frontWeightDistribution: 0.51, centerOfGravityHeightMm: 460, wheelbaseMm: 2730, trackWidthMm: 1500,
			roadFrictionCoefficient: 1.10, drivetrainLayout: 'RWD', differentialType: 'clutch_lsd', differentialBias: 0.35,
			springRateFrontNmm: 35, springRateRearNmm: 32, lateralG: 0,
		},
	},
	gr86: {
		tire: '215/40R18',
		fd: 4.1,
		redline: 7500,
		gears: [3.626, 2.188, 1.541, 1.213, 1.0, 0.767],
		reverseRatio: 3.438,
		massKg: 1270,
		dragCd: 0.27,
		frontalAreaM2: 1.95,
		powerKw: 168,
		peakTorqueRpm: 3700,
		peakTorqueNm: 250,
		peakPowerRpm: 7000,
		runningGear: {
			frontWeightDistribution: 0.53, centerOfGravityHeightMm: 430, wheelbaseMm: 2575, trackWidthMm: 1520,
			roadFrictionCoefficient: 1.10, drivetrainLayout: 'RWD', differentialType: 'torsen', differentialBias: 0.25,
			springRateFrontNmm: 35, springRateRearNmm: 32, lateralG: 0,
		},
	},
	porsche_gt3: {
		tire: '305/30R20',
		fd: 3.97,
		redline: 9000,
		gears: [3.75, 2.38, 1.72, 1.34, 1.11, 0.96],
		reverseRatio: 3.42,
		massKg: 1430,
		dragCd: 0.33,
		frontalAreaM2: 2.0,
		powerKw: 349,
		peakTorqueRpm: 6250,
		peakTorqueNm: 470,
		peakPowerRpm: 8500,
		runningGear: {
			frontWeightDistribution: 0.40, centerOfGravityHeightMm: 380, wheelbaseMm: 2450, trackWidthMm: 1550,
			roadFrictionCoefficient: 1.10, drivetrainLayout: 'RWD', differentialType: 'torsen', differentialBias: 0.25,
			springRateFrontNmm: 60, springRateRearNmm: 65, lateralG: 0,
		},
	},
};
