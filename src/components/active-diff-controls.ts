/**
 * @file active-diff-controls.ts
 * @brief Mirrored v0.7 mechanical and active differential fields.
 */
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';
import type { RunningGear } from '../core/models';

interface DiffField {
	key: keyof RunningGear;
	label: DictKey;
	default: number | boolean;
	max?: number;
	scale?: number;
}

const FIELDS: DiffField[] = [
	{ key: 'differentialPreloadNm', label: 'dynamics.preload', default: 0, max: 500, scale: 1 },
	{ key: 'awdFrontShare', label: 'dynamics.awdShare', default: 0.5, max: 100, scale: 0.01 },
	{ key: 'centerDiffLock', label: 'dynamics.centerLock', default: 0, max: 100, scale: 0.01 },
	{ key: 'torqueVectoring', label: 'dynamics.vectoring', default: 0, max: 100, scale: 0.01 },
	{ key: 'handbrakeDisengage', label: 'dynamics.handbrakeDisengage', default: true },
	{ key: 'handbrakeApplied', label: 'dynamics.handbrakeApplied', default: false },
];

/**
 * @brief Add controls to the primary's authoritative static running-gear grid.
 * @return void
 */
export const injectPrimaryActiveDiffControls = (): void => {
	const row = document.getElementById('rg-coast-wrap');
	row?.after(buildActiveDiffControls('rg'));
};

/**
 * @brief Create mirrored numeric fields and handbrake switches.
 * @param prefix Primary or comparison running-gear prefix.
 * @return Fragment for the running-gear grid.
 */
export const buildActiveDiffControls = (prefix: string): DocumentFragment => {
	const fragment = document.createDocumentFragment();
	for (const field of FIELDS) {
		const row = document.createElement('div');
		row.className = 'field-half';
		const id = `${prefix}-${field.key}`;
		const label = document.createElement('label');
		label.htmlFor = id;
		label.className = 'field-label';
		label.dataset.i18n = field.label;
		label.textContent = t(field.label);
		const input = document.createElement('input');
		input.id = id;
		input.type = typeof field.default === 'boolean' ? 'checkbox' : 'number';
		input.className = input.type === 'checkbox' ? '' : 'field-input field-input--md field-input--recessed';
		input.min = '0';
		input.max = String(field.max ?? 1);
		input.step = field.scale === 1 ? '5' : '1';
		row.append(label, input);
		fragment.append(row);
	}
	return fragment;
};

/**
 * @brief Bind both setups using live accessors so preset loads replace objects safely.
 * @param prefix Running-gear prefix.
 * @param getGear Live setup accessor.
 * @param render Full refresh.
 * @return void
 */
export const bindActiveDiffControls = (prefix: string, getGear: () => RunningGear, render: () => void): void => {
	for (const field of FIELDS) {
		const input = document.getElementById(`${prefix}-${field.key}`) as HTMLInputElement | null;
		input?.addEventListener('change', () => {
			if (typeof field.default === 'boolean') {
				(getGear()[field.key] as boolean) = input.checked;
			} else {
				const number = Number(input.value);
				if (!input.value.trim() || !Number.isFinite(number) || number < 0 || number > field.max!) return;
				(getGear()[field.key] as number) = number * field.scale!;
			}
			render();
		});
	}
};

/**
 * @brief Reflect optional controls and disable fields irrelevant to the chosen layout/model.
 * @param prefix Running-gear prefix.
 * @param gear Current running gear.
 * @return void
 */
export const syncActiveDiffControls = (prefix: string, gear: RunningGear): void => {
	for (const field of FIELDS) {
		const input = document.getElementById(`${prefix}-${field.key}`) as HTMLInputElement | null;
		if (!input) continue;
		const value = gear[field.key] ?? field.default;
		if (typeof field.default === 'boolean') input.checked = value as boolean;
		else if (input !== document.activeElement) input.value = String((value as number) / field.scale!);
		const awd = ['awdFrontShare', 'centerDiffLock', 'handbrakeDisengage', 'handbrakeApplied'].includes(field.key);
		input.disabled = awd ? gear.drivetrainLayout !== 'AWD'
			: field.key === 'differentialPreloadNm' && gear.differentialType !== 'clutch_lsd';
	}
};
