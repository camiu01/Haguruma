/**
 * @file tire-size-tool.ts
 * @brief Shell injection and live readout for the tire plus-size comparator.
 */
import { t } from '../core/i18n/language';
import { state } from '../core/state/app-state';
import { parseTire } from '../core/math/tire-math';
import { buildToolShell } from './card/accordion-shell';

/** Absolute delta % rated a good match (no gearing or ABS concerns). */
const DELTA_OK = 1.5;

/** Absolute delta % above which the size is out of range. */
const DELTA_BAD = 3;

/** Indicated speeds used for the speedometer check. */
const SPEEDO_SPOTS = [50, 100, 130];

/** Shared classes of the header verdict pill, hidden until a verdict exists. */
const PILL_BASE = 'ml-auto rounded-full border px-2 py-0.5 font-mono fs-tiny font-bold uppercase tracking-wider';

/** Parsed pair driving every readout row. */
interface TirePair {
	/** Stock geometry. */
	stock: { size: string; diameterMm: number; sidewallMm: number; circMm: number };
	/** New geometry. */
	next: { size: string; diameterMm: number; sidewallMm: number; circMm: number };
	/** Circumference delta percent (new vs stock). */
	deltaPct: number;
}

/**
 * @brief Inject the tire-size comparator shell into its mount point.
 * @brief Runs in bootstrap before refs resolve so ids exist on first paint.
 * @brief The tool owns its card chrome and accordion header because the
 * @brief sidebar hands out bare mount cells.
 * @brief The verdict pill keeps id 'tiresize-pill' because updateTireSize()
 * @brief repaints it on every input change.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectTireSizeShell = (host: HTMLElement): void => {
	host.replaceChildren();
	const pill = document.createElement('span');
	pill.id = 'tiresize-pill';
	pill.className = `${PILL_BASE} hidden`;
	host.appendChild(buildToolShell({
		id: 'tiresize',
		title: 'tiretool.title',
		middle: pill,
		body: buildBody(),
	}));
	updateTireSize();
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
	grid.append(buildInput('tiresize-stock', 'tiretool.stock', '205/55R16'), buildInput('tiresize-new', 'tiretool.new', '225/45R17'));
	const out = document.createElement('div');
	out.id = 'tiresize-result';
	out.className = 'flex flex-col gap-1.5';
	section.append(grid, out);
	return section;
};

/**
 * @brief Build one labeled tire-size text input with live readout binding.
 * @param id Input element id.
 * @param labelKey i18n key for the label.
 * @param value Default tire string.
 * @return Column element holding label and input.
 */
const buildInput = (id: string, labelKey: 'tiretool.stock' | 'tiretool.new', value: string): HTMLElement => {
	const col = document.createElement('div');
	col.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', id);
	label.setAttribute('data-i18n', labelKey);
	label.textContent = t(labelKey);
	const input = document.createElement('input');
	input.type = 'text';
	input.id = id;
	input.value = value;
	input.autocomplete = 'off';
	input.spellcheck = false;
	input.className =
		'w-full field-input field-input--md field-input--upper font-semibold';
	input.addEventListener('input', updateTireSize);
	col.append(label, input);
	return col;
};

/**
 * @brief Verdict text/border classes for a circumference delta.
 * @param absDelta Absolute delta percent.
 * @return Neon pill classes.
 */
const verdictClass = (absDelta: number): string => {
	if (absDelta <= DELTA_OK) {
		return 'text-neon-green border-neon-green/40';
	}
	if (absDelta <= DELTA_BAD) {
		return 'text-neon-orange border-neon-orange/40';
	}
	return 'text-neon-red border-neon-red/40';
};

/**
 * @brief Verdict label key for a circumference delta.
 * @param absDelta Absolute delta percent.
 * @return i18n key for the pill text.
 */
const verdictKey = (absDelta: number): 'tiretool.ok' | 'tiretool.warn' | 'tiretool.bad' => {
	if (absDelta <= DELTA_OK) {
		return 'tiretool.ok';
	}
	if (absDelta <= DELTA_BAD) {
		return 'tiretool.warn';
	}
	return 'tiretool.bad';
};

/**
 * @brief Parse both inputs into comparable geometry.
 * @param stockRaw Stock tire string.
 * @param nextRaw New tire string.
 * @return Pair with delta, or null when either side is invalid.
 */
const parsePair = (stockRaw: string, nextRaw: string): TirePair | null => {
	const a = parseTire(stockRaw);
	const b = parseTire(nextRaw);
	if (!a || !b || a.circumferenceM <= 0) {
		return null;
	}
	const side = (width: number, aspect: number): number => (width * aspect) / 100;
	return {
		stock: { size: stockRaw.trim().toUpperCase(), diameterMm: a.diameterMm, sidewallMm: side(a.width, a.aspect), circMm: a.circumferenceM * 1000 },
		next: { size: nextRaw.trim().toUpperCase(), diameterMm: b.diameterMm, sidewallMm: side(b.width, b.aspect), circMm: b.circumferenceM * 1000 },
		deltaPct: ((b.circumferenceM - a.circumferenceM) / a.circumferenceM) * 100,
	};
};

