/**
 * @file telemetry-tool.ts
 * @brief Shell injection and live readout for the telemetry gear check.
 * @brief Pastes MoTeC/AiM/RaceChrono/OBD2 CSV logs to recover real gear
 * @brief ratios with slip flags, and derives a torque curve from a
 * @brief single-gear pull for the engine CSV import.
 */
import { t } from '../core/i18n/language';
import { state } from '../core/state/app-state';
import { primaryCircM, primarySimInput } from '../core/state/dynamics-input';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import {
	estimateGearRatios,
	parseTelemetryCsv,
	type RecoveredGear,
} from '../core/math/telemetry-math';
import {
	recoveredPointsToCsv,
	torqueFromAccelLog,
	type AccelTraceSample,
	type RecoveredTorquePoint,
} from '../core/math/inverse-dyno';
import { buildToolShell } from './card/accordion-shell';

/** Sample header shipped in the CSV textarea. */
const SAMPLE_CSV = 'engine_rpm,wheel_speed_kmh\n3200,41.2\n4100,52.6\n5050,40.1';

/** Sample trace shipped in the pull textarea. */
const SAMPLE_TRACE = '0.0,40\n0.5,48\n1.0,56\n1.5,63\n2.0,70\n2.5,76';

/** Last recovered torque points feeding the copy button. */
let lastPoints: RecoveredTorquePoint[] = [];

/** Last seen CSV text, avoiding re-parse on unrelated renders. */
let lastCsv = '';

/** Last seen trace text, avoiding re-parse on unrelated renders. */
let lastTrace = '';

/**
 * @brief Inject the telemetry shell into its mount point.
 * @brief Runs in bootstrap before refs resolve so ids exist on first paint.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectTelemetryShell = (host: HTMLElement): void => {
	host.replaceChildren();
	host.appendChild(buildToolShell({
		id: 'telemetry',
		title: 'tele.title',
		note: 'tele.note',
		body: buildBody(),
	}));
	syncGearSelect();
	updateTelemetry();
};

/**
 * @brief Build the accordion body: CSV log section plus inverse-dyno section.
 * @return Body element ready to append to the section content.
 */
const buildBody = (): HTMLElement => {
	const body = document.createElement('div');
	body.className = 'flex flex-col gap-3';
	body.append(buildHint('tele.hint'), buildArea('tele-csv', 'tele.csv', SAMPLE_CSV));
	const gears = document.createElement('div');
	gears.id = 'tele-gears';
	gears.className = 'flex flex-col gap-1.5';
	body.appendChild(gears);
	body.append(buildSubTitle('tele.invTitle'), buildHint('tele.invHint'), buildGearRow(), buildArea('tele-trace', 'tele.vtrace', SAMPLE_TRACE));
	const dyno = document.createElement('div');
	dyno.id = 'tele-dyno';
	dyno.className = 'flex flex-col gap-1.5';
	body.append(dyno, buildCopyRow());
	return body;
};

/**
 * @brief Build one muted hint paragraph tagged for i18n.
 * @param key Dictionary key for the hint copy.
 * @return Paragraph element.
 */
const buildHint = (key: 'tele.hint' | 'tele.invHint'): HTMLElement => {
	const hint = document.createElement('p');
	hint.className = 'fs-tiny text-text-dim leading-relaxed';
	hint.setAttribute('data-i18n', key);
	hint.textContent = t(key);
	return hint;
};

/**
 * @brief Build one subsection caption.
 * @param key Dictionary key for the caption copy.
 * @return Caption element.
 */
const buildSubTitle = (key: 'tele.invTitle'): HTMLElement => {
	const title = document.createElement('h3');
	title.className = 'font-mono fs-tiny uppercase tracking-wider text-text-muted';
	title.setAttribute('data-i18n', key);
	title.textContent = t(key);
	return title;
};

/**
 * @brief Build one labelled mono textarea bound to the live readout.
 * @param id Textarea element id.
 * @param labelKey i18n key for the label.
 * @param sample Shipped sample text.
 * @return Column element holding label and textarea.
 */
