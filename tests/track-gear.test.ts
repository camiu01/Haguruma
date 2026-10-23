/**
 * @file track-gear.test.ts
 * @brief Unit tests for the track-archetype gear advice.
 */
import { describe, expect, it } from 'vitest';
import { adviseTrackGears, ratioInWindow, trackProfile } from '../src/core/math/track-gear';

describe('adviseTrackGears', () => {
	it('keeps 2nd shorter than 3rd on every archetype', () => {
		for (const id of ['hairpin', 'balanced', 'fast']) {
			const advice = adviseTrackGears(id, 4500, 4.1, 1.95);
			expect(advice?.second).toBeGreaterThan(advice?.third ?? 0);
		}
	});
	it('lands torque-point speeds inside the archetype windows', () => {
		const advice = adviseTrackGears('balanced', 4500, 4.1, 1.95);
		const profile = trackProfile('balanced');
		expect(advice && profile && ratioInWindow(advice.second, profile.secondWindow, 4500, 4.1, 1.95)).toBe(true);
		expect(advice && profile && ratioInWindow(advice.third, profile.thirdWindow, 4500, 4.1, 1.95)).toBe(true);
	});
	it('rejects unknown archetypes and bad input', () => {
		expect(adviseTrackGears('oval', 4500, 4.1, 1.95)).toBeNull();
		expect(adviseTrackGears('fast', 0, 4.1, 1.95)).toBeNull();
		expect(trackProfile('oval')).toBeNull();
	});
});
