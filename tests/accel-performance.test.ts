/**
 * @file accel-performance.test.ts
 * @brief Warm-run median performance guard, independently of Vitest bench reporting.
 */
import { expect, it } from 'vitest';
import { simulateAcceleration } from '../src/core/math/accel-math';
import { dynamicsInput } from './dynamics-fixtures';

it.each(['RWD', 'AWD'] as const)('keeps a 64-point %s dyno run below a 3 ms warm median', (layout) => {
	const input = dynamicsInput({
		runningGear: { ...dynamicsInput().runningGear!, drivetrainLayout: layout, centerDiffLock: 1 },
		curve: { ...dynamicsInput().curve!, points: Array.from({ length: 64 }, (_, i) => ({
			rpm: 1000 + i * 6000 / 63, torqueNm: 150 + 140 * Math.sin(Math.PI * i / 80),
		})) },
	});
	for (let i = 0; i < 30; i += 1) simulateAcceleration(input);
	const timings: number[] = [];
	for (let i = 0; i < 31; i += 1) {
		const start = performance.now();
		const result = simulateAcceleration(input);
		timings.push(performance.now() - start);
		expect(result.time0To100S).not.toBeNull();
	}
	timings.sort((a, b) => a - b);
	expect(timings[15]).toBeLessThan(3);
});
