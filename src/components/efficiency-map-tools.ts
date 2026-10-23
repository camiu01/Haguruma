/**
 * @file efficiency-map-tools.ts
 * @brief Explicit measured-map preview, apply and constant-efficiency reset.
 */
import { state } from '../core/state/app-state';
import { parseEfficiencyCsv } from '../core/math/efficiency-map';
import type { EfficiencySample } from '../core/math/powertrain-math';
import { syncUrlHash } from '../core/share/share-utils';
import { t } from '../core/i18n/language';
import { toolButton } from './tool-form';

/**
 * @brief Mount bounded CSV import without changing the setup until Apply is pressed.
 * @param form Advanced transmission form.
 * @param output Live result status.
 * @param render Refresh callback.
 * @return Callback invalidating previews when the primary setup is replaced.
 */
export const mountEfficiencyControls = (form: HTMLElement, output: HTMLOutputElement, render: () => void): (() => void) => {
	let pending: EfficiencySample[] | null = null;
	let request = 0;
	const label = document.createElement('label');
	label.className = 'tool-wide-field';
	const caption = document.createElement('span');
	caption.dataset.i18n = 'advanced.efficiencyCsv'; caption.textContent = t('advanced.efficiencyCsv');
	const file = document.createElement('input');
	file.type = 'file'; file.name = 'efficiency-map'; file.accept = '.csv,text/csv';
	label.append(caption, file); form.append(label);
	const apply = toolButton(form, 'advanced.applyMap', () => {
		if (!pending) return;
		state.simulation = { limiterMode: 'hard', shiftTimesS: [], ...state.simulation, efficiencyMap: pending };
		render(); syncUrlHash(); output.textContent = t('advanced.applied');
	});
	apply.disabled = true;
	file.addEventListener('change', async () => {
		const current = ++request;
		pending = null; apply.disabled = true;
		const selected = file.files?.[0];
		try {
			const parsed = selected && selected.size <= 50_000 ? parseEfficiencyCsv(await selected.text()) : null;
			if (current !== request) return;
			pending = parsed; apply.disabled = !parsed;
			file.setAttribute('aria-invalid', String(!parsed));
			output.textContent = parsed
				? t('advanced.mapReady').replace('{count}', new Intl.NumberFormat(document.documentElement.lang).format(parsed.length))
				: t('advanced.invalidMap');
		} catch {
			if (current === request) output.textContent = t('advanced.invalidMap');
		}
	});
	toolButton(form, 'advanced.resetMap', () => {
		if (state.simulation) delete state.simulation.efficiencyMap;
		render(); syncUrlHash(); output.textContent = t('advanced.mapReset');
	});
	let setup = state.gears;
	return () => {
		if (setup === state.gears) return;
		setup = state.gears; request++;
		pending = null; apply.disabled = true; file.value = ''; file.removeAttribute('aria-invalid');
		output.textContent = '';
	};
};
