/**
 * @file running-gear-fields.ts
 * @brief Shared running-gear numeric descriptors and geometry-field builders.
 */
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';
import type { RunningGear } from '../core/models';

export interface NumField {
	suffix: string;
	labelKey: DictKey;
	min: number;
	max: number;
	scale: number;
	step: string;
	unit: string;
	external?: boolean;
	get: (rg: RunningGear) => number;
	set: (rg: RunningGear, v: number) => void;
}

/** Numeric rows in primary-card order; external rows retain their static owner. */
export const NUM_FIELDS: NumField[] = [
	{ suffix: 'weight', labelKey: 'setupctl.weightTitle', min: 40, max: 70, scale: 0.01, step: '0.5', unit: '%', external: true, get: (rg) => rg.frontWeightDistribution * 100, set: (rg, v) => { rg.frontWeightDistribution = v; } },
	{ suffix: 'cog', labelKey: 'running.cog', min: 300, max: 700, scale: 1, step: '5', unit: 'mm', get: (rg) => rg.centerOfGravityHeightMm, set: (rg, v) => { rg.centerOfGravityHeightMm = v; } },
	{ suffix: 'wheelbase', labelKey: 'running.wheelbase', min: 2200, max: 3300, scale: 1, step: '10', unit: 'mm', get: (rg) => rg.wheelbaseMm, set: (rg, v) => { rg.wheelbaseMm = v; } },
	{ suffix: 'track', labelKey: 'running.track', min: 1300, max: 1800, scale: 1, step: '5', unit: 'mm', get: (rg) => rg.trackWidthMm, set: (rg, v) => { rg.trackWidthMm = v; } },
	{ suffix: 'spring-f', labelKey: 'running.springF', min: 10, max: 120, scale: 1, step: '1', unit: 'N/mm', get: (rg) => rg.springRateFrontNmm, set: (rg, v) => { rg.springRateFrontNmm = v; } },
	{ suffix: 'spring-r', labelKey: 'running.springR', min: 10, max: 120, scale: 1, step: '1', unit: 'N/mm', get: (rg) => rg.springRateRearNmm, set: (rg, v) => { rg.springRateRearNmm = v; } },
	{ suffix: 'lift', labelKey: 'running.lift', min: 0, max: 4, scale: 1, step: '0.05', unit: 'CL', get: (rg) => rg.liftCoefficient ?? 0.15, set: (rg, v) => { rg.liftCoefficient = v; } },
	{ suffix: 'lift-area', labelKey: 'running.liftArea', min: 0.5, max: 5, scale: 1, step: '0.05', unit: 'm²', get: (rg) => rg.liftReferenceAreaM2 ?? 2, set: (rg, v) => { rg.liftReferenceAreaM2 = v; } },
	{ suffix: 'lift-share', labelKey: 'running.liftShare', min: 20, max: 80, scale: 0.01, step: '1', unit: '%', get: (rg) => Math.round((rg.downforceFrontShare ?? rg.frontWeightDistribution) * 100), set: (rg, v) => { rg.downforceFrontShare = v; } },
];

/**
 * @brief Build a numeric geometry row from its shared descriptor.
 * @param prefix Running-gear prefix.
 * @param field Numeric descriptor.
 * @return Associated label, input and unit row.
 */
export const buildNumRow = (prefix: string, field: NumField): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.htmlFor = `${prefix}-${field.suffix}`;
	label.dataset.i18n = field.labelKey;
	label.textContent = t(field.labelKey);
	const wrap = document.createElement('div');
	wrap.className = 'relative';
	const input = document.createElement('input');
	input.type = 'number';
	input.inputMode = 'decimal';
	input.step = field.step;
	input.min = String(field.min);
	input.max = String(field.max);
	input.id = `${prefix}-${field.suffix}`;
	input.className = 'w-full field-input field-input--md field-input--recessed';
	const unit = document.createElement('span');
	unit.className = 'field-unit';
	unit.textContent = field.unit;
	wrap.append(input, unit);
	row.append(label, wrap);
	return row;
};

/**
 * @brief Build the lateral-g slider in the same slot on both setups.
 * @param prefix Running-gear prefix.
 * @return Slider row.
 */
export const buildLatgRow = (prefix: string): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.htmlFor = `${prefix}-latg`;
	label.dataset.i18n = 'running.latg';
	label.textContent = t('running.latg');
	const wrap = document.createElement('div');
	wrap.className = 'flex items-center gap-2';
	const input = document.createElement('input');
	input.type = 'range';
	input.min = '0';
	input.max = '1.3';
	input.step = '0.05';
	input.id = `${prefix}-latg`;
	input.className = 'flex-1';
	const val = document.createElement('span');
	val.id = `${prefix}-latg-val`;
	val.className = 'whitespace-nowrap font-mono fs-base text-text-output tabular-nums';
	wrap.append(input, val);
	row.append(label, wrap);
	return row;
};
