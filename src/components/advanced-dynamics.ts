/**
 * @file advanced-dynamics.ts
 * @brief Explicit primary powertrain, center split and preload controls.
 */
import { state } from '../core/state/app-state';
import { parseTire, effectiveCircumferenceM } from '../core/math/tire-math';
import { syncUrlHash } from '../core/share/share-utils';
import { toolSection, toolNumber, toolButton, toolOutput, toolValue, toolGroup } from './tool-form';
import { t } from '../core/i18n/language';
import { mountEfficiencyControls } from './efficiency-map-tools';

let synchronize: (() => void) | undefined;

/**
 * @brief Refresh committed values only when their underlying setup changes.
 * @return void
 */
export const syncAdvancedDynamics = (): void => { synchronize?.(); };

/**
 * @brief Mount advanced controls with explicit apply and reset behavior.
 * @param host Tools mount.
 * @param render Main refresh callback.
 * @return void
 */
export const injectAdvancedDynamics = (host: HTMLElement, render: () => void): void => {
	const form = toolSection(host, 'advanced.title');
	const output = toolOutput(form);
	const center = mountCenterControls(toolGroup(form, 'advanced.centerGroup'), output, render);
	const shifts = mountShiftControls(toolGroup(form, 'advanced.shiftGroup'), output, render);
	const efficiency = mountEfficiencyControls(toolGroup(form, 'advanced.efficiencyGroup'), output, render);
	synchronize = () => { center(); shifts(); efficiency(); };
	synchronize();
};

/**
 * @brief Mount fixed/ideal AWD and rear handbrake controls.
 * @param center Center and axle fieldset.
 * @param output Live status.
 * @param render Refresh callback.
 * @return Setup synchronization callback.
 */
const mountCenterControls = (center: HTMLElement, output: HTMLOutputElement, render: () => void): (() => void) => {
	const front = toolNumber(center, 'awd-front', 'advanced.frontShare', (state.runningGear.awdFrontShare ?? 0.5) * 100, 0, 100);
	const preload = toolNumber(center, 'preload', 'advanced.preload', state.runningGear.differentialPreloadNm ?? 0, 0, 1000);
	const rearBrake = toolNumber(center, 'rear-handbrake', 'advanced.rearHandbrake', (state.runningGear.handbrakeFraction || 0.6) * 100, 0, 100);
	const apply = (disengaged: boolean, activeCenter = false): void => {
		const share = toolValue(front);
		const nm = toolValue(preload);
		const brake = disengaged ? toolValue(rearBrake) : 0;
		const tire = parseTire(state.primaryTire);
		if (share === null || nm === null || brake === null || !tire) { output.textContent = t('lab.invalid'); return; }
		state.runningGear.awdFrontShare = share / 100;
		state.runningGear.centerDisengaged = disengaged;
		state.runningGear.activeCenter = activeCenter;
		state.runningGear.handbrakeFraction = brake / 100;
		state.runningGear.differentialPreloadNm = nm;
		state.runningGear.preloadRadiusM = effectiveCircumferenceM(tire, state.rollingFactor) / (2 * Math.PI);
		render(); syncUrlHash();
		output.textContent = t(disengaged ? 'advanced.centerFree' : activeCenter ? 'advanced.activeApplied' : 'advanced.applied');
	};
	toolButton(center, 'advanced.apply', () => apply(false));
	const active = toolButton(center, 'advanced.active', () => apply(false, true));
	toolButton(center, 'advanced.handbrake', () => apply(true));
	let previous = ''; let setup = state.runningGear;
	return () => {
		const rg = state.runningGear;
		const key = JSON.stringify([rg.awdFrontShare, rg.differentialPreloadNm, rg.handbrakeFraction, rg.activeCenter, rg.centerDisengaged, rg.drivetrainLayout]);
		if (key === previous && setup === rg) return;
		previous = key; setup = rg;
		front.value = String((rg.awdFrontShare ?? 0.5) * 100);
		preload.value = String(rg.differentialPreloadNm ?? 0);
		rearBrake.value = String((rg.handbrakeFraction || 0.6) * 100);
		[front, preload, rearBrake].forEach((input) => input.removeAttribute('aria-invalid'));
		active.disabled = rg.drivetrainLayout !== 'AWD'; output.textContent = '';
	};
};

/**
 * @brief Add per-shift interruption times and rev-limiter mode choices.
 * @param form Advanced controls form.
 * @param output Status output.
 * @param render Main refresh callback.
 * @return Setup synchronization callback.
 */
const mountShiftControls = (form: HTMLElement, output: HTMLOutputElement, render: () => void): (() => void) => {
	const label = document.createElement('label');
	label.className = 'tool-wide-field';
	const caption = document.createElement('span');
	caption.dataset.i18n = 'advanced.shiftTimes'; caption.textContent = t('advanced.shiftTimes');
	const times = document.createElement('input');
	times.type = 'text'; times.name = 'shift-times'; times.autocomplete = 'off'; times.spellcheck = false;
	times.value = (state.simulation?.shiftTimesS.length ? state.simulation.shiftTimesS
		: Array(Math.max(1, state.gears.length - 1)).fill(state.shiftTimeS)).join(', ');
	label.append(caption, times); form.append(label);
	const apply = (limiterMode: 'hard' | 'bounce'): void => {
		const parts = times.value.split(/[;,]/).map((value) => value.trim());
		const values = parts.map(Number);
		if (parts.some((part) => !part) || values.length !== state.gears.length - 1 || values.some((value) => !Number.isFinite(value) || value < 0 || value > 3)) {
			times.setAttribute('aria-invalid', 'true'); times.focus(); output.textContent = t('advanced.invalidTimes'); return;
		}
		times.removeAttribute('aria-invalid');
		state.simulation = { ...state.simulation, limiterMode, shiftTimesS: values };
		syncUrlHash(); render(); output.textContent = t('advanced.applied');
	};
	toolButton(form, 'advanced.hard', () => apply('hard'));
	toolButton(form, 'advanced.bounce', () => apply('bounce'));
	let previous = ''; let gears = state.gears;
	return () => {
		const values = state.simulation?.shiftTimesS.length ? state.simulation.shiftTimesS
			: Array(Math.max(1, state.gears.length - 1)).fill(state.shiftTimeS);
		const key = JSON.stringify([state.gears.length, values, state.simulation?.limiterMode]);
		if (key === previous && gears === state.gears) return;
		previous = key; gears = state.gears;
		times.value = values.join(', '); times.removeAttribute('aria-invalid'); output.textContent = '';
	};
};
