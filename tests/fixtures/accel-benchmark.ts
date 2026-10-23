/**
 * @file accel-benchmark.ts
 * @brief Shared dense-dyno workload for timing and performance regression gates.
 */
import type { SimInput } from '../../src/core/math/accel-math';

export const BENCHMARK_INPUT: SimInput = {
	massKg: 1400, gears: [3.2, 2.1, 1.5, 1.15, 0.92, 0.76], fd: 3.7, circM: 2.05,
	curve: {
		redline: 7000, peakTorqueRpm: 4000, peakTorqueNm: 300, peakPowerRpm: 6000, peakPowerKw: 180,
		points: Array.from({ length: 64 }, (_, index) => ({
			rpm: 1000 + index * 6000 / 63, torqueNm: 240 + 60 * Math.sin(index * Math.PI / 63),
		})),
	},
	drivetrainEff: 0.85, shiftTimeS: 0.2, dragCd: 0.32, frontalAreaM2: 2, rollingCrr: 0.012, roadGradePercent: 0,
};
