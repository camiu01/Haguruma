/**
 * @file setup-controls-markup.ts
 * @brief DOM builders and pill-grid renderer for the prefix-parameterized setup blocks.
 */
import { t } from '../core/i18n/language';
import type { TireSpec } from '../core/models';
import type { SetupPrefix } from './setup-aero';

/** Tire dimension a pill row drives. */
type TireDim = 'width' | 'aspect' | 'rim';

/** Dictionary keys owned by the base block builders. */
type SetupBaseKey =
	| 'setupctl.tireTitle'
	| 'setupctl.width'
	| 'setupctl.aspect'
	| 'setupctl.rim'
	| 'setupctl.fd'
	| 'setupctl.fdHint'
	| 'setupctl.limiter'
	| 'setupctl.limiterHint'
	| 'primary.tireError';

/** Final-drive increment applied by the stepper buttons. */
const FD_STEP = 0.05;

/** Rev-limiter increment applied by the stepper buttons. */
const RPM_STEP = 100;

/** Shared chip classes of the geometry readout pill. */
const PILL_CHIP = 'font-badge-mono text-badge-mono px-1.5 py-0.5 rounded-DEFAULT bg-surface-recessed';

/** Classes of the geometry pill while the tire spec is valid. */
export const PILL_VALID = `${PILL_CHIP} text-primary-fixed-dim`;

/** Classes of the geometry pill while the tire spec is invalid. */
export const PILL_INVALID = `${PILL_CHIP} text-neon-red`;

/** Classes of the validity dot while the tire spec is valid. */
export const DOT_VALID = 'w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0';

/** Classes of the validity dot while the tire spec is invalid. */
export const DOT_INVALID = 'w-1.5 h-1.5 rounded-full bg-neon-red flex-shrink-0';

/** Per-prefix ids of the base block value nodes. */
export const BASE_IDS: Record<SetupPrefix, { geometryPill: string; tireDot: string; fd: string; rev: string }> = {
	primary: { geometryPill: 'setupctl-geometry-pill', tireDot: 'tire-valid-indicator', fd: 'setupctl-fd', rev: 'setupctl-rev' },
	compare: { geometryPill: 'comp-setupctl-geometry-pill', tireDot: 'comp-tire-valid-indicator', fd: 'comp-setupctl-fd', rev: 'comp-setupctl-rev' },
};

/**
 * @brief Build the whole tire geometry section of one setup block.
 * @param prefix Setup slot owning the section.
 * @return Section element with head row, optional error line and pill rows.
 */
export const buildTireSection = (prefix: SetupPrefix): HTMLElement => {
	const section = document.createElement('div');
	section.className = 'flex flex-col gap-1.5';
	section.appendChild(buildTireHead(prefix));
	if (prefix === 'primary') {
		const error = buildI18nText('font-mono text-[0.6875rem] text-neon-red hidden', 'primary.tireError');
		error.id = 'tire-error';
		section.appendChild(error);
	}
	const grid = document.createElement('div');
	grid.className = 'segmented-input-group';
	grid.append(
		buildTireInput(prefix, 'width', 'W', 100, 400),
		buildTireInput(prefix, 'aspect', '%', 20, 90),
		buildTireInput(prefix, 'rim', 'R', 10, 30),
	);
	section.appendChild(grid);
	return section;
};

/**
 * @brief Build the head row with the validity dot and the geometry pill.
 * @param prefix Setup slot owning the head row.
 * @return Head element with the dot, title and readout pill.
 */
const buildTireHead = (prefix: SetupPrefix): HTMLElement => {
	const head = document.createElement('div');
	head.className = 'flex items-center justify-between gap-2';
	const idGroup = document.createElement('div');
	idGroup.className = 'font-field-label text-field-label text-on-surface-variant flex items-center gap-1';
	const dot = document.createElement('span');
	dot.id = BASE_IDS[prefix].tireDot;
	dot.setAttribute('role', 'img');
	dot.className = 'w-1.5 h-1.5 rounded-full bg-secondary';
	dot.title = t('setupctl.geometryOk');
	idGroup.append(buildI18nText('', 'setupctl.tireTitle'), dot);
	const pill = document.createElement('span');
	pill.id = BASE_IDS[prefix].geometryPill;
	pill.setAttribute('role', 'status');
	pill.className = `${PILL_CHIP} text-primary-fixed-dim`;
	pill.textContent = '—';
	head.append(idGroup, pill);
	return head;
};

