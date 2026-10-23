/**
 * @file fitment-tool.ts
 * @brief Shell injection and live readout for the rim-channel fitment calculator.
 */
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';
import { state } from '../core/state/app-state';
import { parseTire } from '../core/math/tire-math';
import {
	classifyFitment,
	fitmentRatio,
	rimRangeForTire,
	tireRangeForRim,
	type FitmentKind,
} from '../core/math/fitment-math';
import { buildToolShell } from './card/accordion-shell';

/** Shared classes of the header verdict pill, hidden until a verdict exists. */
const PILL_BASE = 'ml-auto rounded-full border px-2 py-0.5 font-mono fs-tiny font-bold uppercase tracking-wider';

/** Dictionary key for the verdict label of each fitment kind. */
const FIT_TEXT: Record<FitmentKind, DictKey> = {
	balloon: 'fit.balloon',
	bulge: 'fit.bulge',
	square: 'fit.square',
	flush: 'fit.flush',
	stretch: 'fit.stretch',
};

/** Dictionary key for the advice line of each fitment kind. */
const FIT_TIP: Record<FitmentKind, DictKey> = {
	balloon: 'fit.tipBalloon',
	bulge: 'fit.tipBulge',
	square: 'fit.tipSquare',
	flush: 'fit.tipFlush',
	stretch: 'fit.tipStretch',
};

/** Pill tint per fitment kind: green square, cyan flush, amber bulge, red edges. */
const FIT_PILL: Record<FitmentKind, string> = {
	balloon: 'text-neon-red border-neon-red/40',
	bulge: 'text-neon-orange border-neon-orange/40',
	square: 'text-neon-green border-neon-green/40',
	flush: 'text-neon-cyan border-neon-cyan/40',
	stretch: 'text-neon-red border-neon-red/40',
};

/**
 * @brief Inject the fitment calculator shell into its mount point.
 * @brief Runs in bootstrap before refs resolve so ids exist on first paint.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectFitmentShell = (host: HTMLElement): void => {
	host.replaceChildren();
	const pill = document.createElement('span');
	pill.id = 'fit-pill';
	pill.className = `${PILL_BASE} hidden`;
	host.appendChild(buildToolShell({
		id: 'fitment',
		title: 'fit.title',
		note: 'fit.note',
		middle: pill,
		body: buildBody(),
	}));
	updateFitment();
};

/**
 * @brief Build the accordion body: the two inputs and the readout stack.
 * @return Body element ready to append to the section content.
 */
const buildBody = (): HTMLElement => {
	const section = document.createElement('div');
	section.className = 'flex flex-col gap-3';
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-2 gap-3';
	grid.append(buildTireInput(), buildRimInput());
	const out = document.createElement('div');
	out.id = 'fit-result';
	out.className = 'flex flex-col gap-1.5';
	section.append(grid, out);
	return section;
};

/**
 * @brief Build the tire-size text input bound to the live readout.
 * @return Column element holding label and input.
 */
const buildTireInput = (): HTMLElement => {
	const col = document.createElement('div');
	col.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', 'fit-tire');
	label.setAttribute('data-i18n', 'fit.tire');
	label.textContent = t('fit.tire');
	const input = document.createElement('input');
	input.type = 'text';
	input.id = 'fit-tire';
	input.value = state.primaryTire;
	input.autocomplete = 'off';
	input.spellcheck = false;
	input.className = 'w-full field-input field-input--md field-input--upper font-semibold';
	input.addEventListener('input', updateFitment);
	col.append(label, input);
	return col;
};

/**
 * @brief Build the rim-channel numeric input bound to the live readout.
 * @return Column element holding label, input and unit.
 */
const buildRimInput = (): HTMLElement => {
	const col = document.createElement('div');
	col.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', 'fit-rim');
	label.setAttribute('data-i18n', 'fit.rim');
	label.textContent = t('fit.rim');
	const wrap = document.createElement('div');
	wrap.className = 'relative';
	const input = document.createElement('input');
	input.type = 'number';
	input.id = 'fit-rim';
	input.inputMode = 'decimal';
	input.step = '0.5';
	input.min = '4';
	input.max = '14';
	input.value = '7.5';
	input.className = 'w-full field-input field-input--md pr-9 font-semibold';
	input.addEventListener('input', updateFitment);
	const unit = document.createElement('span');
	unit.className = 'field-unit';
	unit.textContent = 'J';
	wrap.append(input, unit);
	col.append(label, wrap);
	return col;
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
 * @brief Extract the section width in mm from a tire string.
 * @param raw Raw tire string such as 225/45R17.
 * @return Section width in mm, NaN when the format is invalid.
 */
const readTireWidth = (raw: string): number => {
	const parsed = parseTire(raw);
	return parsed ? parsed.width : NaN;
};

/**
 * @brief Recompute the channel recommendation and fitment verdict.
 * @brief Shows the ideal channel, the accepted window, the tire window for
 * @brief the entered rim and a balloon-to-stretch verdict pill with advice.
 * @return void
 */
export const updateFitment = (): void => {
	const out = document.getElementById('fit-result');
	const pill = document.getElementById('fit-pill');
	const tireEl = document.getElementById('fit-tire') as HTMLInputElement | null;
	const rimEl = document.getElementById('fit-rim') as HTMLInputElement | null;
	if (!out) {
		return;
	}
	if (tireEl && document.activeElement !== tireEl && tireEl.value !== state.primaryTire) {
		tireEl.value = state.primaryTire;
	}
	const width = readTireWidth(tireEl?.value ?? '');
	const rim = rimEl ? parseFloat(rimEl.value) : NaN;
	out.replaceChildren();
	const kind = classifyFitment(width, rim);
	const range = Number.isFinite(width) ? rimRangeForTire(width) : null;
	const tires = Number.isFinite(rim) ? tireRangeForRim(rim) : null;
	if (!kind || !range || !tires || !pill) {
		if (pill) {
			pill.classList.add('hidden');
		}
		const bad = document.createElement('div');
		bad.className = 'font-mono fs-base text-neon-red';
		bad.setAttribute('data-i18n', 'fit.invalid');
		bad.textContent = t('fit.invalid');
		out.appendChild(bad);
		return;
	}
	pill.className = `${PILL_BASE} ${FIT_PILL[kind]}`;
	pill.setAttribute('data-i18n', FIT_TEXT[kind]);
	pill.textContent = t(FIT_TEXT[kind]);
	const ratio = fitmentRatio(width, rim);
	out.appendChild(buildRow(t('fit.ideal'), `${range.ideal.toFixed(1)} J`));
	out.appendChild(buildRow(t('fit.range'), `${range.min.toFixed(1)}–${range.max.toFixed(1)} J`));
	out.appendChild(buildRow(t('fit.tireRange'), `${tires.min}–${tires.max} (${tires.ideal})`));
	out.appendChild(buildRow('Rim / tire', `${Math.round(ratio * 100)}%`));
	const tip = document.createElement('div');
	tip.className = 'font-mono fs-base text-text-dim leading-relaxed';
	tip.setAttribute('data-i18n', FIT_TIP[kind]);
	tip.textContent = t(FIT_TIP[kind]);
	out.appendChild(tip);
};
