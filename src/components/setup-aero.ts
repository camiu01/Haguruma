/**
 * @file setup-aero.ts
 * @brief Prefix-parameterized chassis readouts (aero drag, weight split) for both setups.
 */
import { state } from '../core/state/app-state';
import { t } from '../core/i18n/language';
import { roadLoadPowerKw } from '../core/math/aero-math';
import { formatPower } from '../core/units/unit-utils';

/** Setup slot owning a block, shared by every prefix-parameterized component. */
export type SetupPrefix = 'primary' | 'compare';

/** Speed used for the live aerodynamic readout, in km/h. */
const AERO_READOUT_KMH = 200;

/** Per-prefix ids of the drag readout value nodes. */
const DRAG_IDS: Record<SetupPrefix, { force: string; power: string }> = {
	primary: { force: 'setupctl-drag', power: 'setupctl-drag-power' },
	compare: { force: 'comp-setupctl-drag', power: 'comp-setupctl-drag-power' },
};

/** Per-prefix ids of the static weight-split bar fills and label. */
const WEIGHT_IDS: Record<SetupPrefix, { bar: string; rear: string; label: string }> = {
	primary: { bar: 'setupctl-weight-bar', rear: 'setupctl-weight-bar-rear', label: 'setupctl-weight-label' },
	compare: { bar: 'comp-setupctl-weight-bar', rear: 'comp-setupctl-weight-bar-rear', label: 'comp-setupctl-weight-label' },
};

/**
 * @brief Inject the aerodynamic drag readout into its mount point.
 * @brief Runs in bootstrap before refs resolve so values exist on first paint.
 * @param host Mount element hosting the readout.
 * @param prefix Setup slot owning the block.
 * @return void
 */
export const injectAeroReadout = (host: HTMLElement, prefix: SetupPrefix): void => {
	host.replaceChildren();
	const box = document.createElement('div');
	box.dataset.setupPrefix = prefix;
	box.className = 'bg-surface-recessed border border-border-hairline p-2 rounded flex flex-col gap-0.5';
	const head = document.createElement('div');
	head.className = 'flex items-center gap-1';
	const icon = document.createElement('span');
	icon.className = 'material-symbols-outlined text-accent-aero text-[0.875rem]';
	icon.setAttribute('aria-hidden', 'true');
	icon.textContent = 'air';
	head.append(icon, buildI18nText('font-mono text-[0.625rem] font-bold uppercase tracking-wider text-accent-aero', 'setupctl.aeroReadout'));
	const ids = DRAG_IDS[prefix];
	box.append(
		head,
		buildDragLine('setupctl.drag', ids.force),
		buildDragLine('setupctl.dragPower', ids.power),
	);
	host.appendChild(box);
};

/**
 * @brief Build one label/value line of the drag readout.
 * @param labelKey Dictionary key for the line label.
 * @param id Element id receiving the live value.
 * @return Line element with a translated label and a value node.
 */
const buildDragLine = (labelKey: 'setupctl.drag' | 'setupctl.dragPower', id: string): HTMLElement => {
	const line = document.createElement('div');
	line.className = 'flex items-baseline justify-between gap-2';
	const label = buildI18nText('font-mono text-[0.625rem] uppercase text-text-muted', labelKey);
	const value = document.createElement('span');
	value.id = id;
	value.className = 'font-mono text-[0.75rem] font-bold text-text-output tabular-nums';
	value.textContent = '—';
	line.append(label, value);
	return line;
};

/**
 * @brief Build a translated static text node tagged for applyI18n.
 * @param className Tailwind class list applied to the node.
 * @param key Dictionary key used for the text content.
 * @return Span element carrying the translated text.
 */
const buildI18nText = (className: string, key: 'setupctl.aeroReadout' | 'setupctl.drag' | 'setupctl.dragPower'): HTMLElement => {
	const el = document.createElement('span');
	el.className = className;
	el.setAttribute('data-i18n', key);
	el.textContent = t(key);
	return el;
};

/**
 * Refresh the drag readout of one setup slot from state.
 * @brief Compares use their own mass, Cd and area against the shared road
 * @brief conditions; force comes from the road-load power at the readout speed
 * @brief so the drag model stays single-sourced in aero-math.
 * @param prefix Setup slot to refresh.
 * @return void
 */
export const syncDragReadouts = (prefix: SetupPrefix): void => {
	const ids = DRAG_IDS[prefix];
	if (!state.roadLoadEnabled) {
		setText(ids.force, '—');
		setText(ids.power, '—');
		return;
	}
	const massKg = prefix === 'primary' ? state.vehicleMassKg : state.compMassKg;
	const dragCd = prefix === 'primary' ? state.dragCd : state.compCd;
	const areaM2 = prefix === 'primary' ? state.frontalAreaM2 : state.compFrontalAreaM2;
	const kw = roadLoadPowerKw(AERO_READOUT_KMH, massKg, dragCd, areaM2, state.rollingCrr, state.roadGradePercent);
	const forceN = kw > 0 ? (kw * 1000) / (AERO_READOUT_KMH / 3.6) : 0;
	setText(ids.force, `${Math.round(forceN).toLocaleString('en-US')} N`);
	setText(ids.power, formatPower(kw, state.powerUnit));
};

/**
 * @brief Write the static weight distribution bar and label of one slot.
 * @brief The rear fill width complements the front share so the track stays full.
 * @param prefix Setup slot whose running gear is displayed.
 * @return void
 */
export const syncWeightSplit = (prefix: SetupPrefix): void => {
	const gear = prefix === 'primary' ? state.runningGear : state.compRunningGear;
	const fraction = gear?.frontWeightDistribution;
	if (!Number.isFinite(fraction)) {
		return;
	}
	const front = Math.round(fraction * 100);
	const ids = WEIGHT_IDS[prefix];
	setWidth(ids.bar, front);
	setWidth(ids.rear, 100 - front);
	setText(ids.label, `${front}% / ${100 - front}%`);
};

/**
 * @brief Write the fill width of one optional bar element by id.
 * @param id Target element id.
 * @param pct Percentage width applied to style.width.
 * @return void
 */
const setWidth = (id: string, pct: number): void => {
	const bar = document.getElementById(id);
	if (bar) {
		bar.style.width = `${pct}%`;
	}
};

/**
 * @brief Write text into one optional element by id.
 * @param id Target element id.
 * @param value Text written with textContent.
 * @return void
 */
const setText = (id: string, value: string): void => {
	const el = document.getElementById(id);
	if (el) {
		el.textContent = value;
	}
};
