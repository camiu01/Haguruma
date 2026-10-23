/**
 * @file gear-lab-tool.ts
 * @brief Shell injection and live readout for the heuristic gear lab.
 * @brief Solves a gearset proposal from a Vmax target and a shift-drop
 * @brief limit, advises 2nd/3rd ratios per track archetype and imports a lap
 * @brief GPX to seed corner/straight lengths into the solver targets.
 */
import { t } from '../core/i18n/language';
import { state } from '../core/state/app-state';
import { primaryCircM } from '../core/state/dynamics-input';
import { optimizeGearset, type OptimizedGearset } from '../core/math/gear-optimizer';
import {
	adviseTrackGears,
	trackProfile,
	type TrackArchetype,
} from '../core/math/track-gear';
import { parseGpx, summarizeTrack, type TrackSummary } from '../core/math/gpx-track';
import { readFileText } from '../core/backup/state-backup';
import { buildToolShell } from './card/accordion-shell';

/** Last solved proposal feeding the apply button. */
let lastProposal: number[] | null = null;

/** Apply callback wired by bootstrap after refs resolve. */
let applyHook: ((ratios: number[]) => void) | null = null;

/**
 * @brief Inject the gear-lab shell into its mount point.
 * @brief Runs in bootstrap before refs resolve so ids exist on first paint.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectGearLabShell = (host: HTMLElement): void => {
	host.replaceChildren();
	host.appendChild(buildToolShell({
		id: 'gearlab',
		title: 'opt.title',
		note: 'opt.note',
		body: buildBody(),
	}));
	updateGearLab();
};

/**
 * @brief Wire the apply-to-primary callback.
 * @param onApply Callback receiving the solved ratios.
 * @return void
 */
export const bindGearLabApply = (onApply: (ratios: number[]) => void): void => {
	applyHook = onApply;
};

/**
 * @brief Build the accordion body: solver, archetype and GPX groups.
 * @return Body element ready to append to the section content.
 */
const buildBody = (): HTMLElement => {
	const body = document.createElement('div');
	body.className = 'flex flex-col gap-3';
	body.append(buildSolverGrid(), buildSolverRow());
	const result = document.createElement('div');
	result.id = 'opt-result';
	result.className = 'flex flex-col gap-1.5';
	body.append(result, buildArchRow());
	const arch = document.createElement('div');
	arch.id = 'opt-arch-result';
	arch.className = 'flex flex-col gap-1.5';
	body.append(arch, buildGpxRow());
	const gpx = document.createElement('div');
	gpx.id = 'opt-gpx-result';
	gpx.className = 'flex flex-col gap-1.5';
	body.appendChild(gpx);
	return body;
};

/**
 * @brief Build the three solver numeric inputs.
 * @return Grid element with count, Vmax and drop fields.
 */
const buildSolverGrid = (): HTMLElement => {
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-3 gap-2';
	grid.append(
		buildNum('opt-count', 'opt.count', '4', 2, 8, 1, ''),
		buildNum('opt-vmax', 'opt.vmax', '220', 60, 450, 5, ''),
		buildNum('opt-drop', 'opt.drop', '0.25', 0.05, 0.6, 0.01, ''),
	);
	return grid;
};

/**
 * @brief Build one labelled numeric input.
 * @param id Element id.
 * @param labelKey i18n key for the label.
 * @param value Default value.
 * @param min Native min.
 * @param max Native max.
 * @param step Native step.
 * @param unit Unit suffix, empty for none.
 * @return Column element holding label and input.
 */
const buildNum = (
	id: string,
	labelKey: 'opt.count' | 'opt.vmax' | 'opt.drop',
	value: string,
	min: number,
	max: number,
	step: number,
	unit: string,
): HTMLElement => {
	const col = document.createElement('div');
	col.className = 'flex flex-col gap-1';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', id);
	label.setAttribute('data-i18n', labelKey);
	label.textContent = t(labelKey);
	const wrap = document.createElement('div');
	wrap.className = 'relative';
	const input = document.createElement('input');
	input.type = 'number';
	input.id = id;
	input.value = value;
	input.min = String(min);
	input.max = String(max);
	input.step = String(step);
	input.inputMode = 'decimal';
	input.className = 'w-full field-input field-input--md pr-9 font-semibold';
	wrap.appendChild(input);
	if (unit) {
		const suffix = document.createElement('span');
		suffix.className = 'field-unit';
		suffix.textContent = unit;
		wrap.appendChild(suffix);
	}
	col.append(label, wrap);
	return col;
};

/**
 * @brief Build the solve/apply button row.
 * @return Row element.
 */
const buildSolverRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center gap-2';
	const run = document.createElement('button');
	run.type = 'button';
	run.className = 'btn btn--sm btn--mono';
	run.setAttribute('data-i18n', 'opt.run');
	run.textContent = t('opt.run');
	run.addEventListener('click', solveGearset);
	const apply = document.createElement('button');
	apply.type = 'button';
	apply.id = 'opt-apply';
	apply.className = 'btn btn--sm btn--solid hidden';
	apply.setAttribute('data-i18n', 'opt.apply');
	apply.textContent = t('opt.apply');
	apply.addEventListener('click', () => {
		if (lastProposal && applyHook) {
			applyHook(lastProposal);
		}
	});
	row.append(run, apply);
	return row;
};

/**
 * @brief Build the track-archetype select row.
 * @return Row element with label and select.
 */
const buildArchRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', 'opt-arch');
	label.setAttribute('data-i18n', 'opt.arch');
	label.textContent = t('opt.arch');
	const select = document.createElement('select');
	select.id = 'opt-arch';
	select.className = 'w-full field-input field-input--md font-semibold';
	const options: [TrackArchetype, 'opt.hairpin' | 'opt.balanced' | 'opt.fast'][] = [
		['hairpin', 'opt.hairpin'],
		['balanced', 'opt.balanced'],
		['fast', 'opt.fast'],
	];
	for (const [value, key] of options) {
		const option = document.createElement('option');
		option.value = value;
		option.setAttribute('data-i18n', key);
		option.textContent = t(key);
		select.appendChild(option);
	}
	select.value = 'balanced';
	select.addEventListener('change', updateGearLab);
	row.append(label, select);
	return row;
};

/**
 * @brief Build the GPX file import row.
 * @return Row element with label, file input and seed button.
 */
const buildGpxRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex flex-col gap-1';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', 'opt-gpx');
	label.setAttribute('data-i18n', 'opt.gpx');
	label.textContent = t('opt.gpx');
	const line = document.createElement('div');
	line.className = 'flex items-center gap-2';
	const input = document.createElement('input');
	input.type = 'file';
	input.id = 'opt-gpx';
	input.accept = '.gpx';
	input.className = 'field-input field-input--md fs-tiny';
	input.addEventListener('change', importGpx);
	const seed = document.createElement('button');
	seed.type = 'button';
	seed.id = 'opt-seed';
	seed.className = 'btn btn--sm btn--mono hidden';
	seed.setAttribute('data-i18n', 'opt.seed');
	seed.textContent = t('opt.seed');
	line.append(input, seed);
	const hint = document.createElement('p');
	hint.className = 'fs-tiny text-text-dim leading-relaxed';
	hint.setAttribute('data-i18n', 'opt.gpxHint');
	hint.textContent = t('opt.gpxHint');
	row.append(label, line, hint);
	return row;
};

/** Last GPX summary feeding the seed button. */
let lastGpx: TrackSummary | null = null;

/**
 * @brief Build one mono readout row (label left, value right).
 * @param label Text for the dimmed label.
 * @param value Text for the output value.
 * @param warn True to tint the value amber.
 * @return Row element.
 */
const buildRow = (label: string, value: string, warn: boolean = false): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center justify-between gap-2 font-mono fs-base';
	const left = document.createElement('span');
	left.className = 'text-text-dim';
	left.textContent = label;
	const right = document.createElement('span');
	right.className = `text-text-output tabular-nums text-right${warn ? ' text-neon-orange' : ''}`;
	right.textContent = value;
	row.append(left, right);
	return row;
};

/**
 * @brief Read one solver numeric field.
 * @param id Element id.
 * @param fallback Value on invalid input.
 * @return Field value or the fallback.
 */
const readNum = (id: string, fallback: number): number => {
	const el = document.getElementById(id) as HTMLInputElement | null;
	const value = el ? parseFloat(el.value) : NaN;
	return Number.isFinite(value) ? value : fallback;
};

/**
 * @brief Render the solved proposal into its container.
 * @param solved Solver output.
 * @return void
 */
const renderSolved = (solved: OptimizedGearset): void => {
	const out = document.getElementById('opt-result');
	const apply = document.getElementById('opt-apply');
	if (!out) {
		return;
	}
	out.replaceChildren();
	lastProposal = solved.ratios;
	apply?.classList.remove('hidden');
	out.appendChild(buildRow(`1–${solved.ratios.length}`, solved.ratios.map((ratio) => ratio.toFixed(2)).join(' · ')));
	out.appendChild(buildRow(t('opt.vmax'), `${solved.topSpeedKmh.toFixed(1)}`));
	if (!solved.withinLimits) {
		const warn = document.createElement('div');
		warn.className = 'font-mono fs-base text-neon-orange';
		warn.setAttribute('data-i18n', 'opt.over');
		warn.textContent = t('opt.over');
		out.appendChild(warn);
	}
};

