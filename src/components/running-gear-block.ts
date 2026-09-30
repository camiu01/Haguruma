/**
 * @file running-gear-block.ts
 * @brief Shared running-gear input block builder, binder and sync.
 *
 * Primary and secondary setups render the same rows (layout, differential,
 * tire compound, locks, geometry, springs, downforce, lateral G) from this
 * module with an id prefix (`rg` or `crg`); state access is injected so one
 * code path drives both physics slots.
 */
import { DIFF_PRESETS, LSD_MODEL_IDS, findDiffPreset, modelIdFromType } from '../config/diff-presets';
import { DEFAULT_TIRE_COMPOUND_ID, TIRE_COMPOUNDS, findTireCompound } from '../config/tire-compounds';
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';
import type { DrivetrainLayout, RunningGear } from '../core/models';

/** Numeric field descriptor driving one labeled input row. */
interface NumField {
	/** Id suffix appended to the block prefix. */
	suffix: string;
	/** i18n label key. */
	labelKey: DictKey;
	/** Minimum accepted value. */
	min: number;
	/** Maximum accepted value. */
	max: number;
	/** State multiplier applied to the raw input (percent inputs use 0.01). */
	scale: number;
	/** Input step attribute. */
	step: string;
	/** Unit adornment shown at the row edge. */
	unit: string;
	/** True when the input lives in static markup instead of the injected grid. */
	external?: boolean;
	/** State reader with legacy default. */
	get: (rg: RunningGear) => number;
	/** State writer receiving the scaled value. */
	set: (rg: RunningGear, v: number) => void;
}

/** Suffixes owned by the accordions' static markup (grid skips their rows). */
const EXTERNAL_SUFFIXES = new Set<string>(['tire', 'weight']);

/** Field owning the lateral-G slider slot, matching the primary card order. */
const LATG_AFTER = 'spring-r';

/** Numeric rows in primary-card order. */
const NUM_FIELDS: NumField[] = [
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
 * @brief Clamp a finite number into [min, max].
 * @param v Raw value.
 * @param min Lower bound.
 * @param max Upper bound.
 * @return Clamped value.
 */
const clamp = (v: number, min: number, max: number): number => {
	if (!Number.isFinite(v)) {
		return min;
	}
	return Math.min(max, Math.max(min, v));
};

/**
 * @brief Build one labeled select row.
 * @param prefix Block id prefix.
 * @param suffix Id suffix (layout, diff or tire).
 * @param labelKey i18n key for the label.
 * @return Row element (options appended by callers).
 */
const buildSelectRow = (prefix: string, suffix: string, labelKey: DictKey): { row: HTMLElement; select: HTMLSelectElement } => {
	const row = document.createElement('div');
	row.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', `${prefix}-${suffix}`);
	label.setAttribute('data-i18n', labelKey);
	label.textContent = t(labelKey);
	const select = document.createElement('select');
	select.id = `${prefix}-${suffix}`;
	select.className = 'w-full field-input field-input--md field-input--recessed';
	row.append(label, select);
	return { row, select };
};

/**
 * @brief Build one labeled numeric input row.
 * @param prefix Block id prefix.
 * @param field Field descriptor.
 * @return Row element.
 */
const buildNumRow = (prefix: string, field: NumField): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', `${prefix}-${field.suffix}`);
	label.setAttribute('data-i18n', field.labelKey);
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
 * @brief Build the lateral-G slider row.
 * @param prefix Block id prefix.
 * @return Row element.
 */
const buildLatgRow = (prefix: string): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', `${prefix}-latg`);
	label.setAttribute('data-i18n', 'running.latg');
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
	val.textContent = '0.60 G';
	wrap.append(input, val);
	row.append(label, wrap);
	return row;
};

/**
 * @brief Build the accel/coast lock input pair with visibility wraps.
 * @param prefix Block id prefix.
 * @return Fragment holding both lock rows.
 */
const buildLockRows = (prefix: string): DocumentFragment => {
	const frag = document.createDocumentFragment();
	const defs: { suffix: string; labelKey: DictKey }[] = [
		{ suffix: 'bias', labelKey: 'running.bias' },
		{ suffix: 'coast', labelKey: 'running.coast' },
	];
	for (const def of defs) {
		const row = document.createElement('div');
		row.className = 'field-half';
		row.id = `${prefix}-${def.suffix}-wrap`;
		const label = document.createElement('label');
		label.className = 'field-label';
		label.setAttribute('for', `${prefix}-${def.suffix}`);
		label.setAttribute('data-i18n', def.labelKey);
		label.textContent = t(def.labelKey);
		const wrap = document.createElement('div');
		wrap.className = 'relative';
		const input = document.createElement('input');
		input.type = 'number';
		input.inputMode = 'decimal';
		input.step = '5';
		input.min = '0';
		input.max = '100';
		input.id = `${prefix}-${def.suffix}`;
		input.className = 'w-full field-input field-input--md field-input--recessed';
		const unit = document.createElement('span');
		unit.className = 'field-unit';
		unit.textContent = '%';
		wrap.append(input, unit);
		row.append(label, wrap);
		frag.appendChild(row);
	}
	return frag;
};

