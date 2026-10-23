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
import { renderSetupGuide } from './components/setup-guide';
import { renderCruise } from './components/cruise-card';
import { renderAll } from './views/render-all';
import { initSetupLevel, syncSetupLevel } from './services/events/setup-level-events';
import { state } from './core/state/app-state';
import { resizeCanvas } from './services/graph/canvas-setup';
import { injectAppShells } from './components/app-shells';
import { injectTelemetryTools } from './components/telemetry-tools';
import { injectOptimizerTools } from './components/optimizer-tools';
import { syncUrlHash } from './core/share/share-utils';
import { injectAdvancedDynamics } from './components/advanced-dynamics';
import { injectQuickAddTools } from './components/quick-add-tools';

/**
 * Bootstrap HAGURUMA.
 * @brief Resolve DOM, restore language, unit and theme, wire events, paint first frame.
 * @return void
 */
const bootstrap = (): void => {
	const tools = injectAppShells();
	const refs = getElementRefs();
	const render = (): void => renderAll(refs);
	injectTelemetryTools(tools, render);
	injectQuickAddTools(tools, () => {
		refreshPresetOptions(refs);
		renderCustomList(refs, render);
	});
	injectOptimizerTools(tools, (gears, fd) => {
		state.gears = [...gears];
		state.primaryFd = fd;
		refs.primaryFd.value = String(fd);
		renderGearsList(refs, render);
		syncUrlHash();
		render();
	});
	initLang();
	state.unit = initUnit();
	state.powerUnit = initPowerUnit();
	initSetupLevel();
	initTheme();
	bindAllEvents(refs, render);
	syncInitialControls(refs);
	refreshPresetOptions(refs);
	renderCustomList(refs, render);
	renderGearsList(refs, render);
	renderSetupGuide(refs);
	restoreFromUrl(refs, render);
	injectAdvancedDynamics(tools, render);
	resizeCanvas(refs.canvas, refs.ctx);
	renderCruise(refs);
	renderAll(refs);
};

/**
 * @brief Synchronize restored units, preferences and setup inputs.
 * @param refs Cached DOM handles.
 * @return void
 */
const syncInitialControls = (refs: ElementRefs): void => {
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
