/**
 * @file setup-controls.ts
 * @brief Prefix-parameterized touch-first setup blocks for primary and compare.
 */
import { state } from '../core/state/app-state';
import { t } from '../core/i18n/language';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { syncDragReadouts, syncWeightSplit, type SetupPrefix } from './setup-aero';
import {
	BASE_IDS,
	DOT_INVALID,
	DOT_VALID,
	PILL_INVALID,
	PILL_VALID,
	buildStepperRow,
	buildTireSection,
	renderTirePills,
} from './setup-controls-markup';

export { injectAeroReadout } from './setup-aero';
export type { SetupPrefix } from './setup-aero';

/**
 * @brief Inject the touch-first setup base block for one setup slot.
 * @brief Runs in bootstrap before refs resolve so pills exist on first paint.
 * @param host Mount element hosting the block.
 * @param prefix Setup slot owning the block.
 * @return void
 */
export const injectSetupBaseBlock = (host: HTMLElement, prefix: SetupPrefix): void => {
	host.replaceChildren();
	const root = document.createElement('div');
	root.dataset.setupPrefix = prefix;
	root.className = 'flex flex-col gap-3';
	root.append(buildTireSection(prefix), buildStepperRow(prefix));
	host.appendChild(root);
};

/**
 * Refresh every live value of both setup blocks from state.
 * @brief Called from renderAll so pills, steppers, readouts and weight bars
 * @brief stay in sync with preset loads, share restores and unit changes.
 * @return void
 */
export const syncSetupControls = (): void => {
	syncPrefix('primary');
	syncPrefix('compare');
};

/**
 * @brief Refresh one setup slot from its own state slice.
 * @param prefix Setup slot to refresh.
 * @return void
 */
const syncPrefix = (prefix: SetupPrefix): void => {
	const tire = parseTire(prefix === 'primary' ? state.primaryTire : state.compTire);
	renderTirePills(prefix, tire);
	syncGeometry(prefix, tire);
	setInputValue(BASE_IDS[prefix].fd, (prefix === 'primary' ? state.primaryFd : state.compFd).toFixed(3));
	setInputValue(BASE_IDS[prefix].rev, String(Math.round(prefix === 'primary' ? state.primaryRedline : state.compRedline)));
	syncWeightSplit(prefix);
	syncDragReadouts(prefix);
};

/**
 * @brief Write the geometry pill, validity dot and primary circ readout.
 * @param prefix Setup slot owning the geometry nodes.
 * @param tire Parsed tire of the slot, null when the spec is invalid.
 * @return void
 */
const syncGeometry = (prefix: SetupPrefix, tire: ReturnType<typeof parseTire>): void => {
	const ids = BASE_IDS[prefix];
	if (!tire) {
		setText(ids.geometryPill, '—');
		setClasses(ids.geometryPill, PILL_INVALID);
		setTitle(ids.geometryPill, '');
		setClasses(ids.tireDot, DOT_INVALID);
		setTitle(ids.tireDot, t('primary.tireError'));
		if (prefix === 'primary') {
			toggleHidden('tire-error', false);
		}
		return;
	}
	const circMm = effectiveCircumferenceM(tire, state.rollingFactor) * 1000;
	setText(
		ids.geometryPill,
		`${t('setupctl.circ')}: ${Math.round(circMm).toLocaleString('en-US')} mm · ${t('setupctl.diam')}: ${Math.round(tire.diameterMm).toLocaleString('en-US')} mm`,
	);
	setClasses(ids.geometryPill, PILL_VALID);
	setTitle(ids.geometryPill, t('setupctl.geometryOk'));
	setClasses(ids.tireDot, DOT_VALID);
	setTitle(ids.tireDot, t('setupctl.geometryOk'));
	if (prefix === 'primary') {
		toggleHidden('tire-error', true);
		setText('primary-circ-display', `Circ: ${Math.round(circMm)} mm`);
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

/**
 * @brief Write a value into one optional input unless the user is editing it.
 * @param id Target input id.
 * @param value Value written to the input.
 * @return void
 */
const setInputValue = (id: string, value: string): void => {
	const input = document.getElementById(id) as HTMLInputElement | null;
	if (input && document.activeElement !== input) {
		input.value = value;
	}
};

/**
 * @brief Replace the full class list of one optional element by id.
 * @param id Target element id.
 * @param classes Class list written to className.
 * @return void
 */
const setClasses = (id: string, classes: string): void => {
	const el = document.getElementById(id);
	if (el) {
		el.className = classes;
	}
};

/**
 * @brief Set the title attribute of one optional element by id.
 * @param id Target element id.
 * @param value Tooltip text written to title and aria-label.
 * @return void
 */
const setTitle = (id: string, value: string): void => {
	const el = document.getElementById(id);
	if (el) {
		el.title = value;
		el.setAttribute('aria-label', value);
	}
};

/**
 * @brief Show or hide one optional element by toggling the hidden class.
 * @param id Target element id.
 * @param hidden True to hide the element, false to reveal it.
 * @return void
 */
const toggleHidden = (id: string, hidden: boolean): void => {
	const el = document.getElementById(id);
	if (el) {
		el.classList.toggle('hidden', hidden);
	}
};
