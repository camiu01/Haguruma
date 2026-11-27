/**
 * @file ground-truth.test.ts
 * @brief Regression against hand-computed datasheet values (<0.5% tolerance).
 *
 * Reference speeds are worked out by hand from the factory gear and final-drive
 * ratios and the ETRTO tire geometry (rim + 2 x section x aspect), then frozen
 * as literals. The app pipeline (catalog JSON -> tire parser -> speed math)
 * must land within 0.5% of them, so a drift in the parser, the catalog
 * ratios or the speed relation fails loudly.
 */
import { describe, expect, it } from 'vitest';
import { parseTire } from '../src/core/math/tire-math';
import { speedKmh } from '../src/core/math/speed-math';
import miata from '../src/config/cars/miata_na6.json';
import s2000 from '../src/config/cars/s2000_ap1.json';
import e46 from '../src/config/cars/e46_m3.json';

interface Reference {
	/** Catalog entry under test. */
	car: { id: string; preset: { tire: string; fd: number; redline: number; gears: number[] } };
	/** Factory ratios, first to top gear. */
	gears: number[];
	/** Factory final drive. */
	fd: number;
	/** Hand-computed km/h per 1000 rpm in first and top gear. */
	per1000: [number, number];
	/** Hand-computed km/h at the limiter in top gear. */
	limiterTop: number;
}

const REFERENCES: Reference[] = [
	{ car: miata, gears: [3.136, 1.888, 1.33, 1.0, 0.814], fd: 4.3, per1000: [8.074, 31.105], limiterTop: 223.96 },
	{ car: s2000, gears: [3.133, 2.045, 1.481, 1.161, 0.971, 0.811], fd: 4.1, per1000: [9.265, 35.794], limiterTop: 322.14 },
	{ car: e46, gears: [4.23, 2.53, 1.67, 1.23, 1.0, 0.83], fd: 3.62, per1000: [8.139, 41.481], limiterTop: 331.85 },
];

const TOLERANCE = 0.005;

/**
 * @brief Assert a value within the relative ground-truth tolerance.
 * @param actual Computed value.
 * @param expected Reference value.
 * @return void
 */
const expectWithin = (actual: number, expected: number): void => {
	expect(Math.abs(actual - expected) / expected).toBeLessThan(TOLERANCE);
};

describe('ground truth: factory datasheets', () => {
	for (const ref of REFERENCES) {
		const { preset } = ref.car;
		const circ = parseTire(preset.tire)?.circumferenceM ?? 0;
		const top = preset.gears.length - 1;

		it(`${ref.car.id}: catalog ratios match the factory sheet`, () => {
			expect(preset.gears).toEqual(ref.gears);
			expect(preset.fd).toBe(ref.fd);
		});

		it(`${ref.car.id}: speed per 1000 rpm in first and top gear`, () => {
			expectWithin(speedKmh(1000, preset.gears[0], preset.fd, circ), ref.per1000[0]);
			expectWithin(speedKmh(1000, preset.gears[top], preset.fd, circ), ref.per1000[1]);
		});

		it(`${ref.car.id}: speed at the limiter in top gear`, () => {
			expectWithin(speedKmh(preset.redline, preset.gears[top], preset.fd, circ), ref.limiterTop);
		});
	}
});
