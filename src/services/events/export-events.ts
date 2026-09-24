/**
 * @file export-events.ts
 * @brief Bind PNG/SVG graph export buttons and the print/PDF action.
 */
import type { ElementRefs } from '../dom/element-refs';
import { exportGraphPng, exportGraphSvg } from '../graph/graph-export';

/**
 * @brief Wire export and print buttons exactly once.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindExportEvents = (refs: ElementRefs): void => {
	refs.btnExportPng.addEventListener('click', () => exportGraphPng(refs.canvas));
	refs.btnExportSvg.addEventListener('click', () => exportGraphSvg(refs.canvas));
	refs.btnPrint.addEventListener('click', () => window.print());
};
