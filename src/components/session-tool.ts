/**
 * @file session-tool.ts
 * @brief Shell injection and live readout for sessions and the phone timer.
 * @brief Samples GPS speed into standing-start splits, compares them against
 * @brief the solver prediction, logs runs locally with CSV/JSON export for
 * @brief MoTeC/AiM tooling and hosts the keep-screen-awake toggle.
 */
import { t } from '../core/i18n/language';
import { state } from '../core/state/app-state';
import { primaryCircM, primarySimInput } from '../core/state/dynamics-input';
import { simulateAcceleration } from '../core/math/accel-math';
import { splitsFromSpeedSeries, type PhoneSplits, type SpeedTraceSample } from '../core/math/timer-math';
import {
	deleteSession,
	loadSessions,
	saveSession,
	sessionsToCsv,
	sessionsToJson,
	type SessionRun,
} from '../core/telemetry/session-store';
import { acquireWakeLock, isWakeLockSupported, releaseWakeLock } from '../services/wake-lock';
import { downloadTextFile } from '../core/backup/state-backup';
import { buildToolShell } from './card/accordion-shell';

/** Active GPS watch id, null when the timer is idle. */
let watchId: number | null = null;

/** GPS samples of the running attempt. */
let attempt: SpeedTraceSample[] = [];

/** Timestamp of the first GPS fix in ms. */
let attemptStart = 0;

/** Last phone splits shown and saved. */
let lastSplits: PhoneSplits | null = null;

/** Signature of the last painted run list. */
let lastRunsKey = '';

/**
 * @brief Inject the session shell into its mount point.
 * @brief Runs in bootstrap before refs resolve so ids exist on first paint.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectSessionShell = (host: HTMLElement): void => {
	host.replaceChildren();
	host.appendChild(buildToolShell({
		id: 'session',
		title: 'sess.title',
		note: 'sess.note',
		body: buildBody(),
	}));
	renderSessionList();
};

/**
 * @brief Build the accordion body: timer, save row, runs and awake toggle.
 * @return Body element ready to append to the section content.
 */
const buildBody = (): HTMLElement => {
	const body = document.createElement('div');
	body.className = 'flex flex-col gap-3';
	body.append(buildTimerRow());
	const live = document.createElement('div');
	live.id = 'sess-live';
	live.className = 'font-mono fs-base text-text-dim';
	live.setAttribute('aria-live', 'polite');
	body.append(live);
	const result = document.createElement('div');
	result.id = 'sess-result';
	result.className = 'flex flex-col gap-1.5';
	body.append(result, buildSaveRow());
	const runs = document.createElement('div');
	runs.id = 'sess-runs';
	runs.className = 'flex flex-col gap-1.5';
	body.append(runs, buildExportRow(), buildAwakeRow());
	return body;
};

/**
 * @brief Build the GPS start/stop button.
 * @return Row element.
 */
const buildTimerRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center gap-2';
	const toggle = document.createElement('button');
	toggle.type = 'button';
	toggle.id = 'sess-toggle';
	toggle.className = 'btn btn--sm btn--mono';
	toggle.setAttribute('data-i18n', 'sess.start');
	toggle.textContent = t('sess.start');
	toggle.addEventListener('click', toggleTimer);
	row.appendChild(toggle);
	return row;
};

/**
 * @brief Build the run-name input plus save button.
 * @return Row element.
 */
const buildSaveRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'grid grid-cols-2 gap-2';
	const col = document.createElement('div');
	col.className = 'flex flex-col gap-1';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', 'sess-name');
	label.setAttribute('data-i18n', 'sess.name');
	label.textContent = t('sess.name');
	const input = document.createElement('input');
	input.type = 'text';
	input.id = 'sess-name';
	input.className = 'w-full field-input field-input--md font-semibold';
	col.append(label, input);
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'btn btn--sm btn--solid self-end';
	btn.setAttribute('data-i18n', 'sess.save');
	btn.textContent = t('sess.save');
	btn.addEventListener('click', storeRun);
	row.append(col, btn);
	return row;
};

/**
 * @brief Build the CSV/JSON export buttons.
 * @return Row element.
 */
const buildExportRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center gap-2';
	for (const [id, key] of [['sess-csv', 'sess.csv'], ['sess-json', 'sess.json']] as const) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.id = id;
		btn.className = 'btn btn--sm btn--mono';
		btn.setAttribute('data-i18n', key);
		btn.textContent = t(key);
		btn.addEventListener('click', () => exportRuns(id === 'sess-csv' ? 'csv' : 'json'));
		row.appendChild(btn);
	}
	return row;
};

