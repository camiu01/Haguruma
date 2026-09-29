/**
 * @file render-all.ts
 * @brief Single refresh entry for canvas resize, graph, table and readouts.
 */
import type { ElementRefs } from '../services/dom/element-refs';
import { resizeCanvas } from '../services/graph/canvas-setup';
import { drawGraph } from '../services/graph/graph-renderer';
import { renderTable } from '../components/gear-table';
import { renderCruise } from '../components/cruise-card';
import { updateTireSize } from '../components/tire-size-tool';
import { applySetupLevel } from '../services/events/setup-level-events';
import { updateRunningGearReadouts } from '../components/running-gear-readouts';
import { syncEngineCsvStatus } from '../services/events/engine-events';

/**
 * Refresh canvas, table and readouts from current state.
 * @brief Single refresh entry used by every input handler.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderAll = (refs: ElementRefs): void => {
	resizeCanvas(refs.canvas, refs.ctx);
	applySetupLevel();
	drawGraph(refs);
	renderTable(refs);
	renderCruise(refs);
	updateTireSize();
	updateRunningGearReadouts();
	syncEngineCsvStatus(refs);
};
