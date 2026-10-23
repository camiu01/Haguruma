/**
 * @file main.ts
 * @brief Application bootstrap wiring DOM, state, events and first render.
 */
import { getElementRefs, type ElementRefs } from './services/dom/element-refs';
import { bindAllEvents } from './services/events/event-binder';
import { initLang } from './core/i18n/language';
import { syncLangToggle } from './services/events/language-events';
import { syncRoadLoadInputs } from './services/events/road-load-events';
import { syncEngineInputs } from './services/events/engine-events';
import { syncRunningGearInputs } from './services/events/running-gear-events';
import { refreshPresetOptions } from './services/events/preset-events';
import { syncComparisonInputs, applyComparisonVisibility } from './services/events/comparison-events';
import { restoreFromUrl } from './services/events/share-events';
import { renderCustomList } from './components/custom-car';
import { initTheme } from './core/theme/theme';
import { initPowerUnit, initUnit, formatPowerInput } from './core/units/unit-utils';
import { syncThemeToggle } from './services/events/theme-events';
import { applyUnitLabels, syncPowerUnitToggle, syncUnitToggle } from './services/events/unit-events';
import { renderGearsList, renderCompareGearsList } from './components/gear-list';
import { injectSetupGuideShell } from './components/setup-guide';
import { injectCruiseShell, renderCruise } from './components/cruise-card';
import { injectTireSizeShell } from './components/tire-size-tool';
import { injectFitmentShell } from './components/fitment-tool';
import { injectTelemetryShell } from './components/telemetry-tool';
import { bindGearLabApply, injectGearLabShell } from './components/gear-lab-tool';
import { injectSessionShell } from './components/session-tool';
import { bindSpecWizard, injectSpecWizardShell } from './components/spec-wizard-tool';
import { injectBackupShell } from './components/backup-tool';
import { injectSetupBaseBlock, injectAeroReadout } from './components/setup-controls';
import { injectPyrometerShell } from './components/pyrometer-tool';
import { renderAll } from './views/render-all';
import { initSetupLevel, syncSetupLevel } from './services/events/setup-level-events';
import { state } from './core/state/app-state';
import { injectAppShell } from './components/app-shell';
import { injectMetricFields } from './components/metric-fields';
import { injectDynamicsShell } from './components/dynamics-tool';
import { bindDynamicsControls } from './components/dynamics-controls';
import { injectPrimaryActiveDiffControls } from './components/active-diff-controls';

/**
 * Bootstrap HAGURUMA.
 * @brief Resolve DOM, restore language, unit and theme, wire events, paint first frame.
 * @return void
 */
const bootstrap = (): void => {
	injectAppShell(requireMount('app-shell'));
	initLang();
	injectMetricFields();
	injectSetupGuideShell(requireMount('setup-guide-mount'));
	injectCruiseShell(requireMount('cruise-mount'));
	injectTireSizeShell(requireMount('tire-size-mount'));
	injectFitmentShell(requireMount('fitment-mount'));
	injectTelemetryShell(requireMount('telemetry-mount'));
	injectGearLabShell(requireMount('gearlab-mount'));
	injectSessionShell(requireMount('session-mount'));
	injectSpecWizardShell(requireMount('spec-mount'));
	injectBackupShell(requireMount('backup-mount'));
	injectSetupBaseBlock(requireMount('setup-controls-mount'), 'primary');
	injectAeroReadout(requireMount('aero-controls-mount'), 'primary');
	injectSetupBaseBlock(requireMount('comp-setup-controls-mount'), 'compare');
	injectAeroReadout(requireMount('comp-aero-controls-mount'), 'compare');
	injectPyrometerShell(requireMount('pyrometer-mount'));
	injectDynamicsShell(requireMount('dynamics-mount'));
	injectPrimaryActiveDiffControls();
	const refs = getElementRefs();
	const render = (): void => renderAll(refs);
	state.unit = initUnit();
	state.powerUnit = initPowerUnit();
	initSetupLevel();
	initTheme();
	bindAllEvents(refs, render);
	bindDynamicsControls(render);
	bindGearLabApply((ratios) => {
		state.gears = ratios;
		renderGearsList(refs, () => render());
		render();
	});
	bindSpecWizard(() => {
		refreshPresetOptions(refs);
		renderCustomList(refs, render);
	});
	syncLangToggle(refs);
	syncThemeToggle(refs);
	syncUnitToggle(refs);
	syncPowerUnitToggle(refs);
	applyUnitLabels(refs);
	syncRoadLoadInputs(refs);
	syncEngineInputs(refs);
	syncSetupLevel(refs);
	syncRunningGearInputs(refs);
	syncComparisonInputs(refs);
	syncCustomPowerField(refs);
	refs.comparisonToggle.checked = state.compareEnabled;
	applyComparisonVisibility(refs);
	refreshPresetOptions(refs);
	renderCustomList(refs, render);
	renderGearsList(refs, () => render());
	renderCompareGearsList(refs, () => render());
	restoreFromUrl(refs, render);
	renderCruise(refs);
	renderAll(refs);
};

/**
 * @brief Resolve one required component mount or fail with its id.
 * @param id Required mount id.
 * @return Existing mount element.
 */
const requireMount = (id: string): HTMLElement => {
	const mount = document.getElementById(id);
	if (!mount) {
		throw new Error(`Missing required element: ${id}`);
	}
	return mount;
};

window.addEventListener('DOMContentLoaded', bootstrap);

/**
 * Align the custom-car power field with the restored power unit.
 * @brief HTML ships a kW default; convert once when the user last chose cv.
 * @param refs Cached DOM handles.
 * @return void
 */
const syncCustomPowerField = (refs: ElementRefs): void => {
	const raw = parseFloat(refs.customPower.value);
	if (Number.isFinite(raw) && raw > 0) {
		refs.customPower.value = formatPowerInput(raw, state.powerUnit);
	}
};