const buildArea = (id: string, labelKey: 'tele.csv' | 'tele.vtrace', sample: string): HTMLElement => {
	const col = document.createElement('div');
	col.className = 'flex flex-col gap-1';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', id);
	label.setAttribute('data-i18n', labelKey);
	label.textContent = t(labelKey);
	const area = document.createElement('textarea');
	area.id = id;
	area.rows = 4;
	area.spellcheck = false;
	area.value = sample;
	area.className = 'w-full field-input field-input--md font-mono fs-base';
	area.addEventListener('input', updateTelemetry);
	col.append(label, area);
	return col;
};

/**
 * @brief Build the pull-gear select row.
 * @return Row element with label and select.
 */
const buildGearRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', 'tele-gear');
	label.setAttribute('data-i18n', 'tele.invGear');
	label.textContent = t('tele.invGear');
	const select = document.createElement('select');
	select.id = 'tele-gear';
	select.className = 'w-full field-input field-input--md font-semibold';
	select.addEventListener('change', updateTelemetry);
	row.append(label, select);
	return row;
};

/**
 * @brief Build the copy-CSV button row with its status line.
 * @return Row element.
 */
const buildCopyRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center gap-2';
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.id = 'tele-copy';
	btn.className = 'btn btn--sm btn--mono';
	btn.setAttribute('data-i18n', 'tele.copy');
	btn.textContent = t('tele.copy');
	btn.addEventListener('click', copyDynoCsv);
	const status = document.createElement('span');
	status.id = 'tele-status';
	status.className = 'font-mono fs-tiny text-text-dim';
	row.append(btn, status);
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
 * @brief Sync the pull-gear select with the primary gearbox.
 * @brief Rebuilds options only when the gear count changed.
 * @return void
 */
const syncGearSelect = (): void => {
	const select = document.getElementById('tele-gear') as HTMLSelectElement | null;
	if (!select || select.options.length === state.gears.length) {
		return;
	}
	select.replaceChildren();
	state.gears.forEach((ratio, idx) => {
		const option = document.createElement('option');
		option.value = String(idx);
		option.textContent = `${idx + 1} (${ratio.toFixed(2)})`;
		select.appendChild(option);
	});
	select.value = String(Math.min(2, state.gears.length - 1));
};

/**
 * @brief Render the recovered gear list into its container.
 * @param gears Recovered gears shortest-first.
 * @return void
 */
const renderGears = (gears: RecoveredGear[]): void => {
	const out = document.getElementById('tele-gears');
	if (!out) {
		return;
	}
	out.replaceChildren();
	out.appendChild(buildRow(`${t('tele.gear')} / ${t('tele.ratio')}`, `${t('tele.samples')} / ${t('tele.slip')}`));
	for (const gear of gears) {
		const warn = gear.slipPct > 5 ? ' text-neon-orange' : '';
		const row = buildRow(`${gear.gear} · ${gear.ratio.toFixed(3)}`, `${gear.samples} · ${gear.slipPct.toFixed(1)}%`);
		if (warn) {
			(row.lastChild as HTMLElement).className += warn;
		}
		out.appendChild(row);
	}
};

/**
 * @brief Parse the speed trace textarea into samples.
 * @param raw Raw textarea text.
 * @return Samples, or null when fewer than two rows parse.
 */
const parseTrace = (raw: string): AccelTraceSample[] | null => {
	const rows = raw.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
	const out: AccelTraceSample[] = [];
	for (const row of rows) {
		const cells = row.split(/[;,\t]/).map((cell) => cell.trim());
		if (cells.length < 2) {
			continue;
		}
		const time = parseFloat(cells[0].replace(',', '.'));
		const speed = parseFloat(cells[1].replace(',', '.'));
		if (Number.isFinite(time) && Number.isFinite(speed) && speed > 0) {
			out.push({ t: time, speedKmh: speed });
		}
	}
	return out.length >= 2 ? out : null;
};

