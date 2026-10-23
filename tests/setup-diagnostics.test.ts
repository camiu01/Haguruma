/**
 * @file setup-diagnostics.test.ts
 * @brief Cross-axle temperature and contradictory-adjustment warnings.
 */
import { describe, expect, it } from 'vitest';
import {
	AXLE_IMBALANCE_C,
	conflictingAdjustments,
	diagnoseAxleTemperatures,
	type SetupAdjustment,
	type TireTemperatures,
} from '../src/core/setup/setup-diagnostics';

/**
 * @brief Build one tire with the same temperature in all three tread zones.
 * @param value Tread temperature in Celsius.
 * @return Tire fixture.
 */
const tire = (value: number): TireTemperatures => ({ inner: value, center: value, outer: value });

/**
 * @brief Build one proposed adjustment.
 * @param axle Axle the change applies to.
 * @param component Component being changed.
 * @param direction Direction of the change.
 * @return Adjustment fixture.
 */
const change = (axle: 'front' | 'rear', component: 'spring' | 'arb', direction: 'stiffer' | 'softer'): SetupAdjustment => ({ axle, component, direction });

describe('diagnoseAxleTemperatures', () => {
	it('flags a rear axle running much hotter than the front', () => {
		expect(diagnoseAxleTemperatures([tire(70), tire(70), tire(90), tire(90)])).toEqual(['diag.rearHot']);
	});
	it('flags a front axle running much hotter than the rear', () => {
		expect(diagnoseAxleTemperatures([tire(95), tire(90), tire(70), tire(70)])).toEqual(['diag.frontHot']);
	});
	it('stays silent while the axles are within the imbalance threshold', () => {
		expect(diagnoseAxleTemperatures([tire(80), tire(80), tire(80), tire(80)])).toEqual([]);
		expect(diagnoseAxleTemperatures([tire(80), tire(80), tire(80), tire(80 + AXLE_IMBALANCE_C)])).toEqual([]);
	});
	it('ignores incomplete or implausible readings', () => {
		expect(diagnoseAxleTemperatures([tire(80), tire(80), tire(80)])).toEqual([]);
		expect(diagnoseAxleTemperatures([tire(80), tire(80), tire(80), tire(-1)])).toEqual([]);
		expect(diagnoseAxleTemperatures([tire(80), tire(80), tire(80), tire(400)])).toEqual([]);
		expect(diagnoseAxleTemperatures([tire(80), tire(80), tire(80), { inner: Number.NaN, center: 80, outer: 80 }])).toEqual([]);
	});
});

describe('conflictingAdjustments', () => {
	it('reports an axle whose spring and bar pull in opposite directions', () => {
		expect(conflictingAdjustments([change('front', 'spring', 'stiffer'), change('front', 'arb', 'softer')])).toEqual(['front']);
	});
	it('reports both axles when each is self-contradictory, front first', () => {
		expect(
			conflictingAdjustments([
				change('rear', 'spring', 'stiffer'),
				change('front', 'spring', 'softer'),
				change('rear', 'arb', 'softer'),
				change('front', 'arb', 'stiffer'),
			]),
		).toEqual(['front', 'rear']);
	});
	it('accepts coherent plans and single changes', () => {
		expect(conflictingAdjustments([])).toEqual([]);
		expect(conflictingAdjustments([change('front', 'spring', 'stiffer')])).toEqual([]);
		expect(conflictingAdjustments([change('front', 'spring', 'stiffer'), change('front', 'arb', 'stiffer')])).toEqual([]);
		expect(conflictingAdjustments([change('front', 'spring', 'stiffer'), change('rear', 'arb', 'softer')])).toEqual([]);
	});
});
