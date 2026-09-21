import { state } from '../../core/state/app-state';
import { presets } from '../../config/presets';
import { CUSTOM_PREFIX, loadCustomPresets } from '../../core/presets/custom-store';
import { formatCompGears, parseCompGears } from '../../core/compare/compare-utils';
import type { ElementRefs } from '../dom/element-refs';
import { addGear } from '../../components/gear-list';

/**
 * Bind comparison toggle and secondary inputs.
 * @purpose Control the dotted overlay dual setup.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 */
export const bindComparisonEvents = (refs: ElementRefs, render: () => void): void => {
	refs.comparisonToggle.addEventListener('change', (e) => {
		state.compareEnabled = (e.target as HTMLInputElement).checked;
		applyComparisonVisibility(refs);
		render();
	});
	refs.compTire.addEventListener('input', (e) => {
		state.compTire = (e.target as HTMLInputElement).value.trim();
		render();
	});
	refs.compFd.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (v > 0) {
			state.compFd = v;
			render();
		}
	});
	refs.compGears.addEventListener('input', (e) => {
		applyCompGears(refs, (e.target as HTMLInputElement).value, render);
	});
	refs.compRedline.addEventListener('input', (e) => {
		const v = parseInt((e.target as HTMLInputElement).value, 10);
		if (v > 1000) {
			state.compRedline = v;
			render();
		}
	});
	refs.btnCopyPrimary.addEventListener('click', () => {
		copyPrimaryToCompare(refs, render);
	});
	refs.btnLoadPresetComp.addEventListener('change', (e) => {
		applyCompPreset(refs, (e.target as HTMLSelectElement).value, render);
		(e.target as HTMLSelectElement).value = '';
	});
};

/**
 * Toggle dimmed state and legend visibility.
 * @purpose Keep disabled inputs non-interactive.
 */
export const applyComparisonVisibility = (refs: ElementRefs): void => {
	if (state.compareEnabled) {
		refs.comparisonFields.classList.remove('opacity-40', 'pointer-events-none');
		refs.compLegend.classList.remove('hidden');
		refs.compLegend.classList.add('inline-flex');
		return;
	}
	refs.comparisonFields.classList.add('opacity-40', 'pointer-events-none');
	refs.compLegend.classList.add('hidden');
	refs.compLegend.classList.remove('inline-flex');
};

/**
 * Sync secondary inputs from state.
 * @brief Keep DOM and store aligned after preset or copy actions.
 * @param refs Cached DOM handles.
 */
export const syncComparisonInputs = (refs: ElementRefs): void => {
	refs.compTire.value = state.compTire;
	refs.compFd.value = String(state.compFd);
	refs.compGears.value = formatCompGears(state.compGears);
	refs.compRedline.value = String(state.compRedline);
};

/**
 * Bind the Add Gear button.
 * @purpose Append one shorter ratio up to the palette limit.
 */
export const bindGearActions = (refs: ElementRefs, render: () => void): void => {
	refs.btnAddGear.addEventListener('click', () => {
		addGear(refs, () => render());
	});
};

/**
 * Validate and store the secondary gear list.
 * @brief Show inline error without blocking typing.
 * @param refs Cached DOM handles.
 * @param raw Raw comma-separated input.
 * @param render Full refresh callback.
 */
const applyCompGears = (refs: ElementRefs, raw: string, render: () => void): void => {
	const parsed = parseCompGears(raw);
	if (!parsed) {
		refs.compError.classList.remove('hidden');
		return;
	}
	refs.compError.classList.add('hidden');
	state.compGears = parsed;
	render();
};

/**
 * Copy the primary setup into the comparison fields.
 * @brief One-click baseline for final-drive or close-ratio tests.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 */
const copyPrimaryToCompare = (refs: ElementRefs, render: () => void): void => {
	state.compTire = state.primaryTire;
	state.compFd = state.primaryFd;
	state.compGears = [...state.gears];
	state.compRedline = state.primaryRedline;
	refs.compTire.value = state.compTire;
	refs.compFd.value = String(state.compFd);
	refs.compGears.value = formatCompGears(state.compGears);
	refs.compRedline.value = String(state.compRedline);
	refs.compError.classList.add('hidden');
	enableComparison(refs);
	flashCopyButton(refs);
	render();
};

/**
 * Load a factory preset into the secondary setup.
 * @brief Compare stock 5-speed vs close-ratio 6-speed without touching primary.
 * @param refs Cached DOM handles.
 * @param key Preset key from the dropdown.
 * @param render Full refresh callback.
 */
const applyCompPreset = (refs: ElementRefs, key: string, render: () => void): void => {
	const preset = key.startsWith(CUSTOM_PREFIX) ? loadCustomPresets()[key.slice(CUSTOM_PREFIX.length)] : presets[key];
	if (!preset) {
		return;
	}
	state.compTire = preset.tire;
	state.compFd = preset.fd;
	state.compGears = [...preset.gears];
	state.compRedline = preset.redline;
	refs.compTire.value = preset.tire;
	refs.compFd.value = String(preset.fd);
	refs.compGears.value = formatCompGears(preset.gears);
	refs.compRedline.value = String(preset.redline);
	refs.compError.classList.add('hidden');
	enableComparison(refs);
	render();
};

/**
 * Enable the comparison overlay and sync toggle UI.
 * @brief Copy and preset actions imply the user wants to compare.
 * @param refs Cached DOM handles.
 */
const enableComparison = (refs: ElementRefs): void => {
	state.compareEnabled = true;
	refs.comparisonToggle.checked = true;
	applyComparisonVisibility(refs);
};

/**
 * Briefly highlight the copy button as confirmation.
 * @brief Compensate the invisible effect of copying identical values.
 * @param refs Cached DOM handles.
 */
const flashCopyButton = (refs: ElementRefs): void => {
	refs.btnCopyPrimary.classList.add('bg-amber-400/30');
	window.setTimeout(() => {
		refs.btnCopyPrimary.classList.remove('bg-amber-400/30');
	}, 600);
};
