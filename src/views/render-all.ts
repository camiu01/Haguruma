/**
 * @file render-all.ts
 * @brief Single refresh entry for canvas resize, graph, table and readouts.
 */
import type { ElementRefs } from '../services/dom/element-refs';
import { resizeCanvas } from '../services/graph/canvas-setup';
import { drawGraph } from '../services/graph/graph-renderer';
import { renderTable } from '../components/gear-table';
import { renderCruise } from '../components/cruise-card';
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
	drawGraph(refs);
	renderTable(refs);
	renderCruise(refs);
	updateRunningGearReadouts();
	syncEngineCsvStatus(refs);
};
