import type { ElementRefs } from '../dom/element-refs';
import { handleCanvasHover } from '../graph/graph-tooltip';
import { drawGraph } from '../graph/graph-renderer';
import { resizeCanvas } from '../graph/canvas-setup';

/**
 * Bind canvas hover and window resize.
 * @purpose Keep tooltips live and rendering crisp.
 * @param refs Cached DOM handles.
 */
export const bindCanvasEvents = (refs: ElementRefs): void => {
	refs.canvas.addEventListener('mousemove', (e) => handleCanvasHover(e, refs));
	refs.canvas.addEventListener('mouseleave', () => refs.tooltip.classList.add('hidden'));
	window.addEventListener('resize', () => {
		resizeCanvas(refs.canvas, refs.ctx);
		drawGraph(refs);
	});
};
