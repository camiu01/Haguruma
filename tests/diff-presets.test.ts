/**
 * @file diff-presets.test.ts
 * @brief Unit tests for the extensible differential model catalog.
 */
import { describe, expect, it } from 'vitest';
import { DIFF_PRESETS, LSD_MODEL_IDS, findDiffPreset, modelIdFromType } from '../src/config/diff-presets';
import { applyDiffModelTo } from '../src/services/events/running-gear-events';
import type { RunningGear } from '../src/core/models';
import { t } from '../src/core/i18n/language';

describe('diff-presets catalog', () => {
	it('ships open, generic LSDs, aftermarket clutch models, torsen ATBs and spool', () => {
		const ids = DIFF_PRESETS.map((p) => p.id);
		expect(ids).toEqual(['open', 'lsd_1way', 'lsd_1_5way', 'lsd_2way', 'lsd_custom', 'torsen', 'spool', 'lsd_osgiken', 'lsd_cusco', 'lsd_kaaz', 'torsen_wavetrac', 'torsen_quaife']);
	});
	it('keeps lock percentages inside [0, 1] and ordered by aggressiveness', () => {
		for (const p of DIFF_PRESETS) {
			expect(p.accLock).toBeGreaterThanOrEqual(0);
			expect(p.accLock).toBeLessThanOrEqual(1);
			expect(p.coastLock).toBeGreaterThanOrEqual(0);
			expect(p.coastLock).toBeLessThanOrEqual(1);
		}
		const one = findDiffPreset('lsd_1way');
		const oneFive = findDiffPreset('lsd_1_5way');
		const two = findDiffPreset('lsd_2way');
		expect(one?.type).toBe('clutch_lsd');
		expect(oneFive?.coastLock).toBeGreaterThan(one?.coastLock ?? -1);
		expect(two?.coastLock).toBeGreaterThan(oneFive?.coastLock ?? -1);
		expect(two?.accLock).toBeGreaterThanOrEqual(oneFive?.accLock ?? 2);
	});
	it('resolves labels via i18n without falling back to raw keys', () => {
		for (const p of DIFF_PRESETS) {
			const label = t(p.labelKey);
			expect(label).not.toBe(p.labelKey);
			expect(label.length).toBeGreaterThan(0);
		}
	});
	it('maps legacy types to safe model ids', () => {
		expect(modelIdFromType('open')).toBe('open');
		expect(modelIdFromType('torsen')).toBe('torsen');
		expect(modelIdFromType('spool')).toBe('spool');
		expect(modelIdFromType('clutch_lsd')).toBe('lsd_custom');
	});
	it('returns null for unknown ids', () => {
		expect(findDiffPreset('nope')).toBeNull();
	});
	it('flags only clutch-lsd rows as showing lock inputs', () => {
		expect(LSD_MODEL_IDS.has('lsd_1_5way')).toBe(true);
		expect(LSD_MODEL_IDS.has('lsd_osgiken')).toBe(true);
		expect(LSD_MODEL_IDS.has('lsd_cusco')).toBe(true);
		expect(LSD_MODEL_IDS.has('lsd_kaaz')).toBe(true);
		expect(LSD_MODEL_IDS.has('torsen_wavetrac')).toBe(false);
		expect(LSD_MODEL_IDS.has('open')).toBe(false);
		expect(LSD_MODEL_IDS.has('torsen')).toBe(false);
		expect(LSD_MODEL_IDS.has('spool')).toBe(false);
	});
	it('applies aftermarket locks through the shared applier', () => {
		const rg = { differentialBias: 0, differentialCoastBias: 0 } as unknown as RunningGear;
		applyDiffModelTo(rg, 'lsd_osgiken');
		expect(rg.differentialType).toBe('clutch_lsd');
		expect(rg.differentialBias).toBeCloseTo(0.55, 5);
		expect(rg.differentialCoastBias).toBeCloseTo(0.3, 5);
		applyDiffModelTo(rg, 'torsen_wavetrac');
		expect(rg.differentialType).toBe('torsen');
		expect(rg.differentialCoastBias).toBe(0);
	});
});