/**
 * @brief Render the recovered torque points into their container.
 * @param points Recovered torque points sorted by rpm.
 * @return void
 */
const renderDyno = (points: RecoveredTorquePoint[]): void => {
	const out = document.getElementById('tele-dyno');
	if (!out) {
		return;
	}
	out.replaceChildren();
	for (const point of points) {
		out.appendChild(buildRow(`${point.rpm} rpm`, `${point.torqueNm.toFixed(1)} Nm`));
	}
};

/**
 * @brief Show the invalid-log notice in one result container.
 * @param id Container id.
 * @return void
 */
const renderInvalid = (id: string): void => {
	const out = document.getElementById(id);
	if (!out) {
		return;
	}
	out.replaceChildren();
	const bad = document.createElement('div');
	bad.className = 'font-mono fs-base text-neon-red';
	bad.setAttribute('data-i18n', 'tele.invalid');
	bad.textContent = t('tele.invalid');
	out.appendChild(bad);
};

/**
 * @brief Recompute the gear recovery and inverse dyno from both textareas.
 * @brief Skips work when neither text changed since the last pass.
 * @return void
 */
export const updateTelemetry = (): void => {
	const csvEl = document.getElementById('tele-csv') as HTMLTextAreaElement | null;
	const traceEl = document.getElementById('tele-trace') as HTMLTextAreaElement | null;
	const gearEl = document.getElementById('tele-gear') as HTMLSelectElement | null;
	if (!csvEl || !traceEl) {
		return;
	}
	syncGearSelect();
	const csvText = csvEl.value;
	if (csvText !== lastCsv) {
		lastCsv = csvText;
		const tire = parseTire(state.primaryTire);
		const circ = tire ? effectiveCircumferenceM(tire, state.rollingFactor) : 0;
		const samples = parseTelemetryCsv(csvText);
		const gears = samples ? estimateGearRatios(samples, circ) : null;
		if (gears) {
			renderGears(gears);
		} else {
			renderInvalid('tele-gears');
		}
	}
	const traceText = traceEl.value;
	const gearIdx = gearEl ? parseInt(gearEl.value, 10) : 2;
	if (traceText !== lastTrace || gearIdx !== updateTelemetryGear) {
		updateTelemetryGear = gearIdx;
		lastTrace = traceText;
		const trace = parseTrace(traceText);
		const input = primarySimInput();
		const points = trace ? torqueFromAccelLog(trace, {
			massKg: input.massKg ?? 0,
			gearRatio: state.gears[gearIdx] ?? 1,
			fd: state.primaryFd,
			circM: primaryCircM(),
			cd: input.dragCd ?? 0,
			areaM2: input.frontalAreaM2 ?? 0,
			crr: input.rollingCrr ?? 0,
			eff: state.drivetrainEff,
		}) : null;
		lastPoints = points ?? [];
		if (points) {
			renderDyno(points);
		} else {
			renderInvalid('tele-dyno');
		}
	}
};

/** Pull-gear index used by the last inverse-dyno pass. */
let updateTelemetryGear = -1;

/**
 * @brief Copy the recovered dyno CSV to the clipboard.
 * @return void
 */
const copyDynoCsv = (): void => {
	const status = document.getElementById('tele-status');
	const text = recoveredPointsToCsv(lastPoints);
	if (!text || lastPoints.length === 0) {
		return;
	}
	const done = (): void => {
		if (status) {
			status.textContent = t('tele.copied');
		}
	};
	if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
		navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
	} else {
		fallbackCopy(text, done);
	}
};

/**
 * @brief Copy text through a temporary textarea.
 * @param text Text to copy.
 * @param done Callback on success.
 * @return void
 */
const fallbackCopy = (text: string, done: () => void): void => {
	const area = document.createElement('textarea');
	area.value = text;
	document.body.appendChild(area);
	area.select();
	try {
		document.execCommand('copy');
		done();
	} catch {
		return;
	} finally {
		area.remove();
	}
};
