/**
 * @file metric-fields.ts
 * @brief Declarative renderer for repeated road-load metric input boxes.
 */
import type { DictKey } from '../core/i18n/dictionaries';
import { t } from '../core/i18n/language';

/** Configuration of one metric input box. */
interface MetricField {
	id: string;
	labelKey: DictKey;
	unit?: string;
	step: string;
	min: string;
	max: string;
	value: string;
	powerUnit?: boolean;
}

/** Shared compact metric definition with slot-specific ids. */
interface SharedMetric extends Omit<MetricField, 'id'> {
	primaryId: string;
	comparisonId?: string;
}

/** Compact metrics shared by primary and comparison setup slots. */
const COMPACT_METRICS: SharedMetric[] = [
	{ primaryId: 'roadload-mass', comparisonId: 'comp-mass', labelKey: 'road.massShort', unit: 'kg', step: '10', min: '500', max: '3000', value: '1200' },
	{ primaryId: 'roadload-cd', comparisonId: 'comp-cd', labelKey: 'road.cdShort', unit: 'Cd', step: '0.01', min: '0.15', max: '0.60', value: '0.30' },
	{ primaryId: 'roadload-area', comparisonId: 'comp-area', labelKey: 'road.areaShort', unit: 'm²', step: '0.05', min: '1.0', max: '4.0', value: '2.00' },
	{ primaryId: 'roadload-crr', labelKey: 'road.crrShort', unit: 'coef', step: '0.001', min: '0.005', max: '0.030', value: '0.012' },
];

/** Primary advanced road-load fields. */
const PRIMARY_ADVANCED: MetricField[] = [
	{ id: 'roadload-power', labelKey: 'road.power', unit: 'kW', step: '5', min: '30', max: '700', value: '110', powerUnit: true },
	{ id: 'roadload-eff', labelKey: 'road.eff', step: '0.01', min: '0.70', max: '1.00', value: '0.85' },
	{ id: 'roadload-grade', labelKey: 'road.grade', unit: '%', step: '0.5', min: '-30', max: '30', value: '0' },
	{ id: 'roadload-rollfactor', labelKey: 'road.rollFactor', step: '0.005', min: '0.90', max: '1.00', value: '0.975' },
	{ id: 'roadload-rot-mass', labelKey: 'road.rotMass', unit: 'kg', step: '10', min: '0', max: '500', value: '0' },
	{ id: 'roadload-shift-time', labelKey: 'road.shiftTime', unit: 's', step: '0.05', min: '0', max: '3', value: '0' },
];

/**
 * @brief Inject all declarative metric groups before DOM refs resolve.
 * @return void
 */
export const injectMetricFields = (): void => {
	injectGroup('primary-metrics-mount', buildPrimaryMetrics(), true);
	injectGroup('primary-advanced-metrics-mount', PRIMARY_ADVANCED, false);
	injectGroup('comparison-metrics-mount', buildComparisonMetrics(), true);
};

/**
 * @brief Materialize compact primary fields from shared definitions.
 * @return Primary metric definitions.
 */
const buildPrimaryMetrics = (): MetricField[] => {
	return COMPACT_METRICS.map(({ primaryId, comparisonId: _comparisonId, ...field }) => ({ id: primaryId, ...field }));
};

/**
 * @brief Materialize supported comparison fields and append engine power.
 * @return Comparison metric definitions.
 */
const buildComparisonMetrics = (): MetricField[] => {
	const shared = COMPACT_METRICS
		.filter((field) => field.comparisonId)
		.map(({ primaryId: _primaryId, comparisonId, ...field }) => ({ id: comparisonId ?? '', ...field }));
	return [
		...shared,
		{ id: 'comp-power', labelKey: 'road.power', unit: 'kW', step: '5', min: '30', max: '700', value: '110', powerUnit: true },
	];
};

/**
 * @brief Render one list of metric definitions into a required mount.
 * @param mountId Target mount id.
 * @param fields Metric definitions rendered in order.
 * @param boxed Whether fields use the compact metric-box presentation.
 * @return void
 */
const injectGroup = (mountId: string, fields: MetricField[], boxed: boolean): void => {
	const mount = document.getElementById(mountId);
	if (!mount) {
		throw new Error(`Missing required element: ${mountId}`);
	}
	const fragment = document.createDocumentFragment();
	fields.forEach((field) => fragment.appendChild(buildMetricField(field, boxed)));
	mount.replaceWith(fragment);
};

/**
 * @brief Build one accessible numeric field from declarative metadata.
 * @param field Field metadata including preserved DOM id and limits.
 * @param boxed Whether to render the compact box variant.
 * @return Field wrapper element.
 */
const buildMetricField = (field: MetricField, boxed: boolean): HTMLElement => {
	const wrapper = document.createElement('div');
	wrapper.className = boxed ? 'metric-field' : 'measure-field';
	const label = document.createElement('label');
	label.className = boxed ? 'metric-field-label' : 'measure-field-label';
	label.htmlFor = field.id;
	const labelText = document.createElement('span');
	labelText.dataset.i18n = field.labelKey;
	labelText.textContent = t(field.labelKey);
	label.appendChild(labelText);
	const control = document.createElement('div');
	control.className = boxed ? 'metric-field-control' : 'measure-field-control';
	control.append(buildInput(field, boxed));
	if (field.unit) {
		control.appendChild(buildUnit(field));
	}
	wrapper.append(label, control);
	return wrapper;
};

/**
 * @brief Build the editable number input of one metric field.
 * @param field Field metadata.
 * @param boxed Whether to use compact input styling.
 * @return Configured number input.
 */
const buildInput = (field: MetricField, boxed: boolean): HTMLInputElement => {
	const input = document.createElement('input');
	input.type = 'number';
	input.inputMode = 'decimal';
	input.id = field.id;
	input.step = field.step;
	input.min = field.min;
	input.max = field.max;
	input.value = field.value;
	input.className = boxed ? 'metric-field-input' : 'measure-field-input';
	return input;
};

/**
 * @brief Build the unit annotation of one metric field.
 * @param field Field metadata with a defined unit.
 * @return Unit span.
 */
const buildUnit = (field: MetricField): HTMLSpanElement => {
	const unit = document.createElement('span');
	unit.className = field.powerUnit ? 'metric-field-unit power-unit-label' : 'metric-field-unit';
	unit.textContent = field.unit ?? '';
	return unit;
};
