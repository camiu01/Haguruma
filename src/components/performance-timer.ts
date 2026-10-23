/**
 * @file performance-timer.ts
 * @brief Explicit GPS recording, speed-only local session storage and exports.
 */
import { state } from '../core/state/app-state';
import { activeEngineCurve } from '../core/state/engine-curve';
import { parseTire, effectiveCircumferenceM } from '../core/math/tire-math';
import { simulateAcceleration, type SimResult } from '../core/math/accel-math';
import { measurePerformanceSession, performanceSessionCsv, type PerformanceSample } from '../core/math/performance-session';
import { downloadTextFile } from '../services/graph/drivetrain-export';
import { toolSection, toolButton, toolOutput } from './tool-form';
import { t } from '../core/i18n/language';
import { SESSION_STORAGE_KEY, parsePerformanceSession } from '../core/presets/performance-store';
import { PerformanceRecorder } from '../services/hardware/performance-recorder';

/**
 * @brief Mount a manually armed, foreground-only performance recorder.
 * @param host Tools mount.
 * @return void
 */
export const injectPerformanceTimer = (host: HTMLElement): void => {
	const form = toolSection(host, 'timer.title');
	const output = toolOutput(form);
	output.textContent = t('timer.caution');
	let predicted: SimResult | null = null;
	const recorder = new PerformanceRecorder(navigator.geolocation, {
		onSamples: (samples) => renderTimerResult(output, samples, predicted),
		onStatus: (key) => { output.textContent = t(key); },
		onStop: (samples) => {
			start.disabled = false;
			try {
				if (samples.length) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, samples }));
			} catch { output.textContent = t('backup.storageError'); }
		},
	});
	const start = toolButton(form, 'timer.start', () => {
		if (recorder.start()) { predicted = currentPrediction(); start.disabled = true; }
	});
	toolButton(form, 'timer.stop', () => recorder.stop());
	toolButton(form, 'timer.load', () => {
		if (recorder.recording) return;
		try {
			const stored = parsePerformanceSession(localStorage.getItem(SESSION_STORAGE_KEY) ?? '');
			if (!stored) { output.textContent = t('timer.noSession'); return; }
			recorder.samples = stored;
			renderTimerResult(output, stored, currentPrediction());
		} catch { output.textContent = t('backup.storageError'); }
	});
	toolButton(form, 'timer.csv', () => downloadTextFile(performanceSessionCsv(recorder.samples), 'haguruma-run.csv', 'text/csv'));
	toolButton(form, 'timer.json', () => downloadTextFile(JSON.stringify({ schemaVersion: 1, samples: recorder.samples }), 'haguruma-run.json', 'application/json'));
	document.addEventListener('visibilitychange', () => { if (document.hidden) recorder.stop(); });
	window.addEventListener('pagehide', () => recorder.stop());
};

/**
 * @brief Compare indicative observed splits with the current model.
 * @param output Live output.
 * @param samples GPS trace.
 * @return void
 */
const renderTimerResult = (output: HTMLOutputElement, samples: PerformanceSample[], predicted: SimResult | null): void => {
	const measured = measurePerformanceSession(samples);
	output.textContent = `${t('timer.measured')}: 0–100 ${measured.time0To100S?.toFixed(2) ?? '—'} s · ¼ ${measured.quarterMileS?.toFixed(2) ?? '—'} s
${t('timer.predicted')}: 0–100 ${predicted?.time0To100S?.toFixed(2) ?? '—'} s · ¼ ${predicted?.quarterMileS?.toFixed(2) ?? '—'} s
${t('timer.caution')}`;
};

/**
 * @brief Snapshot the current simulation once per recording.
 * @param none No parameters.
 * @return Current modeled performance.
 */
const currentPrediction = (): SimResult | null => {
	const tire = parseTire(state.primaryTire);
	return tire ? simulateAcceleration({ massKg: state.vehicleMassKg, gears: state.gears, fd: state.primaryFd,
		circM: effectiveCircumferenceM(tire, state.rollingFactor), curve: activeEngineCurve(), drivetrainEff: state.drivetrainEff,
		runningGear: state.runningGear, dragCd: state.dragCd, frontalAreaM2: state.frontalAreaM2,
		rollingCrr: state.rollingCrr, shiftTimeS: state.shiftTimeS, roadGradePercent: state.roadGradePercent, ...state.simulation }) : null;
};
