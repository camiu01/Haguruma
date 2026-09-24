/**
 * @file diff-presets.ts
 * @brief Extensible catalog of differential models with accel/coast lock percentages.
 *
 * New models are added by appending one entry to DIFF_PRESETS; the running-gear
 * select, apply path and share layer read from this catalog only. Lock values
 * are fractions in [0, 1] where 0 = open-like and 1 = spool-like on that side.
 */
import type { DifferentialType } from '../core/models';
import type { DictKey } from '../core/i18n/dictionaries';

/**
 * One differential model selectable from the running-gear UI.
 * @brief Catalog row mapping a UI id to type and two-sided lock strengths.
 */
export interface DiffPreset {
	/** Stable option value stored in RunningGear.differentialModelId. */
	id: string;
	/** i18n label key for the dropdown option. */
	labelKey: DictKey;
	/** Physics model used by diffLimit / maxDriveForceAtSpeed. */
	type: DifferentialType;
	/** Acceleration-side lock strength in [0, 1]. */
	accLock: number;
	/** Coast/release-side lock strength in [0, 1]. */
	coastLock: number;
}

/**
 * @brief Built-in differential models (append to extend).
 * @return Ordered catalog rows for the UI select.
 */
export const DIFF_PRESETS: DiffPreset[] = [
	{ id: 'open', labelKey: 'running.diffOpen', type: 'open', accLock: 0, coastLock: 0 },
	{ id: 'lsd_1way', labelKey: 'running.diff1Way', type: 'clutch_lsd', accLock: 0.4, coastLock: 0 },
	{ id: 'lsd_1_5way', labelKey: 'running.diff15Way', type: 'clutch_lsd', accLock: 0.5, coastLock: 0.25 },
	{ id: 'lsd_2way', labelKey: 'running.diff2Way', type: 'clutch_lsd', accLock: 0.5, coastLock: 0.5 },
	{ id: 'lsd_custom', labelKey: 'running.diffCustom', type: 'clutch_lsd', accLock: 0.35, coastLock: 0.2 },
	{ id: 'torsen', labelKey: 'running.diffTorsen', type: 'torsen', accLock: 0, coastLock: 0 },
	{ id: 'spool', labelKey: 'running.diffSpool', type: 'spool', accLock: 1, coastLock: 1 },
];

/** UI ids that use the clutch-lsd physics path and show lock inputs. */
export const LSD_MODEL_IDS = new Set(['lsd_1way', 'lsd_1_5way', 'lsd_2way', 'lsd_custom']);

/**
 * @brief Look up a catalog entry by id.
 * @param id Model id from the select or state.
 * @return Matching preset, or null when unknown.
 */
export const findDiffPreset = (id: string): DiffPreset | null => {
	return DIFF_PRESETS.find((p) => p.id === id) ?? null;
};

/**
 * @brief Map a bare DifferentialType to a default catalog id.
 * @param type Legacy physics type without a model id.
 * @return Catalog id (clutch_lsd becomes custom so existing bias is kept).
 */
export const modelIdFromType = (type: DifferentialType): string => {
	if (type === 'clutch_lsd') {
		return 'lsd_custom';
	}
	return DIFF_PRESETS.some((p) => p.id === type && p.type === type) ? type : 'open';
};