/**
 * @brief Build the keep-awake checkbox row.
 * @return Row element, hidden when the API is unavailable.
 */
const buildAwakeRow = (): HTMLElement => {
	const row = document.createElement('label');
	row.className = 'flex items-center gap-2 font-mono fs-base text-text-dim';
	if (!isWakeLockSupported()) {
		row.className += ' hidden';
	}
	const box = document.createElement('input');
	box.type = 'checkbox';
	box.id = 'sess-awake';
	box.className = 'w-4 h-4';
	box.addEventListener('change', () => {
		if (box.checked) {
			acquireWakeLock().then((held) => {
				box.checked = held;
			});
		} else {
			releaseWakeLock();
		}
	});
	const text = document.createElement('span');
	text.setAttribute('data-i18n', 'sess.awake');
	text.textContent = t('sess.awake');
	row.append(box, text);
	return row;
};

/**
 * @brief Build one mono readout row (label left, value right).
 * @param label Text for the dimmed label.
 * @param value Text for the output value.
 * @return Row element.
 */
const buildRow = (label: string, value: string): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center justify-between gap-2 font-mono fs-base';
	const left = document.createElement('span');
	left.className = 'text-text-dim';
	left.textContent = label;
	const right = document.createElement('span');
	right.className = 'text-text-output tabular-nums text-right';
	right.textContent = value;
	row.append(left, right);
	return row;
};

/**
 * @brief Start or stop the GPS timer.
 * @return void
 */
const toggleTimer = (): void => {
	if (watchId !== null) {
		stopTimer();
		return;
	}
	if (!('geolocation' in navigator)) {
		paintLive(t('sess.nogps'));
		return;
	}
	attempt = [];
	attemptStart = 0;
	lastSplits = null;
	watchId = navigator.geolocation.watchPosition(onFix, () => paintLive(t('sess.nogps')), {
		enableHighAccuracy: true,
		maximumAge: 0,
	});
	paintToggle(true);
};

/**
 * @brief Record one GPS fix into the running attempt.
 * @param position Geolocation fix.
 * @return void
 */
const onFix = (position: GeolocationPosition): void => {
	const speedMs = position.coords.speed;
	if (speedMs === null || !Number.isFinite(speedMs) || speedMs < 0) {
		return;
	}
	const now = performance.now();
	if (attemptStart === 0) {
		attemptStart = now;
	}
	attempt.push({ t: (now - attemptStart) / 1000, speedKmh: speedMs * 3.6 });
	paintLive(`${t('sess.live')}: ${(speedMs * 3.6).toFixed(1)}`);
};

/**
 * @brief Stop the GPS watch and score the attempt.
 * @return void
 */
const stopTimer = (): void => {
	if (watchId !== null) {
		navigator.geolocation.clearWatch(watchId);
		watchId = null;
	}
	paintToggle(false);
	lastSplits = splitsFromSpeedSeries(attempt);
	renderSplits(lastSplits);
};

/**
 * @brief Paint the timer toggle label for its running state.
 * @param running True while GPS sampling is active.
 * @return void
 */
const paintToggle = (running: boolean): void => {
	const toggle = document.getElementById('sess-toggle');
	if (!toggle) {
		return;
	}
	toggle.setAttribute('data-i18n', running ? 'sess.stop' : 'sess.start');
	toggle.textContent = t(running ? 'sess.stop' : 'sess.start');
};

/**
 * @brief Paint one live status line.
 * @param text Line text.
 * @return void
 */
const paintLive = (text: string): void => {
	const live = document.getElementById('sess-live');
	if (live) {
		live.textContent = text;
	}
};

/**
 * @brief Format one nullable split.
 * @param value Split value.
 * @param unit Unit suffix.
 * @return Text with two decimals or an em dash.
 */
const fmtSplit = (value: number | null, unit: string): string => {
	return value === null ? '—' : `${value.toFixed(2)} ${unit}`;
};

/**
 * @brief Render phone splits plus the solver prediction.
 * @param splits Phone splits from the attempt.
 * @return void
 */
