/**
 * @file spec-wizard-tool.ts
 * @brief Shell injection for the spec-sheet quick-add wizard.
 * @brief Builds a new My Cars preset from a few datasheet numbers (power,
 * @brief mass, tire, gears) with strict range validation, then hands the
 * @brief saved preset back through a bootstrap-wired callback.
 */
import { t } from '../core/i18n/language';
import { state } from '../core/state/app-state';
import { parseTire } from '../core/math/tire-math';
import { parseGearsInput, saveCustomPreset } from '../core/presets/custom-store';
import { fromDisplayPower } from '../core/units/unit-utils';
import type { GearPreset } from '../core/models';
import { buildToolShell } from './card/accordion-shell';

/** Saved callback wired by bootstrap after refs resolve. */
let savedHook: (() => void) | null = null;

/**
 * @brief Inject the spec-wizard shell into its mount point.
 * @brief Runs in bootstrap before refs resolve so ids exist on first paint.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectSpecWizardShell = (host: HTMLElement): void => {
	host.replaceChildren();
	host.appendChild(buildToolShell({
		id: 'specwizard',
		title: 'wiz.title',
		note: 'wiz.note',
		body: buildBody(),
	}));
};

/**
 * @brief Wire the post-save callback (preset list refresh).
 * @param onSaved Callback invoked after a successful save.
 * @return void
 */
export const bindSpecWizard = (onSaved: () => void): void => {
	savedHook = onSaved;
};

/**
 * @brief Build the accordion body: datasheet fields plus save row.
 * @return Body element ready to append to the section content.
 */
const buildBody = (): HTMLElement => {
	const body = document.createElement('div');
	body.className = 'flex flex-col gap-3';
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-2 gap-2';
	grid.append(
		buildField('wiz-name', 'wiz.name', 'text', 'M3 E36'),
		buildField('wiz-power', 'wiz.power', 'number', '210'),
		buildField('wiz-mass', 'wiz.mass', 'number', '1460'),
		buildField('wiz-tire', 'wiz.tire', 'text', '225/45R17'),
		buildField('wiz-gears', 'wiz.gears', 'text', '4.23, 2.52, 1.66, 1.22, 1.00'),
		buildField('wiz-fd', 'wiz.fd', 'number', '3.15'),
	);
	body.append(grid, buildRedlineRow(), buildSaveRow());
	const status = document.createElement('div');
	status.id = 'wiz-status';
	status.className = 'font-mono fs-base';
	body.appendChild(status);
	return body;
};

/**
 * @brief Build one labelled wizard field.
 * @param id Element id.
 * @param labelKey i18n key for the label.
 * @param type Input type.
 * @param value Default value.
 * @return Column element holding label and input.
 */
const buildField = (
	id: string,
	labelKey: 'wiz.name' | 'wiz.power' | 'wiz.mass' | 'wiz.tire' | 'wiz.gears' | 'wiz.fd',
	type: string,
	value: string,
): HTMLElement => {
	const col = document.createElement('div');
	col.className = 'flex flex-col gap-1';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', id);
	label.setAttribute('data-i18n', labelKey);
	label.textContent = t(labelKey);
	const input = document.createElement('input');
	input.type = type;
	input.id = id;
	input.value = value;
	input.autocomplete = 'off';
	input.spellcheck = false;
	input.className = 'w-full field-input field-input--md font-semibold';
	col.append(label, input);
	return col;
};

/**
 * @brief Build the redline plus save-button row.
 * @return Row element.
 */
const buildRedlineRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', 'wiz-redline');
	label.setAttribute('data-i18n', 'wiz.redline');
	label.textContent = t('wiz.redline');
	const input = document.createElement('input');
	input.type = 'number';
	input.id = 'wiz-redline';
	input.value = '7000';
	input.min = '1000';
	input.step = '100';
	input.inputMode = 'numeric';
	input.className = 'w-full field-input field-input--md font-semibold';
	row.append(label, input);
	return row;
};

/**
 * @brief Build the save button.
 * @return Row element.
 */
const buildSaveRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center gap-2';
	const save = document.createElement('button');
	save.type = 'button';
	save.className = 'btn btn--sm btn--solid';
	save.setAttribute('data-i18n', 'wiz.save');
	save.textContent = t('wiz.save');
	save.addEventListener('click', saveWizardCar);
	row.appendChild(save);
	return row;
};

/**
 * @brief Read one field value trimmed.
 * @param id Element id.
 * @return Field text, empty when missing.
 */
const field = (id: string): string => {
	const el = document.getElementById(id) as HTMLInputElement | null;
	return el ? el.value.trim() : '';
};

/**
 * @brief Mark one field valid or invalid.
 * @param id Element id.
 * @param valid Validation outcome.
 * @return Validation outcome for chaining.
 */
const mark = (id: string, valid: boolean): boolean => {
	const el = document.getElementById(id) as HTMLInputElement | null;
	el?.classList.toggle('border-neon-red', !valid);
	return valid;
};

/**
 * @brief Validate the wizard fields and build the preset.
 * @return Preset with its display name, or null with fields marked.
 */
const readWizard = (): { name: string; preset: GearPreset } | null => {
	const name = field('wiz-name');
	const power = parseFloat(field('wiz-power'));
	const mass = parseFloat(field('wiz-mass'));
	const tire = parseTire(field('wiz-tire'));
	const gears = parseGearsInput(field('wiz-gears'));
	const fd = parseFloat(field('wiz-fd'));
	const redline = parseFloat(field('wiz-redline'));
	const decreasing = gears !== null && gears.every((ratio, idx) => idx === 0 || ratio < gears[idx - 1]);
	const ok =
		mark('wiz-name', name.length > 0) &&
		mark('wiz-power', power > 0) &&
		mark('wiz-mass', mass > 0) &&
		mark('wiz-tire', tire !== null) &&
		mark('wiz-gears', gears !== null && gears.length >= 2 && decreasing) &&
		mark('wiz-fd', fd > 0) &&
		mark('wiz-redline', redline >= 1000);
	if (!ok || !gears) {
		return null;
	}
	return {
		name,
		preset: {
			tire: field('wiz-tire'),
			fd,
			redline: Math.round(redline),
			gears,
			massKg: mass,
			powerKw: fromDisplayPower(power, state.powerUnit),
		},
	};
};

/**
 * @brief Validate, save to My Cars and notify bootstrap.
 * @return void
 */
const saveWizardCar = (): void => {
	const status = document.getElementById('wiz-status');
	const parsed = readWizard();
	if (!status) {
		return;
	}
	status.className = 'font-mono fs-base';
	if (!parsed) {
		status.classList.add('text-neon-red');
		status.setAttribute('data-i18n', 'wiz.invalid');
		status.textContent = t('wiz.invalid');
		return;
	}
	saveCustomPreset(parsed.name, parsed.preset);
	savedHook?.();
	status.classList.add('text-neon-green');
	status.setAttribute('data-i18n', 'wiz.saved');
	status.textContent = t('wiz.saved');
};
