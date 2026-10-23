/**
 * @file pyrometer-tool.ts
 * @brief Public API and live render for the interactive 3-zone pyrometer guide.
 */
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';
import {
	camberAdvice,
	centerEdgeSpread,
	innerOuterSpread,
	pressureAdvice,
	windowVerdict,
	type CamberAdvice,
	type PressureAdvice,
	type WindowVerdict,
} from '../core/math/pyrometer-math';
import { PYRO_DEFAULTS, PYRO_ID, PYRO_PILL_CLASS, buildPyrometerCard } from './pyrometer-shell';

/** Dictionary keys for each camber verdict. */
const CAMBER_TEXT: Record<CamberAdvice, DictKey> = {
	'more-negative': 'pyro.camberMoreNegative',
	'less-negative': 'pyro.camberLessNegative',
	balanced: 'pyro.camberBalanced',
};

/** Dictionary keys for each pressure verdict. */
const PRESSURE_TEXT: Record<PressureAdvice['action'], DictKey> = {
	raise: 'pyro.pressureUp',
	lower: 'pyro.pressureDown',
	balanced: 'pyro.pressureBalanced',
};

/** Dictionary key plus themed pill classes for each window verdict. */
const WINDOW_PILL: Record<WindowVerdict, { key: DictKey; cls: string }> = {
	cold: { key: 'pyro.windowCold', cls: 'text-neon-yellow border-neon-yellow/40' },
	optimal: { key: 'pyro.windowOk', cls: 'text-neon-green border-neon-green/40' },
	hot: { key: 'pyro.windowHot', cls: 'text-neon-red border-neon-red/40' },
};

/** Cached handles for the card's own elements. */
interface PyroRefs {
	/** Inner edge temperature input. */
	inner: HTMLInputElement;
	/** Centre temperature input. */
	center: HTMLInputElement;
	/** Outer edge temperature input. */
	outer: HTMLInputElement;
	/** Hot pressure input. */
	hotPressure: HTMLInputElement;
	/** Target hot temperature input. */
	targetTemp: HTMLInputElement;
	/** Header verdict pill. */
	verdict: HTMLElement;
	/** Camber advice line. */
	camber: HTMLElement;
	/** Pressure advice line. */
	pressure: HTMLElement;
	/** Formatted pressure correction. */
	pressureValue: HTMLElement;
	/** Inner minus outer spread readout. */
	spreadEdge: HTMLElement;
	/** Centre minus edges spread readout. */
	spreadCenter: HTMLElement;
}

/** Cached handles, resolved once right after injection. */
let cached: PyroRefs | null = null;

/** True once the input listeners have been attached. */
let bound = false;

/**
 * @brief Look up one required element by id.
 * @param id Element id declared by the injected shell.
 * @return Element cast to the requested handle type.
 */
const requireEl = <T extends HTMLElement>(id: string): T => {
	const el = document.getElementById(id);
	if (!el) {
		throw new Error(`Pyrometer tool: missing element #${id}`);
	}
	return el as T;
};

/**
 * @brief Resolve and cache every element the tool reads or writes.
 * @brief The card is self-contained, so its handles live here instead of in
 * @brief element-refs.ts; a missing id means the shell was never injected.
 * @return Cached handles.
 */
const resolveRefs = (): PyroRefs => {
	cached = {
		inner: requireEl<HTMLInputElement>(PYRO_ID.tempInner),
		center: requireEl<HTMLInputElement>(PYRO_ID.tempCenter),
		outer: requireEl<HTMLInputElement>(PYRO_ID.tempOuter),
		hotPressure: requireEl<HTMLInputElement>(PYRO_ID.hotPressure),
		targetTemp: requireEl<HTMLInputElement>(PYRO_ID.targetTemp),
		verdict: requireEl<HTMLElement>(PYRO_ID.verdict),
		camber: requireEl<HTMLElement>(PYRO_ID.camber),
		pressure: requireEl<HTMLElement>(PYRO_ID.pressure),
		pressureValue: requireEl<HTMLElement>(PYRO_ID.pressureValue),
		spreadEdge: requireEl<HTMLElement>(PYRO_ID.spreadEdge),
		spreadCenter: requireEl<HTMLElement>(PYRO_ID.spreadCenter),
	};
	return cached;
};

/**
 * @brief Get the cached handles, resolving them on first use.
 * @return Cached handles for the pyrometer card.
 */
const refs = (): PyroRefs => cached ?? resolveRefs();

/**
 * @brief Inject the pyrometer tool shell into its host mount point.
 * @brief Runs in bootstrap before refs resolve so the ids, the accordion
 * @brief section and the tagged copy exist before applyI18n and binding.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectPyrometerShell = (host: HTMLElement): void => {
	host.replaceChildren();
	host.appendChild(buildPyrometerCard());
	resolveRefs();
	renderPyrometer();
};

/**
 * @brief Wire the five numeric fields to a single change callback.
 * @brief Attached once; every edit fires onChange so the caller can re-render.
 * @param onChange Callback invoked after each input edit.
 * @return void
 */
