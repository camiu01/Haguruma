/**
 * @file lap-sequence-tools.ts
 * @brief Explicit multi-phase simulation and numeric trajectory export.
 */
import { state } from '../core/state/app-state';
import { activeEngineCurve } from '../core/state/engine-curve';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { parseLapCommands, simulateLapSequence, type LapResult } from '../core/math/lap-sequence';
import { t } from '../core/i18n/language';
import { toolButton, toolNumber, toolOutput, toolSection, toolValue } from './tool-form';

const EXAMPLE = 'duration_s,gear,throttle,brake,rev_match,handbrake\n2,3,1,0,1,0\n2,4,1,0,1,0\n2,4,0,0.7,1,0\n2,3,0,0,1,0';

/**
 * @brief Describe the trajectory and all shift events without hidden hover information.
 * @param result Successful trajectory.
 * @return Localized numeric summary.
 */
const describeSequence = (result: LapResult): string => {
	const fmt = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 2 });
	const last = result.points[result.points.length - 1];
	return `${fmt.format(last.timeS)} s · ${fmt.format(last.distanceM)} m · ${fmt.format(last.speedKmh)} km/h\n`
		+ result.shifts.map((shift) => `${fmt.format(shift.timeS)} s · G${shift.fromGear} → G${shift.toGear} · `
			+ `${t('lab.revMatch')}: ${fmt.format(shift.targetRpm)} RPM · ${t('lap.blip')}: ${fmt.format(shift.blipRpm)} RPM`
			+ (shift.lockRisk ? ` · ${t('lab.wheelLock')}` : '')).join('\n') + '\n' + t('lap.caution');
};

/**
 * @brief Export a numeric, coordinate-free trajectory as local CSV.
 * @param result Last successful result.
 * @return void
 */
const exportSequence = (result: LapResult): void => {
	const text = 'time_s,distance_m,speed_kmh,engine_rpm,gear,accel_mps2\n'
		+ result.points.map((point) => [point.timeS, point.distanceM, point.speedKmh, point.rpm, point.gear, point.accelMps2].join(',')).join('\n');
	const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
	const link = document.createElement('a');
	link.href = url; link.download = 'haguruma-sequence.csv'; link.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * @brief Mount bounded pedal/gear phases with explicit simulation and export.
 * @param host Tools mount.
 * @return void
 */
export const injectLapSequenceTools = (host: HTMLElement): void => {
	const form = toolSection(host, 'lap.title');
	const speed = toolNumber(form, 'lap-speed', 'lab.speedKmh', 80, 0, 300);
	const bias = toolNumber(form, 'lap-bias', 'lab.brakeBias', 65, 0, 100);
	const label = document.createElement('label'); label.className = 'tool-wide-field';
	const caption = document.createElement('span');
	caption.dataset.i18n = 'lap.commands'; caption.textContent = t('lap.commands');
	const commands = document.createElement('textarea');
	commands.name = 'lap-commands'; commands.rows = 6; commands.maxLength = 8000;
	commands.autocomplete = 'off'; commands.spellcheck = false; commands.value = EXAMPLE;
	label.append(caption, commands); form.append(label);
	const output = toolOutput(form);
	let result: LapResult | null = null;
	const calculate = (abs: boolean): void => {
		result = null; save.disabled = true;
		const v = toolValue(speed); const front = toolValue(bias);
		const phases = parseLapCommands(commands.value); const tire = parseTire(state.primaryTire);
		commands.setAttribute('aria-invalid', String(!phases));
		if (v === null || front === null || !phases || !tire) {
			if (!phases) commands.focus();
			output.textContent = t('lap.invalid'); return;
		}
		result = simulateLapSequence({ massKg: state.vehicleMassKg, gears: [...state.gears], fd: state.primaryFd,
			circM: effectiveCircumferenceM(tire, state.rollingFactor), curve: activeEngineCurve(), drivetrainEff: state.drivetrainEff,
			runningGear: state.runningGear, dragCd: state.dragCd, frontalAreaM2: state.frontalAreaM2, rollingCrr: state.rollingCrr,
			roadGradePercent: state.roadGradePercent, rotatingMassKg: state.rotatingMassKg, shiftTimeS: state.shiftTimeS,
			...state.simulation }, v, phases, front / 100, abs);
		output.textContent = result.error ? t(result.error === 'overrev' ? 'lab.unsafeDownshift' : 'lap.invalid') : describeSequence(result);
		save.disabled = result.error !== null;
	};
	toolButton(form, 'lab.withAbs', () => calculate(true));
	toolButton(form, 'lab.withoutAbs', () => calculate(false));
	const save = toolButton(form, 'lap.export', () => { if (result && !result.error) exportSequence(result); });
	save.disabled = true;
	form.addEventListener('input', () => { result = null; save.disabled = true; });
};
