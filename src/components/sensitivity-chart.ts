/**
 * @file sensitivity-chart.ts
 * @brief Signed tornado plots with equivalent accessible tabular values.
 */
import type { SensitivityRow } from '../core/math/setup-sensitivity';
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';

const METRICS = [
	{ field: 'topSpeedDeltaPercent', label: 'diag.metricSpeed', unit: '%' },
	{ field: 'shiftDeltaRpm', label: 'diag.metricShift', unit: 'RPM' },
	{ field: 'accelDeltaPercent', label: 'diag.metricAccel', unit: '%' },
] as const;

/**
 * @brief Draw a zero-centered bar without making color carry the sign.
 * @param value Signed metric change, null when the simulation has no result.
 * @param max Maximum absolute change in this metric.
 * @param unit Metric unit.
 * @return Table cell with a decorative bar and signed numeric equivalent.
 */
const deltaCell = (value: number | null, max: number, unit: string): HTMLTableCellElement => {
	const cell = document.createElement('td');
	const chart = document.createElement('div');
	chart.className = 'sensitivity-delta'; chart.setAttribute('aria-hidden', 'true');
	const bar = document.createElement('span');
	const width = value === null ? 0 : Math.abs(value) / max * 50;
	bar.className = value !== null && value < 0 ? 'negative' : 'positive';
	bar.style.width = `${width}%`; bar.style.left = `${value !== null && value < 0 ? 50 - width : 50}%`;
	chart.append(bar);
	const text = document.createElement('span');
	const fmt = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: unit === 'RPM' ? 0 : 2, signDisplay: 'always' });
	text.textContent = value === null ? '—' : `${fmt.format(value)} ${unit}`;
	cell.append(chart, text);
	return cell;
};

/**
 * @brief Render independently scaled signed plots for speed, shift RPM and elapsed time.
 * @param host Results container.
 * @param rows Ranked input sensitivities.
 * @return void
 */
export const renderSensitivityChart = (host: HTMLElement, rows: SensitivityRow[]): void => {
	const table = document.createElement('table');
	table.className = 'sensitivity-table';
	const caption = table.createCaption();
	caption.textContent = t('diag.sensitivityCaution');
	const header = table.createTHead().insertRow();
	for (const key of ['diag.metricInput', ...METRICS.map((metric) => metric.label)] as DictKey[]) {
		const cell = document.createElement('th');
		cell.scope = 'col'; cell.textContent = t(key); header.append(cell);
	}
	const maxima = METRICS.map((metric) => Math.max(1, ...rows.map((row) => Math.abs(row[metric.field] ?? 0))));
	const body = table.createTBody();
	for (const row of rows) {
		const line = body.insertRow();
		const label = document.createElement('th');
		label.scope = 'row'; label.textContent = t(`diag.input.${row.input}`); line.append(label);
		METRICS.forEach((metric, index) => line.append(deltaCell(row[metric.field], maxima[index], metric.unit)));
	}
	host.replaceChildren(table);
};
