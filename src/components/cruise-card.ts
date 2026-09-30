/**
 * @file cruise-card.ts
 * @brief Shell injection and live render for the highway cruising check.
 */
import { state } from '../core/state/app-state';
import { t } from '../core/i18n/language';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { activeEngineCurve } from '../core/state/engine-curve';
import { cruiseCheck, type CruiseResult } from '../core/math/cruise-math';
import { fromDisplaySpeed } from '../core/math/speed-math';
import { formatPower, getUnitLabel } from '../core/units/unit-utils';
import type { ElementRefs } from '../services/dom/element-refs';
import { buildToolShell } from './card/accordion-shell';

/**
 * @brief Inject the cruising-check shell into its index.html mount point.
 * @brief Runs in bootstrap before refs resolve so ids and accordion exist.
 * @brief The card fills its bare sidebar cell and carries no heading of its
 * @brief own: the accordion header already renders t('cruise.title').
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectCruiseShell = (host: HTMLElement): void => {
	host.replaceChildren();
	host.appendChild(buildToolShell({
		id: 'cruise',
		title: 'cruise.title',
		note: 'cruise.note',
		body: buildControls(),
		bodyClass: 'flex flex-col gap-3',
	}));
};

/**
 * @brief Build the speed input row plus the result readout container.
 * @return Content fragment with input and result elements.
 */
const buildControls = (): DocumentFragment => {
	const frag = document.createDocumentFragment();
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-2 gap-3';
	const col = document.createElement('div');
	col.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
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
		'w-full field-input field-input--md pr-9 font-semibold';
	const unit = document.createElement('span');
	unit.className = 'field-unit unit-label';
	unit.textContent = getUnitLabel(state.unit);
	wrap.append(input, unit);
	col.append(label, wrap);
	grid.appendChild(col);
	const result = document.createElement('div');
	result.id = 'cruise-result';
	result.className = 'field-half bg-surface-recessed border border-border-hairline rounded p-2 flex flex-col gap-0.5 fs-base font-mono text-text-main';
	result.setAttribute('aria-live', 'polite');
	result.textContent = '—';
	grid.appendChild(result);
	frag.appendChild(grid);
	return frag;
};

/**
 * @brief Recompute the cruising check and write it into the result node.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderCruise = (refs: ElementRefs): void => {
	const tire = parseTire(state.primaryTire);
	const curve = activeEngineCurve();
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
		return 'text-neon-red';
	}
	if (verdict === 'high') {
		return 'text-accent-warning';
	}
	return 'text-neon-green';
};
