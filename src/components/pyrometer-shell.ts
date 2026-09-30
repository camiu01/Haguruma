/**
 * @file pyrometer-shell.ts
 * @brief Markup builders for the interactive 3-zone pyrometer card.
 * @brief Kept apart from pyrometer-tool.ts so the card DOM stays clear of the
 * @brief live render logic and both modules stay under the file size cap.
 */
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';

/** Element ids fixed by the v0.6.0 pyrometer card, shared by shell and reads. */
export const PYRO_ID = {
	tempInner: 'pyro-temp-inner',
	tempCenter: 'pyro-temp-center',
	tempOuter: 'pyro-temp-outer',
	hotPressure: 'pyro-hot-pressure',
	targetTemp: 'pyro-target-temp',
	verdict: 'pyro-verdict',
	camber: 'pyro-camber-advice',
	pressure: 'pyro-pressure-advice',
	pressureValue: 'pyro-pressure-advice-value',
	spreadEdge: 'pyro-spread-inner-outer',
	spreadCenter: 'pyro-spread-center-edges',
} as const;

/** Shipped field defaults, also used when a field is emptied. */
export const PYRO_DEFAULTS = {
	inner: 82,
	center: 88,
	outer: 76,
	target: 85,
	pressure: 2.2,
} as const;

/** Tailwind classes shared by every numeric field in the card. */
const FIELD_CLASSES =
	'w-full bg-surface-input border border-border-hairline rounded px-2 py-2 pr-9 font-mono text-[0.8125rem] font-semibold text-text-output outline-none focus:border-neon-cyan';

/** Shared classes of the header verdict pill, repainted by the live render. */
export const PYRO_PILL_CLASS = 'ml-auto rounded-full border px-2 py-0.5 font-mono text-[0.625rem] font-bold uppercase tracking-wider';

/** Definition of one labelled numeric field. */
interface NumberField {
	/** Element id used by the shell, the binder and the tests. */
	id: string;
	/** Dictionary key for the field label. */
	labelKey: DictKey;
	/** Initial value written into the input. */
	value: number;
	/** Unit suffix shown inside the field. */
	unit: string;
	/** Native step attribute. */
	step: number;
	/** Native min attribute. */
	min: number;
	/** Native max attribute. */
	max: number;
}

/** Definition of one titled advice block. */
interface AdviceBlock {
	/** Dictionary key for the block title. */
	titleKey: DictKey;
	/** Element id receiving the live advice line. */
	adviceId: string;
	/** Element id receiving the formatted bar delta, omitted when unused. */
	valueId?: string;
	/** Dictionary key for the static step hint. */
	stepKey: DictKey;
}

/**
 * @brief Create an element with a class list in one call.
 * @param tag Tag name to instantiate.
 * @param className Tailwind class list applied to the element.
 * @return Freshly created element.
 */
const makeEl = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] => {
	const el = document.createElement(tag);
	el.className = className;
	return el;
};

/**
 * @brief Create a text element tagged for the language toggle.
 * @param tag Tag name to instantiate.
 * @param className Tailwind class list applied to the element.
 * @param key Dictionary key written to data-i18n and used as initial text.
 * @return Element carrying the static copy.
 */
const makeI18n = <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	key: DictKey,
): HTMLElementTagNameMap[K] => {
	const el = makeEl(tag, className);
	el.setAttribute('data-i18n', key);
	el.textContent = t(key);
	return el;
};

/**
 * @brief Build the standard accordion chevron icon.
 * @return Inline SVG chevron in the expanded state.
 */
const buildChevron = (): SVGSVGElement => {
	const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	chevron.setAttribute('class', 'chevron open');
	chevron.setAttribute('data-chevron', '');
	chevron.setAttribute('viewBox', '0 0 24 24');
	chevron.setAttribute('fill', 'none');
	chevron.setAttribute('stroke', 'currentColor');
	chevron.setAttribute('stroke-width', '2');
	chevron.setAttribute('aria-hidden', 'true');
	const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
	poly.setAttribute('points', '6 9 12 15 18 9');
	chevron.appendChild(poly);
	return chevron;
};

/**
 * @brief Build one labelled number input with a unit suffix.
 * @param field Field definition: id, label key, default, unit and range.
 * @return Column element holding the label, the input and its unit.
 */
const buildNumberField = (field: NumberField): HTMLElement => {
	const col = makeEl('div', '');
	const label = makeI18n('label', 'mb-1 block text-[0.6875rem] font-medium text-text-dim', field.labelKey);
	label.setAttribute('for', field.id);
	const wrap = makeEl('div', 'relative');
	const input = makeEl('input', FIELD_CLASSES);
	input.type = 'number';
	input.id = field.id;
	input.inputMode = 'decimal';
	input.step = String(field.step);
	input.min = String(field.min);
	input.max = String(field.max);
	input.value = String(field.value);
	const unit = makeEl('span', 'absolute right-2.5 top-2 text-[0.625rem] font-mono text-text-muted pointer-events-none');
	unit.textContent = field.unit;
	wrap.append(input, unit);
	col.append(label, wrap);
	return col;
};

/**
 * @brief Build a grid of labelled number fields.
 * @param fields Field definitions to lay out.
 * @param className Grid classes, sized to the number of fields.
 * @return Grid element holding one column per field.
 */
const buildFieldGrid = (fields: NumberField[], className: string): HTMLElement => {
	const grid = makeEl('div', className);
	for (const field of fields) {
		grid.appendChild(buildNumberField(field));
	}
	return grid;
};

/**
 * @brief Build one spread readout row with a live right-hand value.
 * @param labelKey Dictionary key for the spread label.
 * @param valueId Element id receiving the live °C value.
 * @return Row element with label and value nodes.
 */
