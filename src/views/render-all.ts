/**
 * @file render-all.ts
 * @brief Single refresh entry for the plot, table and every live readout.
 */
import type { ElementRefs } from '../services/dom/element-refs';
import { renderGraph } from '../services/graph/graph-renderer';
import { renderTable } from '../components/gear-table';
import { renderCruise } from '../components/cruise-card';
import { updateTireSize } from '../components/tire-size-tool';
import { applySetupLevel } from '../services/events/setup-level-events';
import { updateRunningGearReadouts } from '../components/running-gear-readouts';
import { syncEngineCsvStatus } from '../services/events/engine-events';
import { syncSetupControls } from '../components/setup-controls';
import { syncCompGearStack } from '../components/gear-list';
import { renderHeader } from '../components/header-bar';
import { renderPyrometer } from '../components/pyrometer-tool';
import { renderSetupGuide } from '../components/setup-guide';
import { syncDrawerDisplay } from '../services/events/drawer-display-events';
import { syncOpenAccordionHeights } from '../services/dom/accordion-height';
import { renderDynamics } from '../components/dynamics-tool';
import { syncActiveDiffControls } from '../components/active-diff-controls';
import { state } from '../core/state/app-state';

/**
 * Refresh the plot, table and readouts from current state.
 * @brief Single refresh entry used by every input handler.
 * @brief Open accordions are re-measured last so content injected by the
 * @brief render pass never stays clipped under a stale inline max-height.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderAll = (refs: ElementRefs): void => {
	applySetupLevel();
	renderGraph(refs);
	renderTable(refs);
	renderCruise(refs);
	updateTireSize();
	updateRunningGearReadouts();
	syncSetupControls();
	syncCompGearStack(refs);
	renderHeader(refs);
	renderPyrometer();
	renderSetupGuide(refs);
	syncDrawerDisplay();
	syncEngineCsvStatus(refs);
	renderDynamics();
	syncActiveDiffControls('rg', state.runningGear);
	syncActiveDiffControls('crg', state.compRunningGear);
	syncOpenAccordionHeights();
};