export const bindPyrometerEvents = (onChange: () => void): void => {
	if (bound) {
		return;
	}
	bound = true;
	const handles = refs();
	const inputs = [handles.inner, handles.center, handles.outer, handles.hotPressure, handles.targetTemp];
	for (const input of inputs) {
		input.addEventListener('input', onChange);
	}
};

/**
 * @brief Read a numeric field, falling back to its shipped default.
 * @param input Input element to read.
 * @param fallback Value used when the field is empty or not a number.
 * @return Finite field value or the fallback.
 */
const readNumber = (input: HTMLInputElement, fallback: number): number => {
	const value = parseFloat(input.value);
	return Number.isFinite(value) ? value : fallback;
};

/**
 * @brief Write translated verdict copy and keep it language-aware.
 * @brief Re-tagging data-i18n lets applyI18n() refresh the copy when the
 * @brief interface language changes, without a render hook of our own.
 * @param el Element receiving the copy.
 * @param key Dictionary key for the current verdict.
 * @return void
 */
const writeI18nText = (el: HTMLElement, key: DictKey): void => {
	el.setAttribute('data-i18n', key);
	el.textContent = t(key);
};

/**
 * @brief Paint the header pill for a working-window verdict.
 * @param pill Pill element living in the accordion header.
 * @param verdict Verdict to display.
 * @return void
 */
const applyVerdictPill = (pill: HTMLElement, verdict: WindowVerdict): void => {
	const style = WINDOW_PILL[verdict];
	pill.className = `${PYRO_PILL_CLASS} ${style.cls}`;
	writeI18nText(pill, style.key);
};

/**
 * @brief Format a signed spread in °C with one decimal.
 * @param value Spread in °C, positive when the first named zone is hotter.
 * @return Text such as '+6.0 °C', '-4.5 °C' or '0.0 °C'.
 */
const formatCelsius = (value: number): string => {
	const rounded = Math.round(value * 10) / 10;
	const sign = rounded > 0 ? '+' : '';
	return `${sign}${rounded.toFixed(1)} °C`;
};

/**
 * @brief Format the pressure correction as sign plus magnitude in bar.
 * @brief The sign follows the action: raise adds, lower subtracts, and a
 * @brief balanced verdict prints an unsigned zero.
 * @param advice Pressure advice to format.
 * @return Text such as '+0.10 bar', '-0.05 bar' or '0.00 bar'.
 */
const formatDeltaBar = (advice: PressureAdvice): string => {
	if (advice.action === 'balanced') {
		return '0.00 bar';
	}
	const sign = advice.action === 'raise' ? '+' : '-';
	return `${sign}${advice.deltaBar.toFixed(2)} bar`;
};

/**
 * @brief Tint one advice line green when balanced, yellow when actionable.
 * @param el Advice element to tint.
 * @param balanced True when the corresponding verdict recommends no change.
 * @return void
 */
const tintAdvice = (el: HTMLElement, balanced: boolean): void => {
	el.classList.toggle('text-neon-green', balanced);
	el.classList.toggle('text-neon-yellow', !balanced);
};

/**
 * @brief Recompute the diagnostics and write every readout.
 * @brief Pure formatting over pyrometer-math; dynamic values go through
 * @brief textContent only, so no markup is injected and no full app re-render
 * @brief is required when an input changes.
 * @return void
 */
export const renderPyrometer = (): void => {
	const handles = refs();
	const inner = readNumber(handles.inner, PYRO_DEFAULTS.inner);
	const center = readNumber(handles.center, PYRO_DEFAULTS.center);
	const outer = readNumber(handles.outer, PYRO_DEFAULTS.outer);
	const target = readNumber(handles.targetTemp, PYRO_DEFAULTS.target);
	const hotPressure = readNumber(handles.hotPressure, PYRO_DEFAULTS.pressure);
	applyVerdictPill(handles.verdict, windowVerdict(inner, center, outer, target));
	const camber = camberAdvice(inner, outer);
	writeI18nText(handles.camber, CAMBER_TEXT[camber]);
	tintAdvice(handles.camber, camber === 'balanced');
	const pressure = pressureAdvice(center, inner, outer, hotPressure);
	writeI18nText(handles.pressure, PRESSURE_TEXT[pressure.action]);
	tintAdvice(handles.pressure, pressure.action === 'balanced');
	tintAdvice(handles.pressureValue, pressure.action === 'balanced');
	handles.pressureValue.textContent = formatDeltaBar(pressure);
	handles.spreadEdge.textContent = formatCelsius(innerOuterSpread(inner, outer));
	handles.spreadCenter.textContent = formatCelsius(centerEdgeSpread(center, inner, outer));
};
