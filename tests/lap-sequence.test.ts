/**
 * @file lap-sequence.test.ts
 * @brief Safe multi-phase acceleration, braking and rev-match regression cases.
 */
import { expect, it } from 'vitest';
import { parseLapCommands, simulateLapSequence } from '../src/core/math/lap-sequence';
import { BENCHMARK_INPUT } from './fixtures/accel-benchmark';
import { defaultRunningGear } from '../src/core/state/app-state';

const input = { ...BENCHMARK_INPUT, runningGear: { ...defaultRunningGear }, engineInertiaKgM2: 0.3 };
it('rejects malformed, unbounded and non-fractional command sequences', () => {
	for (const rows of ['5,3,100,0,1', 'NaN,3,1,0,1', '200,3,1,0,1', '5,3,,0,1', '5,3,0,0,maybe']) {
		expect(parseLapCommands('duration_s,gear,throttle,brake,rev_match\n' + rows)).toBeNull();
	}
});
it('integrates acceleration, an upshift, braking and a matched downshift', () => {
	const commands = parseLapCommands('duration_s,gear,throttle,brake,rev_match\n2,3,1,0,1\n2,4,1,0,1\n2,4,0,0.7,1\n2,3,0,0,1')!;
	const result = simulateLapSequence(input, 80, commands);
	expect(result.error).toBeNull();
	expect(result.shifts.map((shift) => shift.toGear)).toEqual([4, 3]);
	expect(result.shifts[1].blipRpm).toBeGreaterThan(0);
	expect(result.points.at(-1)?.timeS).toBeCloseTo(8);
	expect(result.points.every((point) => Number.isFinite(point.accelMps2) && point.speedKmh >= 0)).toBe(true);
});
it('models extra clutch spin-up drag when the downshift is not rev-matched', () => {
	const base = [{ durationS: 0.1, gear: 4, throttle: 0, brake: 0, revMatch: true },
		{ durationS: 1, gear: 3, throttle: 0, brake: 0, revMatch: true }];
	const matched = simulateLapSequence(input, 90, base);
	const unmatched = simulateLapSequence(input, 90, base.map((command) => ({ ...command, revMatch: false })));
	expect(matched.error).toBeNull(); expect(unmatched.error).toBeNull();
	expect(unmatched.points.at(-1)!.speedKmh).toBeLessThan(matched.points.at(-1)!.speedKmh);
});
it('refuses a downshift beyond the rev limiter', () => {
	const result = simulateLapSequence(input, 200, [
		{ durationS: 0.1, gear: 5, throttle: 0, brake: 0, revMatch: true },
		{ durationS: 1, gear: 1, throttle: 0, brake: 0, revMatch: true }]);
	expect(result.error).toBe('overrev');
});
it('holds a powered gear at the limiter instead of spuriously aborting the sequence', () => {
	const result = simulateLapSequence(input, 40, [{ durationS: 10, gear: 1, throttle: 1, brake: 0, revMatch: true }]);
	expect(result.error).toBeNull();
	expect(result.points.every((point) => point.rpm <= input.curve!.redline + 1)).toBe(true);
	expect(result.points[0].timeS).toBe(0);
});
it('accepts bounded handbrake phases and releases the rear center coupling', () => {
	const commands = parseLapCommands('duration_s,gear,throttle,brake,rev_match,handbrake\n1,3,0,0,1,0.8')!;
	const awd = { ...input, runningGear: { ...input.runningGear, drivetrainLayout: 'AWD' as const, activeCenter: true } };
	const pulled = simulateLapSequence(awd, 80, commands);
	const released = simulateLapSequence(awd, 80, commands.map((command) => ({ ...command, handbrake: 0 })));
	expect(pulled.error).toBeNull();
	expect(pulled.points.at(-1)!.speedKmh).toBeLessThan(released.points.at(-1)!.speedKmh);
	expect(parseLapCommands('duration_s,gear,throttle,brake,rev_match,handbrake\n1,3,0,0,1,2')).toBeNull();
});
