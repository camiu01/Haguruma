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
import { renderGearsList } from './components/gear-list';
import { injectSetupGuideShell, renderSetupGuide } from './components/setup-guide';
import { injectCruiseShell, renderCruise } from './components/cruise-card';
import { renderAll } from './views/render-all';
import { state } from './core/state/app-state';
import { resizeCanvas } from './services/graph/canvas-setup';

/**
 * Bootstrap HAGURUMA.
 * @brief Resolve DOM, restore language, unit and theme, wire events, paint first frame.
 * @return void
 */
const bootstrap = (): void => {
	const mount = document.getElementById('setup-guide-mount');
	if (!mount) {
		throw new Error('Missing required element: setup-guide-mount');
	}
	injectSetupGuideShell(mount);
	const cruiseMount = document.getElementById('cruise-mount');
	if (!cruiseMount) {
		throw new Error('Missing required element: cruise-mount');
	}
	injectCruiseShell(cruiseMount);
	const refs = getElementRefs();
	const render = (): void => renderAll(refs);
	initLang();
	state.unit = initUnit();
	state.powerUnit = initPowerUnit();
	initTheme();
	bindAllEvents(refs, render);
	syncLangToggle(refs);
	syncThemeToggle(refs);
	syncUnitToggle(refs);
	syncPowerUnitToggle(refs);
	applyUnitLabels(refs);
	syncRoadLoadInputs(refs);
	syncEngineInputs(refs);
	syncRunningGearInputs(refs);
	syncComparisonInputs(refs);
	syncCustomPowerField(refs);
	refs.comparisonToggle.checked = state.compareEnabled;
	applyComparisonVisibility(refs);
	refreshPresetOptions(refs);
	renderCustomList(refs, render);
	renderGearsList(refs, () => render());
	renderSetupGuide(refs);
	restoreFromUrl(refs, render);
	resizeCanvas(refs.canvas, refs.ctx);
	renderCruise(refs);
	renderAll(refs);
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
