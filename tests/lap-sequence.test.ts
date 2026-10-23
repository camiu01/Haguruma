/**
 * @file lap-sequence.test.ts
 * @brief Downshift, rev matching, sequence validation and apex gear regression.
 */
import { describe, expect, it } from 'vitest';
import { adviseApexGear } from '../src/core/math/corner-advisor';
import { parseLapCommands, simulateLapSequence } from '../src/core/math/lap-sequence';
import { brakingInput, dynamicsInput } from './dynamics-fixtures';

describe('lap commands', () => {
	it('parses one-based gear input and rejects malformed or excessive commands', () => {
		expect(parseLapCommands('2,4,0,0\n3,3,0.5,0', false)?.[1]).toEqual({ durationS: 3, gear: 2, throttle: 0.5, brakeG: 0, revMatch: false });
		for (const csv of ['', '2,1,0', '2,,0,0', '2,1.5,0,0', '2,1,2,0', '2,1,0,-1', 'NaN,1,0,0']) expect(parseLapCommands(csv)).toBeNull();
	});
	it('coasts, blips a downshift, brakes and accelerates in a full sequence', () => {
		const input = dynamicsInput();
		const commands = parseLapCommands('1,4,0,0\n1,3,0,0\n1,3,0,1.2\n2,2,1,0')!;
		const samples = simulateLapSequence(input, commands, 100, brakingInput());
		expect(samples).not.toBeNull();
		expect(samples!.some((s) => s.blipRpm > 0)).toBe(true);
		expect(samples!.some((s) => s.gear === 1)).toBe(true);
		expect(samples!.at(-1)!.timeS).toBeCloseTo(5, 8);
		expect(samples!.at(-1)!.distanceM).toBeGreaterThan(0);
		expect(samples!.find((s) => s.timeS > 0.5)!.speedKmh).toBeLessThan(100);
	});
	it('unmatched downshift dissipates clutch energy instead of magically matching RPM', () => {
		const input = dynamicsInput();
		const matched = simulateLapSequence(input, parseLapCommands('0.1,4,0,0\n1,2,0,0', true)!, 90)!;
		const unmatched = simulateLapSequence(input, parseLapCommands('0.1,4,0,0\n1,2,0,0', false)!, 90)!;
		expect(matched.some((s) => s.blipRpm > 0)).toBe(true);
		expect(unmatched.every((s) => s.blipRpm === 0)).toBe(true);
		expect(unmatched.at(-1)!.speedKmh).toBeLessThan(matched.at(-1)!.speedKmh);
	});
	it('rejects over-rev downshifts, invalid geometry and unbounded runs', () => {
		expect(simulateLapSequence(dynamicsInput(), parseLapCommands('1,6,0,0\n1,1,0,0')!, 200)).toBeNull();
		expect(simulateLapSequence(dynamicsInput({ circM: 0 }), parseLapCommands('1,1,1,0')!, 0)).toBeNull();
		expect(simulateLapSequence(dynamicsInput(), parseLapCommands('40,3,0,0\n40,3,0,0')!, 100)).toBeNull();
	});
});

describe('apex advisor', () => {
	it('computes sqrt(radius × lateral acceleration) and avoids over-rev', () => {
		const input = dynamicsInput();
		const advice = adviseApexGear(50, 1, input.gears, input.fd, input.circM, input.curve, 3)!;
		expect(advice.speedKmh).toBeCloseTo(Math.sqrt(50 * 9.81) * 3.6, 10);
		expect(advice.rpm).toBeGreaterThanOrEqual(1000);
		expect(advice.rpm).toBeLessThanOrEqual(input.curve!.redline);
		const hold = adviseApexGear(50, 1, input.gears, input.fd, input.circM, input.curve, advice.gearIndex)!;
		expect(hold.action).toBe('hold');
	});
	it('returns no advice for invalid radius or unreachable apex speed', () => {
		const input = dynamicsInput();
		expect(adviseApexGear(0, 1, input.gears, input.fd, input.circM, input.curve, 3)).toBeNull();
		expect(adviseApexGear(10000, 3, input.gears, input.fd, input.circM, input.curve, 3)).toBeNull();
	});
});
