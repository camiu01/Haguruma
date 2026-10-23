/**
 * @file dynamics-tools.ts
 * @brief Braking, apex gearing and downshift tools using the active setup.
 */
import { state } from '../core/state/app-state';
import { activeEngineCurve } from '../core/state/engine-curve';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { simulateBraking } from '../core/math/braking-simulation';
import { apexGearAdvice, downshiftAdvice } from '../core/math/corner-advisor';
import { toolSection, toolNumber, toolButton, toolOutput, toolValue } from './tool-form';
import { t } from '../core/i18n/language';
import { mountBrakingChart } from './braking-chart';

/**
 * @brief Mount the dynamic stopping-distance calculator.
 * @param host Tools mount.
 * @return void
 */
const brakingTool = (host: HTMLElement): void => {
	const form = toolSection(host, 'lab.braking');
	const speed = toolNumber(form, 'speed', 'lab.speedKmh', 100, 1, 400);
	const bias = toolNumber(form, 'bias', 'lab.brakeBias', 65, 0, 100);
	const output = toolOutput(form);
	const run = (abs: boolean): void => {
		const v = toolValue(speed);
		const b = toolValue(bias);
		if (v === null || b === null) { output.textContent = t('lab.invalid'); return; }
		const result = simulateBraking({ speedKmh: v, massKg: state.vehicleMassKg, runningGear: state.runningGear,
			frontBias: b / 100, abs, dragCd: state.dragCd, areaM2: state.frontalAreaM2, gradePercent: state.roadGradePercent });
		output.textContent = result.distanceM === null ? t('lab.noResult')
			: `${result.distanceM.toFixed(1)} m · ${result.timeS?.toFixed(2)} s${result.frontLock || result.rearLock ? ' · ' + t('lab.wheelLock') : ''}`;
		plot({ massKg: state.vehicleMassKg, runningGear: state.runningGear, frontBias: b / 100, abs,
			dragCd: state.dragCd, areaM2: state.frontalAreaM2, gradePercent: state.roadGradePercent });
	};
	toolButton(form, 'lab.withAbs', () => run(true));
	toolButton(form, 'lab.withoutAbs', () => run(false));
	const plot = mountBrakingChart(form);
};

/**
 * @brief Mount corner-speed and safe rev-match readouts.
 * @param host Tools mount.
 * @return void
 */
const cornerTool = (host: HTMLElement): void => {
	const form = toolSection(host, 'lab.corner');
	const radius = toolNumber(form, 'radius', 'lab.radius', 50, 5, 2000);
	const lateral = toolNumber(form, 'lateral', 'lab.lateral', 1, 0.1, 2, 0.05);
	const speed = toolNumber(form, 'speed', 'lab.speedKmh', 80, 1, 400);
	const from = toolNumber(form, 'from', 'lab.fromGear', 3, 2, 8);
	const to = toolNumber(form, 'to', 'lab.toGear', 2, 1, 7);
	const output = toolOutput(form);
	toolButton(form, 'lab.calculate', () => {
		const values = [radius, lateral, speed, from, to].map(toolValue);
		const tire = parseTire(state.primaryTire);
		const curve = activeEngineCurve();
		if (values.some((value) => value === null) || !tire || !curve) { output.textContent = t('lab.invalid'); return; }
		const [r, g, v, f, target] = values as number[];
		const circ = effectiveCircumferenceM(tire, state.rollingFactor);
		const apex = apexGearAdvice(r, g, state.gears, state.primaryFd, circ, curve);
		const shift = downshiftAdvice(v, state.gears[f - 1], state.gears[target - 1], state.primaryFd, circ, curve, state.runningGear, state.vehicleMassKg, state.drivetrainEff);
		output.textContent = [
			apex ? `${t('lab.apex')}: ${apex.speedKmh.toFixed(1)} km/h · G${apex.gear} · ${Math.round(apex.rpm)} RPM` : t('lab.noResult'),
			shift ? `${t('lab.revMatch')}: ${Math.round(shift.targetRpm)} RPM (+${Math.round(shift.blipRpm)}) · ${shift.decelMps2.toFixed(2)} m/s²${shift.lockRisk ? ' · ' + t('lab.wheelLock') : ''}` : t('lab.unsafeDownshift'),
		].join('\n');
	});
};

/**
 * @brief Mount the active-setup dynamics calculators.
 * @param host Component mount.
 * @return void
 */
export const injectDynamicsTools = (host: HTMLElement): void => {
	brakingTool(host);
	cornerTool(host);
};
