/**
 * @file engine-events.ts
 * @brief Bind engine curve anchors plus the dyno CSV import flow.
 */
import { state } from '../../core/state/app-state';
import { powerFromTorque } from '../../core/math/traction-math';
import { parseDynoCsv } from '../../core/math/dyno-csv';
import { formatPower } from '../../core/units/unit-utils';
import { t } from '../../core/i18n/language';
import { syncRoadLoadInputs } from './road-load-events';
import type { ElementRefs } from '../dom/element-refs';

/**
 * @brief Bind engine curve inputs and the dyno CSV import controls.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindEngineEvents = (refs: ElementRefs, render: () => void): void => {
	refs.torqueRpmInput.addEventListener('input', (e) => {
		const v = parseInt((e.target as HTMLInputElement).value, 10);
		if (v >= 1000 && v <= 12000) {
			state.peakTorqueRpm = v;
			syncEngineDerived(refs);
			render();
		}
	});
	refs.torqueInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (v > 0) {
			state.peakTorqueNm = v;
			syncEngineDerived(refs);
			render();
		}
	});
	refs.powerRpmInput.addEventListener('input', (e) => {
		const v = parseInt((e.target as HTMLInputElement).value, 10);
		if (v >= 1000 && v <= 12000) {
			state.peakPowerRpm = v;
			syncEngineDerived(refs);
			render();
		}
	});
	bindCsvImport(refs, render);
};

/**
 * @brief Bind the dyno CSV file picker and the back-to-anchors action.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
const bindCsvImport = (refs: ElementRefs, render: () => void): void => {
	refs.btnImportCsv.addEventListener('click', () => {
		refs.csvImportInput.click();
	});
	refs.csvImportInput.addEventListener('change', () => {
		const file = refs.csvImportInput.files?.[0];
		refs.csvImportInput.value = '';
		if (!file) {
			return;
		}
		void readCsvFile(file).then((text) => {
			applyDynoCsv(refs, text, render);
		});
	});
	refs.btnClearCsv.addEventListener('click', () => {
		state.torqueCurvePoints = null;
		syncEngineInputs(refs);
		render();
	});
};

/**
 * @brief Read one CSV file as text without ever rejecting.
 * @param file File chosen from the hidden input.
 * @return Resolves with the file text, empty on read errors.
 */
const readCsvFile = (file: File): Promise<string> => {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ''));
		reader.onerror = () => resolve('');
		reader.readAsText(file);
	});
};

/**
 * @brief Parse CSV text and apply the measured curve to state.
 * @brief Anchor inputs and peak power are replaced by the derived values.
 * @param refs Cached DOM handles.
 * @param text Full CSV file contents.
 * @param render Full refresh callback.
 * @return void
 */
const applyDynoCsv = (refs: ElementRefs, text: string, render: () => void): void => {
	const dyno = parseDynoCsv(text);
	if (!dyno) {
		showCsvStatus(refs, 'error', 0);
		return;
	}
	state.torqueCurvePoints = dyno.points.map((p) => ({ rpm: p.rpm, torqueNm: p.torqueNm }));
	state.peakTorqueRpm = Math.round(dyno.peakTorqueRpm);
	state.peakTorqueNm = Math.round(dyno.peakTorqueNm * 10) / 10;
	state.peakPowerRpm = Math.round(dyno.peakPowerRpm);
	state.enginePowerKw = Math.round(dyno.peakPowerKw * 10) / 10;
	syncEngineInputs(refs);
	syncRoadLoadInputs(refs);
	render();
};

/**
 * @brief Sync engine inputs with current state (e.g. after preset load).
 * @brief Also locks the anchor inputs while a custom dyno curve is active.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncEngineInputs = (refs: ElementRefs): void => {
	refs.torqueRpmInput.value = String(state.peakTorqueRpm);
	refs.torqueInput.value = String(state.peakTorqueNm);
	refs.powerRpmInput.value = String(state.peakPowerRpm);
	applyEngineCurveMode(refs, state.torqueCurvePoints !== null && state.torqueCurvePoints.length >= 2);
	syncEngineDerived(refs);
	syncEngineCsvStatus(refs);
};

/**
 * @brief Enable or disable the anchor inputs for the active curve mode.
 * @param refs Cached DOM handles.
 * @param customActive True while a dyno CSV curve overrides the anchors.
 * @return void
 */
const applyEngineCurveMode = (refs: ElementRefs, customActive: boolean): void => {
	refs.torqueRpmInput.disabled = customActive;
	refs.torqueInput.disabled = customActive;
	refs.powerRpmInput.disabled = customActive;
	refs.btnClearCsv.classList.toggle('hidden', !customActive);
};

/**
 * @brief Update the derived power-at-torque-peak readout.
 * @param refs Cached DOM handles.
 * @return void
 */
const syncEngineDerived = (refs: ElementRefs): void => {
	refs.powerAtDisplay.value = formatPower(powerFromTorque(state.peakTorqueNm, state.peakTorqueRpm), state.powerUnit);
};

/**
 * @brief Write the CSV status line under the engine card controls.
 * @param refs Cached DOM handles.
 * @param kind 'ok', 'error' or 'idle' status variant.
 * @param count Point count injected into the ok message.
 * @return void
 */
const showCsvStatus = (refs: ElementRefs, kind: 'ok' | 'error' | 'idle', count: number): void => {
	refs.csvStatus.classList.toggle('text-neon-red', kind === 'error');
	if (kind === 'ok') {
		refs.csvStatus.textContent = t('engine.csvOk').replace('{n}', String(count));
		return;
	}
	refs.csvStatus.textContent = kind === 'error' ? t('engine.csvError') : t('engine.csvIdle');
};

/**
 * @brief Refresh the CSV status line from current state.
 * @brief Called from the render entry so language switches stay in sync.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncEngineCsvStatus = (refs: ElementRefs): void => {
	const points = state.torqueCurvePoints;
	showCsvStatus(refs, points && points.length >= 2 ? 'ok' : 'idle', points?.length ?? 0);
};