const renderSplits = (splits: PhoneSplits): void => {
	const out = document.getElementById('sess-result');
	if (!out) {
		return;
	}
	out.replaceChildren();
	out.appendChild(buildRow('0–100', fmtSplit(splits.time0To100S, 's')));
	out.appendChild(buildRow('0–60 mph', fmtSplit(splits.time0To60S, 's')));
	out.appendChild(buildRow('1/4 mile', fmtSplit(splits.quarterS, 's')));
	try {
		const predicted = simulateAcceleration({ ...primarySimInput(), circM: primaryCircM() });
		const solver = predicted.time0To100S === null ? '—' : `${predicted.time0To100S.toFixed(2)} s`;
		out.appendChild(buildRow(t('sess.compare'), solver));
	} catch {
		return;
	}
};

/**
 * @brief Resolve the active preset name for the run log.
 * @return Selected preset label or a generic fallback.
 */
const activePresetName = (): string => {
	const select = document.getElementById('preset-selector') as HTMLSelectElement | null;
	const option = select?.selectedOptions[0];
	return option?.textContent?.trim() || 'custom';
};

/**
 * @brief Store the current solver run, preferring phone splits when present.
 * @return void
 */
const storeRun = (): void => {
	const nameEl = document.getElementById('sess-name') as HTMLInputElement | null;
	const name = nameEl?.value.trim() || new Date().toLocaleString();
	let time0To100S: number | null = null;
	let quarterS: number | null = null;
	let trapKmh: number | null = null;
	if (lastSplits && lastSplits.time0To100S !== null) {
		time0To100S = lastSplits.time0To100S;
		quarterS = lastSplits.quarterS;
		trapKmh = lastSplits.trapKmh;
	} else {
		try {
			const predicted = simulateAcceleration({ ...primarySimInput(), circM: primaryCircM() });
			time0To100S = predicted.time0To100S;
			quarterS = predicted.quarterMileS;
			trapKmh = predicted.trapSpeedKmh;
		} catch {
			return;
		}
	}
	saveSession({ name, presetName: activePresetName(), time0To100S, quarterS, trapKmh, note: '' });
	if (nameEl) {
		nameEl.value = '';
	}
	renderSessionList();
};

/**
 * @brief Export logged runs as a CSV or JSON download.
 * @param format Export format.
 * @return void
 */
const exportRuns = (format: 'csv' | 'json'): void => {
	const runs = loadSessions();
	if (runs.length === 0) {
		return;
	}
	const stamp = new Date().toISOString().slice(0, 10);
	if (format === 'csv') {
		downloadTextFile(`haguruma-sessions-${stamp}.csv`, sessionsToCsv(runs), 'text/csv');
	} else {
		downloadTextFile(`haguruma-sessions-${stamp}.json`, sessionsToJson(runs));
	}
};

/**
 * @brief Repaint the logged run list with delete buttons.
 * @brief Skips work when the run signature is unchanged.
 * @return void
 */
export const renderSessionList = (): void => {
	const out = document.getElementById('sess-runs');
	if (!out) {
		return;
	}
	const runs = loadSessions();
	const key = runs.map((run) => run.id).join('|');
	if (key === lastRunsKey && out.childElementCount > 0) {
		return;
	}
	lastRunsKey = key;
	out.replaceChildren();
	const title = document.createElement('div');
	title.className = 'font-mono fs-tiny uppercase tracking-wider text-text-muted';
	title.setAttribute('data-i18n', 'sess.runs');
	title.textContent = t('sess.runs');
	out.appendChild(title);
	if (runs.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'font-mono fs-base text-text-dim';
		empty.setAttribute('data-i18n', 'sess.empty');
		empty.textContent = t('sess.empty');
		out.appendChild(empty);
		return;
	}
	for (const run of runs) {
		out.appendChild(buildRunRow(run));
	}
};

/**
 * @brief Build one run row with its delete button.
 * @param run Logged session run.
 * @return Row element.
 */
const buildRunRow = (run: SessionRun): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center justify-between gap-2 font-mono fs-base';
	const left = document.createElement('span');
	left.className = 'text-text-output truncate';
	left.textContent = `${run.name} · ${run.time0To100S === null ? '—' : `${run.time0To100S.toFixed(2)} s`}`;
	const del = document.createElement('button');
	del.type = 'button';
	del.className = 'text-btn text-btn--danger fs-tiny';
	del.setAttribute('data-i18n', 'sess.delete');
	del.textContent = t('sess.delete');
	del.addEventListener('click', () => {
		deleteSession(run.id);
		lastRunsKey = '';
		renderSessionList();
	});
	row.append(left, del);
	return row;
};