/**
 * @brief Build the full running-gear input grid for one prefix.
 * @brief Row order, classes and labels mirror the primary card.
 * @param prefix Block id prefix (`rg` or `crg`).
 * @return Grid fragment ready to mount.
 */
export const buildRunningGearBlock = (prefix: string): DocumentFragment => {
	const frag = document.createDocumentFragment();
	const layout = buildSelectRow(prefix, 'layout', 'running.layout');
	for (const v of ['FWD', 'RWD', 'AWD']) {
		const option = document.createElement('option');
		option.value = v;
		option.textContent = v;
		layout.select.appendChild(option);
	}
	frag.appendChild(layout.row);
	const diff = buildSelectRow(prefix, 'diff', 'running.diff');
	for (const p of DIFF_PRESETS) {
		const option = document.createElement('option');
		option.value = p.id;
		option.setAttribute('data-i18n', p.labelKey);
		option.textContent = t(p.labelKey);
		diff.select.appendChild(option);
	}
	frag.appendChild(diff.row);
	const tire = EXTERNAL_SUFFIXES.has('tire') ? null : buildSelectRow(prefix, 'tire', 'running.tire');
	if (tire) {
		for (const c of TIRE_COMPOUNDS) {
			const option = document.createElement('option');
			option.value = c.id;
			option.setAttribute('data-i18n', c.labelKey);
			option.textContent = t(c.labelKey);
			tire.select.appendChild(option);
		}
		frag.appendChild(tire.row);
	}
	frag.appendChild(buildLockRows(prefix));
	for (const field of NUM_FIELDS) {
		if (field.external) {
			continue;
		}
		frag.appendChild(buildNumRow(prefix, field));
		if (field.suffix === LATG_AFTER) {
			frag.appendChild(buildLatgRow(prefix));
		}
	}
	return frag;
};

/**
 * @brief Apply a catalog differential model id to a running-gear setup.
 * @brief Shared by the primary and the comparison running-gear selects.
 * @param rg Target running-gear setup.
 * @param modelId Catalog id from the select.
 * @return void
 */
export const applyDiffModelTo = (rg: RunningGear, modelId: string): void => {
	const preset = findDiffPreset(modelId);
	if (!preset) {
		return;
	}
	rg.differentialType = preset.type;
	rg.differentialModelId = preset.id;
	if (preset.id === 'lsd_custom') {
		rg.differentialCoastBias = rg.differentialCoastBias ?? 0;
		return;
	}
	if (LSD_MODEL_IDS.has(preset.id)) {
		rg.differentialBias = preset.accLock;
		rg.differentialCoastBias = preset.coastLock;
		return;
	}
	if (preset.type === 'spool') {
		rg.differentialBias = 1;
		rg.differentialCoastBias = 1;
		return;
	}
	rg.differentialCoastBias = 0;
};

/**
 * @brief Typed handle for one input inside a block.
 * @param prefix Block id prefix.
 * @param suffix Id suffix.
 * @return Element or null when the block is absent.
 */
const byId = <T extends HTMLElement>(prefix: string, suffix: string): T | null => {
	return document.getElementById(`${prefix}-${suffix}`) as T | null;
};

/**
 * @brief Show lock inputs only for clutch-LSD catalog models.
 * @param prefix Block id prefix.
 * @param modelId Active catalog id.
 * @return void
 */
export const setLockVisibility = (prefix: string, modelId: string): void => {
	const active = LSD_MODEL_IDS.has(modelId);
	for (const suffix of ['bias-wrap', 'coast-wrap']) {
		for (const wrap of document.querySelectorAll(`#${prefix}-${suffix}`)) {
			wrap.classList.toggle('opacity-40', !active);
			wrap.classList.toggle('pointer-events-none', !active);
		}
	}
};

/**
 * @brief Write lock percentages into a block.
 * @param prefix Block id prefix.
 * @param rg Source setup.
 * @return void
 */
const syncLocks = (prefix: string, rg: RunningGear): void => {
	const bias = byId<HTMLInputElement>(prefix, 'bias');
	const coast = byId<HTMLInputElement>(prefix, 'coast');
	if (bias) {
		bias.value = String(Math.round(rg.differentialBias * 100));
	}
	if (coast) {
		coast.value = String(Math.round((rg.differentialCoastBias ?? 0) * 100));
	}
};

