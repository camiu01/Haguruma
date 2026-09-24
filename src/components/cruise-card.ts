/**
 * @file cruise-card.ts
 * @brief Shell injection and live render for the highway cruising check.
 */
import { state } from '../core/state/app-state';
import { t } from '../core/i18n/language';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { validateCurve } from '../core/math/traction-math';
import { cruiseCheck, type CruiseResult } from '../core/math/cruise-math';
import { fromDisplaySpeed } from '../core/math/speed-math';
import { formatPower, getUnitLabel } from '../core/units/unit-utils';
import type { ElementRefs } from '../services/dom/element-refs';

/**
 * @brief Inject the cruising-check shell into its index.html mount point.
 * @brief Runs in bootstrap before refs resolve so ids and accordion exist.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectCruiseShell = (host: HTMLElement): void => {
	host.replaceChildren();
	const card = document.createElement('div');
	card.className = 'card border border-border rounded-xl p-4';
	const accordion = document.createElement('div');
	accordion.setAttribute('data-accordion', 'cruise');
	const header = document.createElement('div');
	header.className = 'section-header';
	header.setAttribute('data-accordion-header', '');
	const headerLeft = document.createElement('div');
	headerLeft.className = 'flex items-center gap-2';
	const dot = document.createElement('span');
	dot.className = 'w-2 h-2 rounded-full bg-neon-cyan';
	const title = document.createElement('span');
	title.className = 'text-sm font-semibold text-text-main';
	title.setAttribute('data-i18n', 'cruise.title');
	title.textContent = t('cruise.title');
	const note = document.createElement('span');
	note.className = 'text-[10px] text-text-dim';
	note.setAttribute('data-i18n', 'cruise.note');
	note.textContent = t('cruise.note');
	headerLeft.append(dot, title, note);
	const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	chevron.setAttribute('class', 'chevron open');
	chevron.setAttribute('data-chevron', '');
	chevron.setAttribute('viewBox', '0 0 24 24');
	chevron.setAttribute('fill', 'none');
	chevron.setAttribute('stroke', 'currentColor');
	chevron.setAttribute('stroke-width', '2');
	chevron.setAttribute('aria-hidden', 'true');
	const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
	poly.setAttribute('points', '6 9 12 15 18 9');
	chevron.appendChild(poly);
	header.append(headerLeft, chevron);
	const content = document.createElement('div');
	content.className = 'section-content open';
	content.setAttribute('data-accordion-content', '');
	content.appendChild(buildControls());
	accordion.append(header, content);
	card.appendChild(accordion);
	host.appendChild(card);
};

/**
 * @brief Build the speed input row plus the result readout container.
 * @return Content fragment with input and result elements.
 */
const buildControls = (): DocumentFragment => {
	const frag = document.createDocumentFragment();
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-2 gap-4 pt-1';
	const col = document.createElement('div');
	col.className = 'col-span-2 sm:col-span-1';
	const label = document.createElement('label');
	label.className = 'block text-xs font-medium text-text-dim mb-1';
	label.setAttribute('for', 'cruise-speed');
	label.setAttribute('data-i18n', 'cruise.speed');
	label.textContent = t('cruise.speed');
	const wrap = document.createElement('div');
	wrap.className = 'relative';
	const input = document.createElement('input');
	input.type = 'number';
	input.id = 'cruise-speed';
	input.inputMode = 'decimal';
	input.step = '5';
	input.min = '30';
	input.max = '400';
	input.value = '130';
	input.className =
		'w-full bg-surface-input border border-surface-border focus:border-neon-cyan focus:ring-0 rounded-lg px-3 py-2 text-xs text-text-output font-mono focus:border-text-dim outline-none';
	const unit = document.createElement('span');
	unit.className = 'absolute right-2.5 top-2 text-[10px] font-mono text-zinc-500 pointer-events-none unit-label';
	unit.textContent = getUnitLabel(state.unit);
	wrap.append(input, unit);
	col.append(label, wrap);
	grid.appendChild(col);
	const result = document.createElement('div');
	result.id = 'cruise-result';
	result.className = 'col-span-2 sm:col-span-1 text-xs font-mono text-text-main pt-1';
	result.setAttribute('aria-live', 'polite');
	result.textContent = '—';
	grid.appendChild(result);
	frag.appendChild(grid);
	return frag;
};

/**
 * @brief Recompute the cruising check and write it into the result node.
 * @brief Reads the live speed input; never throws on invalid tires or curves.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderCruise = (refs: ElementRefs): void => {
	const tire = parseTire(state.primaryTire);
	const curve = validateCurve({
		redline: state.primaryRedline,
		peakTorqueRpm: state.peakTorqueRpm,
		peakTorqueNm: state.peakTorqueNm,
		peakPowerRpm: state.peakPowerRpm,
		peakPowerKw: state.enginePowerKw,
	});
	const raw = parseFloat(refs.cruiseSpeed.value);
	const displaySpeed = Number.isFinite(raw) && raw > 0 ? raw : 130;
	if (!tire || !curve) {
		refs.cruiseResult.textContent = '—';
		return;
	}
	const result = cruiseCheck({
		speedKmh: fromDisplaySpeed(displaySpeed, state.unit),
		gears: state.gears,
		fd: state.primaryFd,
		circM: effectiveCircumferenceM(tire, state.rollingFactor),
		curve,
		drivetrainEff: state.drivetrainEff,
		massKg: state.vehicleMassKg,
		dragCd: state.dragCd,
		frontalAreaM2: state.frontalAreaM2,
		rollingCrr: state.rollingCrr,
		roadGradePercent: state.roadGradePercent,
	});
	refs.cruiseResult.replaceChildren();
	if (!result) {
		refs.cruiseResult.textContent = '—';
		return;
	}
	refs.cruiseResult.appendChild(buildLine(`${t('cruise.gear')}: ${result.gearNumber}`, ''));
	refs.cruiseResult.appendChild(buildLine(`RPM: ${Math.round(result.rpm).toLocaleString('en-US')}`, ''));
	refs.cruiseResult.appendChild(
		buildLine(`${t('cruise.load')}: ${Math.round(result.engineLoadPct)}%`, verdictClass(result.verdict)),
	);
	refs.cruiseResult.appendChild(
		buildLine(
			`${formatPower(result.requiredWheelKw, state.powerUnit)} / ${formatPower(result.availableWheelKw, state.powerUnit)}`,
			'',
		),
	);
	refs.cruiseResult.appendChild(buildLine(t(`cruise.${result.verdict}`), verdictClass(result.verdict)));
};

/**
 * @brief Build one result line element.
 * @param text Line text.
 * @param cls Optional Tailwind text-color class.
 * @return Paragraph element with the line text.
 */
const buildLine = (text: string, cls: string): HTMLParagraphElement => {
	const p = document.createElement('p');
	p.className = cls;
	p.textContent = text;
	return p;
};

/**
 * @brief Map a cruise verdict to a Tailwind text class.
 * @param verdict Cruise verdict.
 * @return Text class string for the line.
 */
const verdictClass = (verdict: CruiseResult['verdict']): string => {
	if (verdict === 'over') {
		return 'text-rose-400';
	}
	if (verdict === 'high') {
		return 'text-amber-300';
	}
	return 'text-emerald-300';
};
