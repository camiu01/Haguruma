/**
 * @file dynamics-tool.ts
 * @brief Stopping KPIs, apex advice and user-editable lap-sequence telemetry.
 */
import { buildToolShell } from './card/accordion-shell';
import { injectDynamicsControls, syncDynamicsControls } from './dynamics-controls';
import { state } from '../core/state/app-state';
import { primaryBrakingInput, primaryCircM, primarySimInput } from '../core/state/dynamics-input';
import { activeEngineCurve } from '../core/state/engine-curve';
import { adviseApexGear } from '../core/math/corner-advisor';
import { parseLapCommands, simulateLapSequence } from '../core/math/lap-sequence';
import { currentBrakeProfiles } from '../services/graph/dynamics-graph';
import { toDisplaySpeed } from '../core/math/speed-math';
import { getUnitLabel } from '../core/units/unit-utils';
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';

const READOUTS: [string, DictKey][] = [
	['dynamics-stop100', 'dynamics.stop100'], ['dynamics-stop200', 'dynamics.stop200'],
	['dynamics-apex', 'dynamics.apex'], ['dynamics-lap', 'dynamics.lapResult'],
];
let sequenceKey = '';
let sequenceResult: ReturnType<typeof simulateLapSequence> = null;

/**
 * @brief Inject the self-contained dynamics accordion before refs and binding.
 * @param mount Tool mount.
 * @return void
 */
export const injectDynamicsShell = (mount: HTMLElement): void => {
	const body = document.createElement('div');
	body.className = 'dynamics-grid';
	injectDynamicsControls(body);
	for (const [id, key] of READOUTS) {
		const row = document.createElement('div');
		row.className = 'dynamics-readout dynamics-wide';
		const label = document.createElement('span');
		label.dataset.i18n = key;
		label.textContent = t(key);
		const value = document.createElement('output');
		value.id = id;
		row.append(label, value);
		body.append(row);
	}
	const note = document.createElement('p');
	note.className = 'mono-note dynamics-wide';
	note.dataset.i18n = 'dynamics.modelNote';
	note.textContent = t('dynamics.modelNote');
	body.append(note);
	mount.append(buildToolShell({ id: 'dynamics', title: 'dynamics.title', body }));
};

/**
 * @brief Write an optional output node through textContent.
 * @param id Readout id.
 * @param value Formatted readout.
 * @return void
 */
const write = (id: string, value: string): void => {
	const output = document.getElementById(id);
	if (output) output.textContent = value;
};

/**
 * @brief Render apex speed and a pre-corner gear recommendation.
 * @return void
 */
const renderApex = (): void => {
	const d = state.dynamics;
	const advice = adviseApexGear(d.cornerRadiusM, d.cornerMaxG, state.gears, state.primaryFd,
		primaryCircM(), activeEngineCurve(), Math.min(state.gears.length, d.approachGear) - 1,
		state.drivetrainEff, state.runningGear, d.efficiencyMap);
	write('dynamics-apex', advice ? `${toDisplaySpeed(advice.speedKmh, state.unit).toFixed(1)} ${getUnitLabel(state.unit)} · `
		+ `${t(`dynamics.${advice.action}`)} ${advice.gearIndex + 1} · ${Math.round(advice.rpm)} rpm` : '—');
};

/**
 * @brief Simulate user commands only when physical inputs or commands change.
 * @return void
 */
const renderSequence = (): void => {
	const input = primarySimInput();
	const brakes = primaryBrakingInput();
	const d = state.dynamics;
	const commands = parseLapCommands(d.sequenceCsv, d.revMatch);
	const key = JSON.stringify([input, brakes, commands, d.sequenceSpeedKmh]);
	if (key !== sequenceKey) {
		sequenceKey = key;
		sequenceResult = commands ? simulateLapSequence(input, commands, d.sequenceSpeedKmh, brakes) : null;
	}
	const field = document.getElementById('dynamics-sequenceCsv');
	field?.setAttribute('aria-invalid', String(!sequenceResult));
	if (!sequenceResult?.length) {
		write('dynamics-lap', t('dynamics.invalidSequence'));
		return;
	}
	const last = sequenceResult[sequenceResult.length - 1];
	const blip = Math.max(...sequenceResult.map((s) => s.blipRpm));
	const lock = sequenceResult.some((s) => s.coastLock);
	write('dynamics-lap', `${last.timeS.toFixed(2)} s · ${last.distanceM.toFixed(1)} m · `
		+ `${toDisplaySpeed(last.speedKmh, state.unit).toFixed(1)} ${getUnitLabel(state.unit)} · `
		+ `${t('dynamics.blip')} +${Math.round(blip)} rpm${lock ? ` · ${t('dynamics.coastLock')}` : ''}`);
};

/**
 * @brief Refresh stopping metrics, settings and simulation readouts.
 * @return void
 */
export const renderDynamics = (): void => {
	syncDynamicsControls();
	const profiles = currentBrakeProfiles();
	for (let i = 0; i < profiles.length; i += 1) {
		const p = profiles[i];
		write(i === 0 ? 'dynamics-stop100' : 'dynamics-stop200',
			p.distanceM === null ? '—' : `${p.distanceM.toFixed(1)} m · ${p.timeS!.toFixed(2)} s`
				+ (p.maxLockedWheels ? ` · ${t('dynamics.wheelLock')} ${p.maxLockedWheels}` : ''));
	}
	renderApex();
	renderSequence();
};