/** Extra hooks for the primary block (efficiency follows layout). */
export interface BlockHooks {
	/** Called after a layout change with the new layout. */
	onLayout?: (layout: DrivetrainLayout) => void;
}

/**
 * @brief Wire every input of one running-gear block to a setup object.
 * @param prefix Block id prefix.
 * @param getRg Live setup accessor (primary or secondary).
 * @param render Full refresh callback.
 * @param hooks Primary-only extras.
 * @return void
 */
export const bindRunningGearBlock = (
	prefix: string,
	getRg: () => RunningGear,
	render: () => void,
	hooks: BlockHooks = {},
): void => {
	const layout = byId<HTMLSelectElement>(prefix, 'layout');
	layout?.addEventListener('change', (e) => {
		const v = (e.target as HTMLSelectElement).value;
		if (v === 'FWD' || v === 'RWD' || v === 'AWD') {
			getRg().drivetrainLayout = v;
			hooks.onLayout?.(v);
			render();
		}
	});
	const diff = byId<HTMLSelectElement>(prefix, 'diff');
	diff?.addEventListener('change', (e) => {
		const v = (e.target as HTMLSelectElement).value;
		if (!findDiffPreset(v)) {
			return;
		}
		const rg = getRg();
		applyDiffModelTo(rg, v);
		setLockVisibility(prefix, v);
		syncLocks(prefix, rg);
		render();
	});
	const tire = byId<HTMLSelectElement>(prefix, 'tire');
	tire?.addEventListener('change', (e) => {
		const v = (e.target as HTMLSelectElement).value;
		if (findTireCompound(v)) {
			getRg().tireCompoundId = v;
			render();
		}
	});
	const bias = byId<HTMLInputElement>(prefix, 'bias');
	bias?.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (!Number.isFinite(v)) {
			return;
		}
		const rg = getRg();
		rg.differentialBias = clamp(v, 0, 100) / 100;
		rg.differentialModelId = rg.differentialModelId || 'lsd_custom';
		render();
	});
	const coast = byId<HTMLInputElement>(prefix, 'coast');
	coast?.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (!Number.isFinite(v)) {
			return;
		}
		getRg().differentialCoastBias = clamp(v, 0, 100) / 100;
		render();
	});
	for (const field of NUM_FIELDS) {
		const input = byId<HTMLInputElement>(prefix, field.suffix);
		input?.addEventListener('input', (e) => {
			const v = parseFloat((e.target as HTMLInputElement).value);
			if (!Number.isFinite(v)) {
				return;
			}
			field.set(getRg(), clamp(v, field.min, field.max) * field.scale);
			render();
		});
	}
	const latg = byId<HTMLInputElement>(prefix, 'latg');
	latg?.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (!Number.isFinite(v)) {
			return;
		}
		const rg = getRg();
		rg.lateralG = clamp(v, 0, 1.3);
		const val = byId<HTMLElement>(prefix, 'latg-val');
		if (val) {
			val.textContent = `${rg.lateralG.toFixed(2)} G`;
		}
		render();
	});
};

/**
 * @brief Sync one block's controls from a setup object.
 * @brief Normalizes catalog ids in state like the legacy sync did.
 * @param prefix Block id prefix.
 * @param rg Source setup.
 * @return void
 */
export const syncRunningGearBlock = (prefix: string, rg: RunningGear): void => {
	const layout = byId<HTMLSelectElement>(prefix, 'layout');
	if (layout) {
		layout.value = rg.drivetrainLayout;
	}
	const diff = byId<HTMLSelectElement>(prefix, 'diff');
	if (diff) {
		diff.value = rg.differentialModelId ?? modelIdFromType(rg.differentialType);
		if (!findDiffPreset(diff.value)) {
			diff.value = modelIdFromType(rg.differentialType);
		}
		rg.differentialModelId = diff.value;
	}
	const tire = byId<HTMLSelectElement>(prefix, 'tire');
	if (tire) {
		tire.value = rg.tireCompoundId ?? DEFAULT_TIRE_COMPOUND_ID;
		if (!findTireCompound(tire.value)) {
			tire.value = DEFAULT_TIRE_COMPOUND_ID;
		}
		rg.tireCompoundId = tire.value;
	}
	syncLocks(prefix, rg);
	for (const field of NUM_FIELDS) {
		const input = byId<HTMLInputElement>(prefix, field.suffix);
		if (input) {
			input.value = String(field.get(rg));
		}
	}
	const latg = byId<HTMLInputElement>(prefix, 'latg');
	if (latg) {
		latg.value = String(rg.lateralG);
	}
	const val = byId<HTMLElement>(prefix, 'latg-val');
	if (val) {
		val.textContent = `${rg.lateralG.toFixed(2)} G`;
	}
	setLockVisibility(prefix, rg.differentialModelId ?? modelIdFromType(rg.differentialType));
};
