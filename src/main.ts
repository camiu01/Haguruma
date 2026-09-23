import { getElementRefs } from './services/dom/element-refs';
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
import { initUnit } from './core/units/unit-utils';
import { syncThemeToggle } from './services/events/theme-events';
import { applyUnitLabels, syncUnitToggle } from './services/events/unit-events';
import { renderGearsList } from './components/gear-list';
import { renderAll } from './views/render-all';
import { state } from './core/state/app-state';
import { resizeCanvas } from './services/graph/canvas-setup';

/**
 * Bootstrap HAGURUMA.
 * @brief Resolve DOM, restore language, unit and theme, wire events, paint first frame.
 * @return void
 */
const bootstrap = (): void => {
	const refs = getElementRefs();
	const render = (): void => renderAll(refs);
	initLang();
	state.unit = initUnit();
	initTheme();
	bindAllEvents(refs, render);
	syncLangToggle(refs);
	syncThemeToggle(refs);
	syncUnitToggle(refs);
	applyUnitLabels(refs);
	syncRoadLoadInputs(refs);
	syncEngineInputs(refs);
	syncRunningGearInputs(refs);
	syncComparisonInputs(refs);
	refs.comparisonToggle.checked = state.compareEnabled;
	applyComparisonVisibility(refs);
	refreshPresetOptions(refs);
	renderCustomList(refs, render);
	renderGearsList(refs, () => render());
	restoreFromUrl(refs, render);
	resizeCanvas(refs.canvas, refs.ctx);
	renderAll(refs);
};

window.addEventListener('DOMContentLoaded', bootstrap);
