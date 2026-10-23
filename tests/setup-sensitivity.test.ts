/**
 * @file setup-sensitivity.test.ts
 * @brief Signed finite-difference metrics and non-mutating setup evaluation.
 */
import { expect, it } from 'vitest';
import { setupSensitivity } from '../src/core/math/setup-sensitivity';
import { BENCHMARK_INPUT } from './fixtures/accel-benchmark';
import { defaultRunningGear } from '../src/core/state/app-state';

it('reports all inputs and finite signed changes without editing the setup', () => {
	const input = { ...BENCHMARK_INPUT, runningGear: { ...defaultRunningGear } };
	const before = JSON.stringify(input);
	const rows = setupSensitivity(input);
	expect(rows.map((row) => row.input).sort()).toEqual(['fd', 'gears', 'grip', 'mass', 'tire']);
	expect(rows.every((row) => Number.isFinite(row.topSpeedDeltaPercent) && Number.isFinite(row.shiftDeltaRpm)
		&& (row.accelDeltaPercent === null || Number.isFinite(row.accelDeltaPercent)))).toBe(true);
	expect(rows.find((row) => row.input === 'mass')!.topSpeedDeltaPercent).toBeLessThanOrEqual(0);
	expect(JSON.stringify(input)).toBe(before);
});
it('preserves the sign of gearing and tire-size effects when gearing limits speed', () => {
	const rows = setupSensitivity({ ...BENCHMARK_INPUT, dragCd: 0, frontalAreaM2: 0, rollingCrr: 0 });
	expect(rows.find((row) => row.input === 'fd')!.topSpeedDeltaPercent).toBeLessThan(0);
	expect(rows.find((row) => row.input === 'tire')!.topSpeedDeltaPercent).toBeGreaterThan(0);
});
