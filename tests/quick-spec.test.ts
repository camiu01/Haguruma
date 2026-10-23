/**
 * @file quick-spec.test.ts
 * @brief Datasheet range and estimated-anchor compatibility tests.
 */
import { expect, it } from 'vitest';
import { presetFromQuickSpec } from '../src/core/presets/quick-spec';
import { validateCurve } from '../src/core/math/engine-curve-core';
import { validateGarageBackup } from '../src/core/presets/backup-store';

const spec = { name: 'Road car', tire: '205/55R16', gears: '3.5, 2.1, 1.4, 1, 0.8', fd: 4.1, redline: 7000, massKg: 1400, powerKw: 150 };

it('creates a saved-preset-compatible starting point and consistent estimated anchors', () => {
	const result = presetFromQuickSpec(spec)!;
	expect(validateGarageBackup({ [result.name]: result.preset })).not.toBeNull();
	expect(validateCurve({ ...result.preset,
		peakTorqueRpm: result.preset.peakTorqueRpm!, peakTorqueNm: result.preset.peakTorqueNm!,
		peakPowerRpm: result.preset.peakPowerRpm!, peakPowerKw: result.preset.powerKw! })).not.toBeNull();
});
it('rejects malformed ratios, unsafe names and out-of-range datasheet values', () => {
	for (const invalid of [{ gears: '3oops,2' }, { gears: '1,2' }, { gears: '3,3' }, { name: '__proto__' },
		{ name: '' }, { massKg: 0 }, { fd: Infinity }, { powerKw: NaN }, { redline: 20000 }, { tire: 'invalid' }]) {
		expect(presetFromQuickSpec({ ...spec, ...invalid })).toBeNull();
	}
});