/**
 * @brief Solve the gearset from the three numeric fields.
 * @return void
 */
const solveGearset = (): void => {
	const out = document.getElementById('opt-result');
	const solved = optimizeGearset({
		gearCount: Math.round(readNum('opt-count', 0)),
		redline: state.primaryRedline,
		circM: primaryCircM(),
		fd: state.primaryFd,
		targetTopSpeedKmh: readNum('opt-vmax', 0),
		maxDrop: readNum('opt-drop', 0),
	});
	if (!solved || !out) {
		lastProposal = null;
		document.getElementById('opt-apply')?.classList.add('hidden');
		if (out) {
			out.replaceChildren();
			const bad = document.createElement('div');
			bad.className = 'font-mono fs-base text-neon-red';
			bad.setAttribute('data-i18n', 'opt.invalid');
			bad.textContent = t('opt.invalid');
			out.appendChild(bad);
		}
		return;
	}
	renderSolved(solved);
};

/**
 * @brief Refresh the archetype advice from live state.
 * @brief Re-runs on every render so preset or tire changes stay honest.
 * @return void
 */
export const updateGearLab = (): void => {
	const select = document.getElementById('opt-arch') as HTMLSelectElement | null;
	const out = document.getElementById('opt-arch-result');
	if (!select || !out) {
		return;
	}
	out.replaceChildren();
	const advice = adviseTrackGears(select.value, state.peakTorqueRpm, state.primaryFd, primaryCircM());
	if (!advice) {
		const bad = document.createElement('div');
		bad.className = 'font-mono fs-base text-neon-red';
		bad.setAttribute('data-i18n', 'opt.invalid');
		bad.textContent = t('opt.invalid');
		out.appendChild(bad);
		return;
	}
	const profile = trackProfile(advice.archetype);
	out.appendChild(buildRow(`2nd · ${advice.second.toFixed(2)}`, `${advice.secondSpeedKmh.toFixed(0)}`));
	out.appendChild(buildRow(`3rd · ${advice.third.toFixed(2)}`, `${advice.thirdSpeedKmh.toFixed(0)}`));
	if (profile) {
		out.appendChild(buildRow(t('opt.straights'), `${profile.straightKmh.toFixed(0)}`));
	}
};

/**
 * @brief Import a GPX file and summarize its corners and straights.
 * @return void
 */
const importGpx = async (): Promise<void> => {
	const input = document.getElementById('opt-gpx') as HTMLInputElement | null;
	const out = document.getElementById('opt-gpx-result');
	const seed = document.getElementById('opt-seed');
	const file = input?.files?.[0];
	if (!file || !out) {
		return;
	}
	try {
		const points = parseGpx(await readFileText(file));
		const summary = points ? summarizeTrack(points) : null;
		lastGpx = summary;
		out.replaceChildren();
		if (!summary) {
			throw new Error('unusable gpx');
		}
		out.appendChild(buildRow(t('opt.straights'), `${summary.straights.length} · ${summary.longestStraightM} m`));
		out.appendChild(buildRow(t('opt.corners'), `${summary.corners.length}`));
		seed?.classList.remove('hidden');
		if (seed) {
			seed.onclick = (): void => seedFromGpx(summary);
		}
	} catch {
		lastGpx = null;
		seed?.classList.add('hidden');
		out.replaceChildren();
		const bad = document.createElement('div');
		bad.className = 'font-mono fs-base text-neon-red';
		bad.setAttribute('data-i18n', 'opt.invalid');
		bad.textContent = t('opt.invalid');
		out.appendChild(bad);
	}
};

/**
 * @brief Seed the solver Vmax from the longest GPX straight.
 * @brief Sizes top gear about 10% past the straight-limited speed.
 * @param summary GPX track summary.
 * @return void
 */
const seedFromGpx = (summary: TrackSummary): void => {
	const vmax = document.getElementById('opt-vmax') as HTMLInputElement | null;
	if (vmax && summary.longestStraightM > 0) {
		vmax.value = String(Math.round(summary.longestStraightM * 1.1));
		const status = document.getElementById('opt-result');
		if (status) {
			status.replaceChildren();
			const ok = document.createElement('div');
			ok.className = 'font-mono fs-base text-neon-green';
			ok.setAttribute('data-i18n', 'opt.applied');
			ok.textContent = t('opt.applied');
			status.appendChild(ok);
		}
	}
};
