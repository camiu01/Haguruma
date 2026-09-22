/**
 * @file render-all.ts
 * @brief Single refresh entry for canvas resize, graph and table.
 */
import type { ElementRefs } from '../services/dom/element-refs';
import { resizeCanvas } from '../services/graph/canvas-setup';
import { drawGraph } from '../services/graph/graph-renderer';
import { renderTable } from '../components/gear-table';

/**
 * Refresh canvas and table from current state.
 * @brief Single refresh entry used by every input handler.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderAll = (refs: ElementRefs): void => {
	resizeCanvas(refs.canvas, refs.ctx);
	drawGraph(refs);
	renderTable(refs);
};