const buildSpreadRow = (labelKey: DictKey, valueId: string): HTMLElement => {
	const row = makeEl('div', 'flex items-center justify-between gap-2 font-mono text-[0.75rem]');
	const value = makeEl('span', 'text-text-output tabular-nums text-right');
	value.id = valueId;
	value.setAttribute('aria-live', 'polite');
	row.append(makeI18n('span', 'text-text-dim', labelKey), value);
	return row;
};

/**
 * @brief Build a titled advice block with a live line and a static step hint.
 * @param block Block definition: title, advice ids and step key.
 * @return Block element styled like the other tool readouts.
 */
const buildAdviceBlock = (block: AdviceBlock): HTMLElement => {
	const wrap = makeEl('div', 'bg-surface-recessed border border-border-hairline rounded p-2 flex flex-col gap-1');
	const row = makeEl('div', 'flex items-baseline justify-between gap-2');
	const advice = makeEl('p', 'font-mono text-[0.75rem]');
	advice.id = block.adviceId;
	row.appendChild(advice);
	if (block.valueId) {
		const value = makeEl('p', 'font-mono text-[0.75rem] tabular-nums');
		value.id = block.valueId;
		row.appendChild(value);
	}
	wrap.append(
		makeI18n('p', 'font-mono text-[0.625rem] uppercase tracking-wider text-text-muted', block.titleKey),
		row,
		makeI18n('p', 'font-mono text-[0.625rem] text-text-muted', block.stepKey),
	);
	return wrap;
};

/**
 * @brief Build every number field of the card.
 * @return Fragment holding the three zone fields and the two settings fields.
 */
const buildFields = (): DocumentFragment => {
	const frag = document.createDocumentFragment();
	const temp = (id: string, labelKey: DictKey, value: number): NumberField => ({
		id,
		labelKey,
		value,
		unit: '°C',
		step: 1,
		min: 0,
		max: 300,
	});
	frag.append(
		buildFieldGrid(
			[
				temp(PYRO_ID.tempInner, 'pyro.inner', PYRO_DEFAULTS.inner),
				temp(PYRO_ID.tempCenter, 'pyro.center', PYRO_DEFAULTS.center),
				temp(PYRO_ID.tempOuter, 'pyro.outer', PYRO_DEFAULTS.outer),
			],
			'grid grid-cols-3 gap-2',
		),
		buildFieldGrid(
			[
				temp(PYRO_ID.targetTemp, 'pyro.targetTemp', PYRO_DEFAULTS.target),
				{
					id: PYRO_ID.hotPressure,
					labelKey: 'pyro.hotPressure',
					value: PYRO_DEFAULTS.pressure,
					unit: 'bar',
					step: 0.05,
					min: 0.5,
					max: 5,
				},
			],
			'grid grid-cols-2 gap-2',
		),
	);
	return frag;
};

/**
 * @brief Build the accordion body: fields, advice blocks, spreads and note.
 * @return Body element ready to append to the section content.
 */
const buildBody = (): HTMLElement => {
	const body = makeEl('div', 'flex flex-col gap-3');
	const spreads = makeEl('div', 'flex flex-col gap-1.5');
	spreads.append(
		buildSpreadRow('pyro.edgeSpread', PYRO_ID.spreadEdge),
		buildSpreadRow('pyro.centerSpread', PYRO_ID.spreadCenter),
	);
	body.append(
		buildFields(),
		buildAdviceBlock({ titleKey: 'pyro.camberTitle', adviceId: PYRO_ID.camber, stepKey: 'pyro.camberStep' }),
		buildAdviceBlock({
			titleKey: 'pyro.pressureTitle',
			adviceId: PYRO_ID.pressure,
			valueId: PYRO_ID.pressureValue,
			stepKey: 'pyro.pressureStep',
		}),
		spreads,
		makeI18n('p', 'text-[0.625rem] text-text-dim leading-relaxed', 'pyro.note.text'),
	);
	return body;
};

/**
 * @brief Build the accordion header: title, live verdict pill, chevron.
 * @return Header element picked up by the shared accordion binder.
 */
const buildHeader = (): HTMLElement => {
	const header = makeEl('div', 'section-header px-3 py-2 bg-surface-subtle border-b border-border-hairline');
	header.setAttribute('data-accordion-header', '');
	const left = makeEl('div', 'flex items-center gap-2');
	left.append(
		makeEl('span', 'w-2 h-2 rounded-full bg-neon-cyan'),
		makeI18n('span', 'text-[0.8125rem] font-semibold uppercase tracking-wide text-text-output', 'pyro.title'),
	);
	const pill = makeEl('span', PYRO_PILL_CLASS);
	pill.id = PYRO_ID.verdict;
	pill.setAttribute('aria-live', 'polite');
	header.append(left, pill, buildChevron());
	return header;
};

/**
 * @brief Build the whole pyrometer card markup.
 * @brief Mirrors the cruise-card accordion shape so the shared accordion
 * @brief machinery, height observer and i18n pass find their hooks, and wraps
 * @brief it in the standard card chrome because the mount is a card slot.
 * @return Card element with the body already populated.
 */
export const buildPyrometerCard = (): HTMLElement => {
	const card = makeEl('div', 'card border border-border-hairline rounded-lg p-3 flex flex-col gap-3');
	const accordion = makeEl('div', 'bg-surface-subtle rounded border border-border-hairline overflow-hidden');
	accordion.setAttribute('data-accordion', 'pyrometer');
	const content = makeEl('div', 'section-content open p-3');
	content.setAttribute('data-accordion-content', '');
	content.appendChild(buildBody());
	accordion.append(buildHeader(), content);
	card.appendChild(accordion);
	return card;
};
