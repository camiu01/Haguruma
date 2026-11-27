/**
 * @file pyrometer-axle.ts
 * @brief Four-corner section of the pyrometer card: 12 tread inputs, per-corner
 * camber advice and the axle / side / drift balance readout.
 */
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';
import { CORNERS, diagnoseAxles, type AxleBalance, type Corner, type CornerSet, type SideBalance } from '../core/math/pyrometer-axle-math';
import type { CamberAdvice } from '../core/math/pyrometer-math';
import { buildAccordionSection } from './card/accordion-shell';

/** Shipped readings: a slightly tail-happy RWD car after a hot lap. */
const DEFAULTS: CornerSet = {
	fl: { inner: 84, center: 86, outer: 80 },
	fr: { inner: 86, center: 88, outer: 82 },
	rl: { inner: 90, center: 92, outer: 88 },
	rr: { inner: 92, center: 95, outer: 90 },
};

/** Zone order of the inputs inside each corner. */
const ZONES = ['inner', 'center', 'outer'] as const;

/** Dictionary key of each corner title. */
const CORNER_TEXT: Record<Corner, DictKey> = { fl: 'pyro.fl', fr: 'pyro.fr', rl: 'pyro.rl', rr: 'pyro.rr' };

/** Dictionary key of each camber verdict, shared with the single-tire card. */
const CAMBER_TEXT: Record<CamberAdvice, DictKey> = {
	'more-negative': 'pyro.camberMoreNegative',
	'less-negative': 'pyro.camberLessNegative',
	balanced: 'pyro.camberBalanced',
};

/** Dictionary key of each axle verdict. */
const AXLE_TEXT: Record<AxleBalance, DictKey> = {
	'front-hot': 'pyro.axleFrontHot',
	'rear-hot': 'pyro.axleRearHot',
	balanced: 'pyro.axleBalanced',
};

/** Dictionary key of each side verdict. */
const SIDE_TEXT: Record<SideBalance, DictKey> = {
	'left-hot': 'pyro.sideLeftHot',
	'right-hot': 'pyro.sideRightHot',
	balanced: 'pyro.sideBalanced',
};

/**
 * @brief Element id of one corner/zone input.
 * @param corner Corner code.
 * @param zone Tread zone.
 * @return Stable element id.
 */
const inputId = (corner: Corner, zone: (typeof ZONES)[number]): string => `pyro4-${corner}-${zone}`;

/**
 * @brief Build an element tagged for the language pass.
 * @param tag Tag name.
 * @param className Class list.
 * @param key Dictionary key.
 * @return Element with translated text.
 */
const i18nEl = (tag: string, className: string, key: DictKey): HTMLElement => {
	const el = document.createElement(tag);
	el.className = className;
	el.dataset.i18n = key;
	el.textContent = t(key);
	return el;
};

/**
 * @brief Build one corner block: title, three zone inputs and its advice line.
 * @param corner Corner code.
 * @return Corner block element.
 */
const buildCorner = (corner: Corner): HTMLElement => {
	const block = document.createElement('div');
	block.className = 'bg-surface-recessed border border-border-hairline rounded p-2 flex flex-col gap-1';
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-3 gap-1';
	for (const zone of ZONES) {
		const input = document.createElement('input');
		input.type = 'number';
		input.inputMode = 'decimal';
		input.id = inputId(corner, zone);
		input.min = '0';
		input.max = '300';
		input.value = String(DEFAULTS[corner][zone]);
		input.className = 'field-input field-input--compact field-input--center';
		input.setAttribute('aria-label', `${t(CORNER_TEXT[corner])} ${t(`pyro.${zone}` as DictKey)}`);
		grid.appendChild(input);
	}
	const advice = document.createElement('p');
	advice.id = `pyro4-${corner}-advice`;
	advice.className = 'font-mono fs-tiny text-text-dim';
	block.append(i18nEl('p', 'font-mono fs-tiny uppercase tracking-wider text-text-muted', CORNER_TEXT[corner]), grid, advice);
	return block;
};

/**
 * @brief Build the four-corner accordion section for the pyrometer card body.
 * @return Section element holding the corner grid and the balance readout.
 */
export const buildAxleSection = (): HTMLElement => {
	const body = document.createElement('div');
	body.className = 'flex flex-col gap-2';
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-2 gap-2';
	CORNERS.forEach((corner) => grid.appendChild(buildCorner(corner)));
	const result = document.createElement('div');
	result.id = 'pyro4-result';
	result.className = 'flex flex-col gap-1 font-mono fs-base';
	result.setAttribute('role', 'status');
	result.setAttribute('aria-live', 'polite');
	body.append(grid, result, i18nEl('p', 'fs-tiny text-text-dim leading-relaxed', 'pyro.axleNote'));
	return buildAccordionSection({ id: 'pyrometer-axle', title: 'pyro.axleTitle', body });
};

/**
 * @brief Read the twelve inputs, falling back to the defaults.
 * @return Readings for all four corners.
 */
const readCorners = (): CornerSet => {
	const set = {} as CornerSet;
	for (const corner of CORNERS) {
		const read = (zone: (typeof ZONES)[number]): number => {
			const value = parseFloat((document.getElementById(inputId(corner, zone)) as HTMLInputElement | null)?.value ?? '');
			return Number.isFinite(value) ? value : DEFAULTS[corner][zone];
		};
		set[corner] = { inner: read('inner'), center: read('center'), outer: read('outer') };
	}
	return set;
};

/**
 * @brief Repaint the per-corner advice and the balance lines.
 * @param hotPressureBar Hot pressure shared with the single-tire card.
 * @return void
 */
export const renderAxleSection = (hotPressureBar: number): void => {
	const result = document.getElementById('pyro4-result');
	if (!result) {
		return;
	}
	const d = diagnoseAxles(readCorners(), hotPressureBar);
	for (const corner of CORNERS) {
		const el = document.getElementById(`pyro4-${corner}-advice`);
		if (el) {
			el.textContent = t(CAMBER_TEXT[d.corners[corner].camber]);
		}
	}
	const line = (text: string, cls: string): HTMLElement => {
		const p = document.createElement('p');
		p.className = cls;
		p.textContent = text;
		return p;
	};
	const delta = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1)} °C`;
	result.replaceChildren(
		line(`${t(AXLE_TEXT[d.axle])} (${delta(d.frontRearDeltaC)})`, 'text-text-output'),
		line(`${t(SIDE_TEXT[d.side])} (${delta(d.leftRightDeltaC)})`, 'text-text-output'),
	);
	if (d.driftRisk) {
		result.appendChild(line(t('pyro.driftRisk'), 'text-neon-red font-bold'));
	}
};

/**
 * @brief Wire the twelve corner inputs to the shared change callback.
 * @param onChange Callback fired after each edit.
 * @return void
 */
export const bindAxleSection = (onChange: () => void): void => {
	for (const corner of CORNERS) {
		for (const zone of ZONES) {
			document.getElementById(inputId(corner, zone))?.addEventListener('input', onChange);
		}
	}
};
