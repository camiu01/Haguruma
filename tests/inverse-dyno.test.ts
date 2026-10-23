/**
 * @file inverse-dyno.test.ts
 * @brief Unit tests for torque recovery from an acceleration trace.
 */
import { describe, expect, it } from 'vitest';
import {
	recoveredPointsToCsv,
	torqueFromAccelLog,
	type AccelTraceSample,
} from '../src/core/math/inverse-dyno';

const VEHICLE = {
	massKg: 1200,
	gearRatio: 1.5,
	fd: 4,
	circM: 2,
	cd: 0.3,
	areaM2: 2,
	crr: 0.012,
	eff: 0.9,
};

/**
 * @brief Build a constant-acceleration trace.
 * @return Twelve samples at 0.5 s steps from 40 km/h.
 */
const steadyTrace = (): AccelTraceSample[] => {
	const out: AccelTraceSample[] = [];
	for (let idx = 0; idx < 12; idx += 1) {
		out.push({ t: idx * 0.5, speedKmh: 40 + idx * 2.5 });
	}
	return out;
};

describe('torqueFromAccelLog', () => {
	it('recovers a sorted torque curve from a steady pull', () => {
		const points = torqueFromAccelLog(steadyTrace(), VEHICLE);
		expect(points && points.length >= 2).toBe(true);
		for (let idx = 1; idx < (points?.length ?? 0); idx += 1) {
			expect(points?.[idx].rpm).toBeGreaterThan(points?.[idx - 1].rpm ?? 0);
		}
		for (const point of points ?? []) {
			expect(point.torqueNm).toBeGreaterThan(100);
		}
	});
	it('rejects short traces and bad vehicles', () => {
		expect(torqueFromAccelLog([{ t: 0, speedKmh: 40 }], VEHICLE)).toBeNull();
		expect(torqueFromAccelLog(steadyTrace(), { ...VEHICLE, eff: 0 })).toBeNull();
	});
});

describe('recoveredPointsToCsv', () => {
	it('emits a header plus one row per point', () => {
		const text = recoveredPointsToCsv([{ rpm: 3000, torqueNm: 200 }]);
		expect(text).toBe('rpm,torque_Nm\n3000,200');
	});
});
