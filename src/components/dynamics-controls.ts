/**
 * @file dynamics-controls.ts
 * @brief Localized settings fields for the vehicle dynamics workbench.
 */
import { state } from '../core/state/app-state';
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';
import type { DynamicsSettings } from '../core/state/dynamics-settings';

/** Form field descriptor with typed access to the singleton. */
interface Field {
	key: keyof DynamicsSettings;
	label: DictKey;
	min?: number;
	max?: number;
	step?: string;
	options?: [string, DictKey][];
}

const FIELDS: Field[] = [
	{ key: 'limiter', label: 'dynamics.limiter', options: [['hard', 'dynamics.hard'], ['bounce', 'dynamics.bounce']] },
	{ key: 'gearbox', label: 'dynamics.gearbox', options: [['synchro', 'dynamics.synchro'], ['dog', 'dynamics.dog']] },
	{ key: 'useGearboxDefaults', label: 'dynamics.gearboxDefaults', options: [['true', 'dynamics.enabled'], ['false', 'dynamics.disabled']] },
	{ key: 'efficiencyMap', label: 'dynamics.efficiencyMap', options: [['true', 'dynamics.enabled'], ['false', 'dynamics.disabled']] },
	{ key: 'abs', label: 'dynamics.abs', options: [['true', 'dynamics.enabled'], ['false', 'dynamics.disabled']] },
	{ key: 'brakeFrontBias', label: 'dynamics.brakeBias', min: 0, max: 1, step: '0.01' },
	{ key: 'brakeDemandG', label: 'dynamics.brakeDemand', min: 0, max: 3, step: '0.05' },
	{ key: 'revMatch', label: 'dynamics.revMatch', options: [['true', 'dynamics.enabled'], ['false', 'dynamics.disabled']] },
	{ key: 'cornerRadiusM', label: 'dynamics.cornerRadius', min: 1, max: 1000, step: '1' },
	{ key: 'cornerMaxG', label: 'dynamics.cornerG', min: 0.05, max: 3, step: '0.05' },
	{ key: 'approachGear', label: 'dynamics.approachGear', min: 1, max: 8, step: '1' },
	{ key: 'sequenceSpeedKmh', label: 'dynamics.sequenceSpeed', min: 0, max: 500, step: '1' },
];

/**
 * @brief Create a field wrapper and associated localized label.
 * @param id Input id.
 * @param key Label dictionary key.
 * @return Row and label ready for its control.
 */
export const dynamicsFieldRow = (id: string, key: DictKey): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'dynamics-field';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.htmlFor = id;
	label.dataset.i18n = key;
	label.textContent = t(key);
	row.append(label);
	return row;
};

/**
 * @brief Build a typed numeric or enum settings field.
 * @param field Form descriptor.
 * @return Labeled control.
 */
const buildField = (field: Field): HTMLElement => {
	const id = `dynamics-${field.key}`;
	const row = dynamicsFieldRow(id, field.label);
	const input = field.options ? document.createElement('select') : document.createElement('input');
	input.id = id;
	input.className = 'field-input field-input--md field-input--recessed';
	if (input instanceof HTMLInputElement) {
		input.type = 'number';
		input.min = String(field.min);
		input.max = String(field.max);
		input.step = field.step ?? '1';
	}
	for (const [value, key] of field.options ?? []) {
		const option = document.createElement('option');
		option.value = value;
		option.dataset.i18n = key;
		option.textContent = t(key);
		input.append(option);
	}
	row.append(input);
	return row;
};

/**
 * @brief Add all settings, per-gear delays and sequence commands to the tool body.
 * @param body Settings grid.
 * @return void
 */
export const injectDynamicsControls = (body: HTMLElement): void => {
	for (const field of FIELDS) body.append(buildField(field));
	const shiftRow = dynamicsFieldRow('dynamics-shiftTimesS', 'dynamics.shiftTimes');
	const shifts = document.createElement('input');
	shifts.id = 'dynamics-shiftTimesS';
	shifts.className = 'field-input field-input--md field-input--recessed';
	shifts.inputMode = 'decimal';
	shiftRow.append(shifts);
	body.append(shiftRow);
	const row = dynamicsFieldRow('dynamics-sequenceCsv', 'dynamics.sequence');
	row.classList.add('dynamics-wide');
	const commands = document.createElement('textarea');
	commands.id = 'dynamics-sequenceCsv';
	commands.rows = 4;
	commands.maxLength = 4000;
	commands.className = 'field-input field-input--recessed';
	row.append(commands);
	body.append(row);
};

/**
 * @brief Validate and apply one field without converting empty input to zero.
 * @param field Form descriptor.
 * @param input Live form control.
 * @return True when a valid value was stored.
 */
const applyField = (field: Field, input: HTMLInputElement | HTMLSelectElement): boolean => {
	const value = input.value;
	if (!value.trim()) return false;
	if (field.options) {
		if (!field.options.some(([option]) => option === value)) return false;
		const current = state.dynamics[field.key];
		(state.dynamics[field.key] as unknown) = typeof current === 'boolean' ? value === 'true' : value;
		return true;
	}
	const number = Number(value);
	if (!Number.isFinite(number) || number < field.min! || number > field.max!
		|| (field.step === '1' && !Number.isInteger(number))) return false;
	(state.dynamics[field.key] as number) = number;
	return true;
};

/**
 * @brief Wire settings changes to the complete render entry point.
 * @param render Full refresh callback.
 * @return void
 */
export const bindDynamicsControls = (render: () => void): void => {
	for (const field of FIELDS) {
		const input = document.getElementById(`dynamics-${field.key}`) as HTMLInputElement | HTMLSelectElement;
		input.addEventListener('change', () => {
			const valid = applyField(field, input);
			input.setAttribute('aria-invalid', String(!valid));
			if (valid) render();
		});
	}
	const shifts = document.getElementById('dynamics-shiftTimesS') as HTMLInputElement;
	shifts.addEventListener('change', () => {
		const values = shifts.value.trim() ? shifts.value.split(',').map(Number) : [];
		const valid = values.length <= 8 && !shifts.value.split(',').some((v) => shifts.value.trim() && !v.trim())
			&& values.every((v) => Number.isFinite(v) && v >= 0 && v <= 3);
		shifts.setAttribute('aria-invalid', String(!valid));
		if (valid) {
			state.dynamics.shiftTimesS = values;
			render();
		}
	});
	const commands = document.getElementById('dynamics-sequenceCsv') as HTMLTextAreaElement;
	commands.addEventListener('change', () => {
		state.dynamics.sequenceCsv = commands.value;
		render();
	});
};

/**
 * @brief Sync settings after URL restoration while retaining unfinished focused edits.
 * @return void
 */
export const syncDynamicsControls = (): void => {
	for (const field of FIELDS) {
		const input = document.getElementById(`dynamics-${field.key}`) as HTMLInputElement | HTMLSelectElement | null;
		if (input && input !== document.activeElement) input.value = String(state.dynamics[field.key]);
	}
	const shifts = document.getElementById('dynamics-shiftTimesS') as HTMLInputElement | null;
	const commands = document.getElementById('dynamics-sequenceCsv') as HTMLTextAreaElement | null;
	if (shifts && shifts !== document.activeElement) shifts.value = state.dynamics.shiftTimesS.join(',');
	if (commands && commands !== document.activeElement) commands.value = state.dynamics.sequenceCsv;
};
