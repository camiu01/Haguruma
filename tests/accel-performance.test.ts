/**
 * @file accel-performance.test.ts
 * @brief Explicit host-speed gate, run separately from parallel correctness tests.
 */
import { expect, it } from 'vitest';
import { simulateAcceleration } from '../src/core/math/accel-math';
import { BENCHMARK_INPUT } from './fixtures/accel-benchmark';

it.skipIf(process.env.HAGURUMA_PERF_GATE !== '1' && process.env.npm_lifecycle_event !== 'bench')('keeps warmed 64-point dyno simulations below 3 ms on average', () => {
	for (let run = 0; run < 50; run += 1) simulateAcceleration(BENCHMARK_INPUT);
	const start = performance.now();
	for (let run = 0; run < 100; run += 1) simulateAcceleration(BENCHMARK_INPUT);
	expect((performance.now() - start) / 100).toBeLessThan(3);
});
