/**
 * @file share-compact.test.ts
 * @brief Unit tests for the packed Base64URL share codec.
 */
import { describe, expect, it } from 'vitest';
import { decodeCompactSetup, encodeCompactSetup } from '../src/core/share/share-compact';
import { decodeState, encodeState } from '../src/core/share/share-utils';
import { state } from '../src/core/state/app-state';

describe('share-compact', () => {
	it('round-trips the Eclipse primary setup', () => {
		const code = encodeCompactSetup({ tire: '195/60R15', fd: 4.322, redline: 7000, gears: [3.363, 1.947, 1.285, 0.939, 0.756], reverseRatio: 3.083 });
		expect(code).not.toBeNull();
		const back = decodeCompactSetup(code as string);
		expect(back?.tire).toBe('195/60R15');
		expect(back?.fd).toBeCloseTo(4.322, 2);
		expect(back?.redline).toBe(7000);
		expect(back?.gears).toHaveLength(5);
		expect(back?.reverseRatio).toBeCloseTo(3.083, 3);
	});
	it('is shorter than the verbose hash for the same setup', () => {
		const code = encodeCompactSetup({ tire: '195/60R15', fd: 4.322, redline: 7000, gears: [3.363, 1.947, 1.285, 0.939, 0.756], reverseRatio: null });
		const verbose = encodeState({ ...state, gears: [3.363, 1.947, 1.285, 0.939, 0.756] });
		expect((code as string).length).toBeLessThan(verbose.length);
	});
	it('rejects malformed tokens', () => {
		expect(decodeCompactSetup('!!!')).toBeNull();
		expect(decodeCompactSetup('')).toBeNull();
		expect(encodeCompactSetup({ tire: 'bogus', fd: 4.3, redline: 7000, gears: [3.0], reverseRatio: null })).toBeNull();
	});
	it('is emitted by encodeState and round-trips via decodeState', () => {
		const hash = encodeState({ ...state, primaryTire: '195/60R15', primaryFd: 4.322, primaryRedline: 7000, gears: [3.363, 1.947] });
		const params = new URLSearchParams(hash);
		expect(params.get('c')).not.toBeNull();
		expect(params.get('g')).toBeNull();
		expect(params.get('tire')).toBeNull();
		const patch = decodeState(`#${hash}`);
		expect(patch.primaryTire).toBe('195/60R15');
		expect(patch.primaryFd).toBeCloseTo(4.322, 2);
		expect(patch.gears).toEqual([3.363, 1.947]);
	});
});
