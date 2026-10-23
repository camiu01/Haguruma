/**
 * @file accel-math.bench.ts
 * @brief Warm acceleration-solver benchmark with a 64-point measured curve.
 */
import { bench, describe } from 'vitest';
import { simulateAcceleration } from '../src/core/math/accel-math';
import { BENCHMARK_INPUT } from './fixtures/accel-benchmark';

describe('64-point dyno curve, dt = 0.01 s', () => {
	bench('complete acceleration run', () => {
		simulateAcceleration(BENCHMARK_INPUT);
	}, { time: 1500, warmupTime: 500, iterations: 100 });
});