/**
 * @brief Build one editable segmented tire field.
 * @param prefix Setup slot owning the field.
 * @param dim Tire dimension edited by the field.
 * @param unit Short unit annotation.
 * @param min Lowest accepted value.
 * @param max Highest accepted value.
 * @return Field wrapper containing the numeric input and unit.
 */
const buildTireInput = (
	prefix: SetupPrefix,
	dim: TireDim,
	unit: string,
	min: number,
	max: number,
): HTMLElement => {
	const field = document.createElement('div');
	field.className = 'relative bg-surface-recessed rounded-DEFAULT border border-border-hairline px-space-sm py-1.5 flex items-center justify-between';
	const input = document.createElement('input');
	input.type = 'number';
	input.id = prefix === 'primary' ? `tire-${dim}` : `comp-tire-${dim}`;
	input.min = String(min);
	input.max = String(max);
	input.step = '1';
	input.inputMode = 'numeric';
	input.className = 'w-full bg-transparent font-input-mono text-input-mono text-text-output focus:outline-none';
	input.dataset.tireInput = dim;
	const labelKey = `setupctl.${dim}` as 'setupctl.width' | 'setupctl.aspect' | 'setupctl.rim';
	input.dataset.i18nTip = labelKey;
	input.setAttribute('aria-label', t(labelKey));
	const suffix = document.createElement('span');
	suffix.className = 'font-unit-annotation text-unit-annotation text-text-muted';
	suffix.textContent = unit;
	field.append(input, suffix);
	return field;
};

/**
 * Refresh the three segmented tire fields of one setup block.
 * @param prefix Setup slot owning the grids.
 * @param tire Parsed tire of the slot, null when the spec is invalid.
 * @return void
 */
export const renderTirePills = (prefix: SetupPrefix, tire: TireSpec | null): void => {
	setTireInput(prefix, 'width', tire?.width);
	setTireInput(prefix, 'aspect', tire?.aspect);
	setTireInput(prefix, 'rim', tire?.rimInch);
};

/**
 * @brief Synchronize one segmented tire input.
 * @param prefix Setup slot owning the field.
 * @param dim Tire dimension represented by the field.
 * @param value Current value, omitted when the tire is invalid.
 * @return void
 */
const setTireInput = (prefix: SetupPrefix, dim: TireDim, value: number | undefined): void => {
	const input = document.querySelector<HTMLInputElement>(`[data-setup-prefix='${prefix}'] [data-tire-input='${dim}']`);
	if (input && document.activeElement !== input) {
		input.value = value === undefined ? '' : String(value);
	}
};

/**
 * @brief Build the final-drive and rev-limiter tactile stepper row.
 * @param prefix Setup slot owning the steppers.
 * @return Row element holding both stepper groups.
 */
export const buildStepperRow = (prefix: SetupPrefix): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'grid grid-cols-1 sm:grid-cols-2 gap-2';
	row.append(
		buildStepper(prefix, 'fd', 'setupctl.fd', 'setupctl.fdHint', ':1'),
		buildStepper(prefix, 'rev', 'setupctl.limiter', 'setupctl.limiterHint', 'RPM'),
	);
	return row;
};

/**
 * @brief Build one tactile stepper group with a joined 44px strip.
 * @param prefix Setup slot owning the stepper.
 * @param kind Which state value the buttons drive.
 * @param labelKey Dictionary key for the group title.
 * @param hintKey Dictionary key for the group hint.
 * @param unit Unit suffix rendered after the value.
 * @return Stepper group element.
 */