/**
 * @brief Build the three-column spec table (label, stock, new).
 * @param pair Parsed geometry pair.
 * @return Table element with diameter, sidewall and circumference rows.
 */
const buildSpecTable = (pair: TirePair): HTMLElement => {
	const table = document.createElement('div');
	table.className = 'grid grid-cols-3 gap-x-3 gap-y-1 font-mono fs-base';
	const head = ['', pair.stock.size, pair.next.size];
	for (const h of head) {
		const cell = document.createElement('div');
		cell.className = h === '' ? '' : 'truncate text-right font-mono fs-tiny uppercase tracking-wider text-text-muted';
		cell.textContent = h;
		table.appendChild(cell);
	}
	const rows: [string, string, string][] = [
		[t('tiretool.diam'), `${pair.stock.diameterMm.toFixed(1)}`, `${pair.next.diameterMm.toFixed(1)}`],
		[t('tiretool.sidewall'), `${pair.stock.sidewallMm.toFixed(1)}`, `${pair.next.sidewallMm.toFixed(1)}`],
		[t('tiretool.circ'), `${pair.stock.circMm.toFixed(0)}`, `${pair.next.circMm.toFixed(0)}`],
	];
	for (const [label, stockVal, nextVal] of rows) {
		const left = document.createElement('div');
		left.className = 'text-text-dim';
		left.textContent = label;
		const mid = document.createElement('div');
		mid.className = 'text-right text-text-output tabular-nums';
		mid.textContent = stockVal;
		const right = document.createElement('div');
		right.className = 'text-right text-text-output tabular-nums font-semibold';
		right.textContent = nextVal;
		table.append(left, mid, right);
	}
	return table;
};

/**
 * @brief Build the relative-size bar (scaled to the larger tire).
 * @param pair Parsed geometry pair.
 * @param absDelta Absolute delta percent for the bar color.
 * @return Bar element with two tracks.
 */
const buildBar = (pair: TirePair, absDelta: number): HTMLElement => {
	const wrap = document.createElement('div');
	wrap.className = 'flex flex-col gap-1';
	const color = absDelta <= DELTA_OK ? 'bg-neon-green' : absDelta <= DELTA_BAD ? 'bg-neon-orange' : 'bg-neon-red';
	const max = Math.max(pair.stock.circMm, pair.next.circMm);
	for (const circ of [pair.stock.circMm, pair.next.circMm]) {
		const track = document.createElement('div');
		track.className = 'h-1.5 rounded-full bg-surface-recessed overflow-hidden';
		const fill = document.createElement('div');
		fill.className = `h-full rounded-full ${color}`;
		fill.style.width = `${Math.round((circ / max) * 100)}%`;
		track.appendChild(fill);
		wrap.appendChild(track);
	}
	return wrap;
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
 * @brief Mirror a setup tire into the tool input unless the user is typing.
 * @param el Tool input element, null when the shell is absent.
 * @param value Setup tire string from state.
 * @return void
 */
const syncFromState = (el: HTMLInputElement | null, value: string): void => {
	if (!el || document.activeElement === el || el.value === value) {
		return;
	}
	el.value = value;
};

/**
 * @brief Recompute the plus-size comparison from the two inputs.
 * @brief Shows the spec table, a verdict pill, size bars, the speedometer
 * @brief error at three indicated speeds and the gearing shift.
 * @return void
 */
export const updateTireSize = (): void => {
	const out = document.getElementById('tiresize-result');
	const pill = document.getElementById('tiresize-pill');
	const stockEl = document.getElementById('tiresize-stock') as HTMLInputElement | null;
	const nextEl = document.getElementById('tiresize-new') as HTMLInputElement | null;
	if (!out) {
		return;
	}
	syncFromState(stockEl, state.primaryTire);
	syncFromState(nextEl, state.compTire);
	const stock = stockEl?.value ?? '';
	const next = nextEl?.value ?? '';
	out.replaceChildren();
	const pair = parsePair(stock, next);
	if (!pair || !pill) {
		if (pill) {
			pill.classList.add('hidden');
		}
		const bad = document.createElement('div');
		bad.className = 'font-mono fs-base text-neon-red';
		bad.textContent = t('tiretool.invalid');
		out.appendChild(bad);
		return;
	}
	const abs = Math.abs(pair.deltaPct);
	const sign = pair.deltaPct >= 0 ? '+' : '';
	pill.className = `${PILL_BASE} ${verdictClass(abs)}`;
	pill.textContent = `${t(verdictKey(abs))} ${sign}${pair.deltaPct.toFixed(1)}%`;
	out.appendChild(buildSpecTable(pair));
	out.appendChild(buildBar(pair, abs));
	const ratio = pair.next.circMm / pair.stock.circMm;
	const spots = SPEEDO_SPOTS.map((v) => `${v}→${(v * ratio).toFixed(1)}`).join('  ');
	out.appendChild(buildRow(t('tiretool.speedo'), spots));
	const gearing = -pair.deltaPct;
	const gearWord = gearing >= 0 ? t('tiretool.shorter') : t('tiretool.longer');
	out.appendChild(buildRow(t('tiretool.gearing'), `${gearing >= 0 ? '+' : ''}${gearing.toFixed(1)}% ${gearWord}`));
};
