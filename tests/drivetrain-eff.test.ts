/**
 * @file drivetrain-eff.test.ts
 * @brief Unit tests for layout-mapped default drivetrain efficiency.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_DRIVETRAIN_EFF, efficiencyForLayout } from '../src/config/drivetrain-eff';

describe('efficiencyForLayout', () => {
	it('maps every layout to a distinct sane default', () => {
		expect(efficiencyForLayout('FWD')).toBe(DEFAULT_DRIVETRAIN_EFF.FWD);
		expect(efficiencyForLayout('RWD')).toBe(DEFAULT_DRIVETRAIN_EFF.RWD);
		expect(efficiencyForLayout('AWD')).toBe(DEFAULT_DRIVETRAIN_EFF.AWD);
		expect(DEFAULT_DRIVETRAIN_EFF.FWD).toBeGreaterThan(DEFAULT_DRIVETRAIN_EFF.RWD);
		expect(DEFAULT_DRIVETRAIN_EFF.RWD).toBeGreaterThan(DEFAULT_DRIVETRAIN_EFF.AWD);
	});
	it('keeps every default inside the road-load input range', () => {
		for (const eff of Object.values(DEFAULT_DRIVETRAIN_EFF)) {
			expect(eff).toBeGreaterThanOrEqual(0.7);
			expect(eff).toBeLessThanOrEqual(1.0);
		}
	});
});