const buildStepper = (
	prefix: SetupPrefix,
	kind: 'fd' | 'rev',
	labelKey: 'setupctl.fd' | 'setupctl.limiter',
	hintKey: 'setupctl.fdHint' | 'setupctl.limiterHint',
	unit: string,
): HTMLElement => {
	const group = document.createElement('div');
	group.className = 'flex flex-col gap-1.5';
	const head = document.createElement('div');
	head.className = 'flex items-center justify-between gap-2';
	head.append(
		buildI18nText('text-[0.6875rem] font-medium text-text-dim', labelKey),
		buildI18nText('font-mono text-[0.625rem] uppercase text-text-muted', hintKey),
	);
	const minusLabel = kind === 'fd' ? `-${FD_STEP.toFixed(2)}` : `-${RPM_STEP}`;
	const plusLabel = kind === 'fd' ? `+${FD_STEP.toFixed(2)}` : `+${RPM_STEP}`;
	const strip = document.createElement('div');
	strip.className = 'flex items-stretch bg-surface-recessed rounded border border-border-hairline overflow-hidden min-h-[44px]';
	strip.append(
		buildStepButton(kind, '-1', `${t(labelKey)} ${minusLabel}`, labelKey),
		buildValueNode(BASE_IDS[prefix][kind], unit, labelKey),
		buildStepButton(kind, '1', `${t(labelKey)} ${plusLabel}`, labelKey),
	);
	group.append(head, strip);
	return group;
};

/**
 * @brief Build one stepper button carrying target and direction datasets.
 * @brief The visible label is the step glyph; the applied increment lives in
 * @brief the title and aria-label so assistive tech keeps the full step text.
 * @param kind Which state value the button drives.
 * @param direction Dataset direction, '-1' or '1'.
 * @param label Full step description used as tooltip and accessible name.
 * @param labelKey Dictionary key used to refresh the accessible name.
 * @return Button element with the stepper-btn class.
 */
const buildStepButton = (
	kind: 'fd' | 'rev',
	direction: '-1' | '1',
	label: string,
	labelKey: 'setupctl.fd' | 'setupctl.limiter',
): HTMLButtonElement => {
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'stepper-btn w-10 flex items-center justify-center bg-surface-subtle hover:bg-input text-text-main font-mono text-[1rem]';
	btn.dataset.stepper = kind;
	btn.dataset.direction = direction;
	btn.dataset.i18nTip = labelKey;
	btn.textContent = direction === '1' ? '+' : '-';
	btn.title = label;
	btn.setAttribute('aria-label', label);
	return btn;
};

/**
 * @brief Build the centered value node with its unit suffix.
 * @param id Element id receiving the live value.
 * @param unit Unit suffix rendered after the value.
 * @param labelKey Dictionary key used for the input accessible name.
 * @return Value node element between the two stepper buttons.
 */
const buildValueNode = (
	id: string,
	unit: string,
	labelKey: 'setupctl.fd' | 'setupctl.limiter',
): HTMLElement => {
	const wrap = document.createElement('div');
	wrap.className = 'flex-1 flex items-center justify-center gap-1 font-mono';
	const value = document.createElement('input');
	value.type = 'number';
	value.id = id;
	value.inputMode = 'decimal';
	value.step = id.includes('-fd') ? String(FD_STEP) : String(RPM_STEP);
	value.min = id.includes('-fd') ? '1' : '3000';
	value.max = id.includes('-fd') ? '10' : '12000';
	value.className = 'w-full bg-transparent text-center text-[0.8125rem] font-bold text-text-output tabular-nums outline-none';
	value.dataset.setupInput = id.includes('-fd') ? 'fd' : 'rev';
	value.dataset.i18nTip = labelKey;
	value.setAttribute('aria-label', t(labelKey));
	const suffix = document.createElement('span');
	suffix.className = 'mr-2 font-mono text-[0.625rem] text-text-muted';
	suffix.textContent = unit;
	wrap.append(value, suffix);
	return wrap;
};

/**
 * @brief Build a translated static text node tagged for applyI18n.
 * @param className Tailwind class list applied to the node.
 * @param key Dictionary key used for the text content.
 * @return Span element carrying the translated text.
 */
const buildI18nText = (className: string, key: SetupBaseKey): HTMLElement => {
	const el = document.createElement('span');
	el.className = className;
	el.setAttribute('data-i18n', key);
	el.textContent = t(key);
	return el;
};
