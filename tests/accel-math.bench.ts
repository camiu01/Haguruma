/**
 * @file accel-math.bench.ts
 * @brief Standing-start Euler benchmark for anchors and maximum-size dyno curves.
 */
import { bench, describe } from 'vitest';
import { simulateAcceleration } from '../src/core/math/accel-math';
import { dynamicsInput } from './dynamics-fixtures';

const anchors = dynamicsInput();
const dyno = dynamicsInput({
	curve: {
		...anchors.curve!,
		points: Array.from({ length: 64 }, (_, i) => ({
			rpm: 1000 + i * 6000 / 63,
			torqueNm: 150 + 140 * Math.sin(Math.PI * i / 80),
		})),
	},
});
const activeAwd = dynamicsInput({
	...dyno, runningGear: { ...dyno.runningGear!, drivetrainLayout: 'AWD', centerDiffLock: 1, torqueVectoring: 0.7 },
});

describe('Euler acceleration solver (target: mean <3 ms)', () => {
	bench('anchor curve with live transfer', () => simulateAcceleration(anchors));
	bench('64-point Akima dyno with live transfer', () => simulateAcceleration(dyno));
	bench('64-point dyno with active AWD', () => simulateAcceleration(activeAwd));
});
