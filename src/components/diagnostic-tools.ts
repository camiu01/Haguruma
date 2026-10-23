/**
 * @file diagnostic-tools.ts
 * @brief Pyrometer, adjustment-conflict and sensitivity tools.
 */
import { state } from '../core/state/app-state';
import { activeEngineCurve } from '../core/state/engine-curve';
import { parseTire, effectiveCircumferenceM } from '../core/math/tire-math';
import { diagnoseTire, diagnoseAxleTemperatures, conflictingAdjustments, type SetupAdjustment } from '../core/setup/setup-diagnostics';
import { setupSensitivity } from '../core/math/setup-sensitivity';
import { toolSection, toolNumber, toolButton, toolOutput, toolValue } from './tool-form';
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';
import { renderSensitivityChart } from './sensitivity-chart';

/**
 * @brief Mount four-wheel tread temperature inputs.
 * @param host Tools mount.
 * @return void
 */
const pyrometerTool = (host: HTMLElement): void => {
	const form = toolSection(host, 'diag.pyrometer');
	const wheels: DictKey[] = ['diag.fl', 'diag.fr', 'diag.rl', 'diag.rr'];
	const fields = wheels.map((wheel, index) => {
		const group = document.createElement('fieldset');
		const legend = document.createElement('legend');
		legend.dataset.i18n = wheel;
		legend.textContent = t(wheel);
		group.append(legend);
		const inputs = [
			toolNumber(form, `inner-${index}`, 'diag.inner', 80, 0, 200),
			toolNumber(form, `center-${index}`, 'diag.center', 80, 0, 200),
			toolNumber(form, `outer-${index}`, 'diag.outer', 80, 0, 200),
		];
		for (const input of inputs) group.append(input.parentElement!);
		form.append(group);
		return inputs;
	});
	const output = toolOutput(form);
	toolButton(form, 'lab.calculate', () => {
		const values = fields.map((row) => row.map(toolValue));
		if (values.some((row) => row.some((value) => value === null))) { output.textContent = t('lab.invalid'); return; }
		const tires = values.map(([inner, center, outer]) => ({ inner: inner!, center: center!, outer: outer! }));
		output.textContent = [...tires.map((tire, index) => `${t(wheels[index])}: ${diagnoseTire(tire).map((key) => t(key)).join(' · ')}`),
			...diagnoseAxleTemperatures(tires).map((key) => t(key)), t('diag.caution')].join('\n');
	});
};

/**
 * @brief Mount a same-axle spring/ARB conflict checker.
 * @param host Tools mount.
 * @return void
 */
const conflictTool = (host: HTMLElement): void => {
	const form = toolSection(host, 'diag.conflicts');
	const choices: { input: HTMLInputElement; change: SetupAdjustment }[] = [];
	for (const axle of ['front', 'rear'] as const) {
		for (const component of ['spring', 'arb'] as const) {
			for (const direction of ['stiffer', 'softer'] as const) {
				const label = document.createElement('label');
				const input = document.createElement('input');
				input.type = 'checkbox';
				input.name = `${axle}-${component}-${direction}`;
				label.append(input);
				for (const key of [`diag.${axle}`, `diag.${component}`, `diag.${direction}`] as DictKey[]) {
					const text = document.createElement('span');
					text.dataset.i18n = key;
					text.textContent = t(key);
					label.append(text);
				}
				form.append(label);
				choices.push({ input, change: { axle, component, direction } });
			}
		}
	}
	const output = toolOutput(form);
	toolButton(form, 'lab.calculate', () => {
		const conflicts = conflictingAdjustments(choices.filter((choice) => choice.input.checked).map((choice) => choice.change));
		output.textContent = conflicts.length > 0 ? t('diag.conflictWarning') : t('diag.noConflict');
	});
};

/**
 * @brief Render signed performance sensitivities with tabular equivalents.
 * @param host Tools mount.
 * @return void
 */
const sensitivityTool = (host: HTMLElement): void => {
	const form = toolSection(host, 'diag.sensitivity');
	const output = toolOutput(form);
	const chart = document.createElement('div');
	chart.className = 'sensitivity-results';
	toolButton(form, 'lab.calculate', () => {
		const tire = parseTire(state.primaryTire);
		if (!tire || !activeEngineCurve()) { chart.replaceChildren(); output.textContent = t('lab.invalid'); return; }
		const rows = setupSensitivity({ massKg: state.vehicleMassKg, gears: [...state.gears], fd: state.primaryFd,
			circM: effectiveCircumferenceM(tire, state.rollingFactor), curve: activeEngineCurve(), drivetrainEff: state.drivetrainEff,
			runningGear: state.runningGear, dragCd: state.dragCd, frontalAreaM2: state.frontalAreaM2,
			rollingCrr: state.rollingCrr, roadGradePercent: state.roadGradePercent, shiftTimeS: state.shiftTimeS, ...state.simulation });
		renderSensitivityChart(chart, rows);
		output.textContent = t('diag.sensitivityReady');
	});
	form.append(chart);
};

/**
 * @brief Mount all diagnostic tools without touching simulation state.
 * @param host Tools mount.
 * @return void
 */
export const injectDiagnosticTools = (host: HTMLElement): void => {
	pyrometerTool(host);
	conflictTool(host);
	sensitivityTool(host);
};
