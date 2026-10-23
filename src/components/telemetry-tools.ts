/**
 * @file telemetry-tools.ts
 * @brief Local telemetry import and explicit recovered-curve application.
 */
import { state } from '../core/state/app-state';
import { parseTire, effectiveCircumferenceM } from '../core/math/tire-math';
import { parseTelemetryCsv, recoverGearRatios, inverseDyno, type TelemetryRow } from '../core/math/telemetry-math';
import { resampleTorquePoints } from '../core/math/dyno-csv';
import { syncUrlHash } from '../core/share/share-utils';
import { toolSection, toolButton, toolOutput } from './tool-form';
import { t } from '../core/i18n/language';

/**
 * @brief Mount CSV analysis without uploading source data.
 * @param host Tools mount.
 * @param render Refresh callback after applying a curve.
 * @return void
 */
export const injectTelemetryTools = (host: HTMLElement, render: () => void): void => {
	const form = toolSection(host, 'telemetry.title');
	const label = document.createElement('label');
	const caption = document.createElement('span');
	caption.dataset.i18n = 'telemetry.csv';
	caption.textContent = t('telemetry.csv');
	const input = document.createElement('input');
	input.type = 'file'; input.name = 'telemetry'; input.accept = '.csv,.txt,text/csv';
	label.append(caption, input); form.append(label);
	const output = toolOutput(form);
	let rows: TelemetryRow[] = [];
	input.addEventListener('change', () => {
		rows = [];
		const file = input.files?.[0];
		if (!file || file.size > 10_000_000) { output.textContent = t('telemetry.invalid'); return; }
		void file.text().then((text) => {
			rows = parseTelemetryCsv(text);
			const tire = parseTire(state.primaryTire);
			if (rows.length < 3 || !tire) { output.textContent = t('telemetry.invalid'); return; }
			const ratios = recoverGearRatios(rows, effectiveCircumferenceM(tire, state.rollingFactor), state.primaryFd);
			output.textContent = `${t('telemetry.samples')}: ${rows.length}\n${ratios.map((ratio, index) =>
				`G${index + 1}: ${ratio.ratio.toFixed(3)} · n=${ratio.samples} · ${t('telemetry.slip')}: ${(ratio.slipFraction * 100).toFixed(1)}%`).join('\n')}\n${t('telemetry.caution')}`;
		}).catch(() => { output.textContent = t('telemetry.invalid'); });
	});
	toolButton(form, 'telemetry.inverse', () => {
		const tire = parseTire(state.primaryTire);
		if (!tire) { output.textContent = t('telemetry.invalid'); return; }
		const points = inverseDyno(rows, { massKg: state.vehicleMassKg, gears: state.gears, fd: state.primaryFd,
			circM: effectiveCircumferenceM(tire, state.rollingFactor), efficiency: state.drivetrainEff,
			dragCd: state.dragCd, areaM2: state.frontalAreaM2, rollingCrr: state.rollingCrr, gradePercent: state.roadGradePercent });
		if (!points) { output.textContent = t('telemetry.noDyno'); return; }
		state.torqueCurvePoints = resampleTorquePoints(points, 64);
		syncUrlHash(); render();
		output.textContent = t('telemetry.applied');
	});
};
