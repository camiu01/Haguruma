/**
 * @file canvas-events.ts
 * @brief Canvas hover, touch and resize bindings.
 */
import type { ElementRefs } from '../dom/element-refs';
import { handleCanvasHover, handleCanvasPointer } from '../graph/graph-tooltip';
import { drawGraph } from '../graph/graph-renderer';
import { observeCanvasResize } from '../graph/canvas-setup';

/**
 * Bind canvas hover and window resize.
 * @brief Keep tooltips live and rendering crisp.
 * @param refs Cached DOM handles.
 */
export const bindCanvasEvents = (refs: ElementRefs): void => {
	refs.canvas.addEventListener('mousemove', (e) => handleCanvasHover(e, refs));
	refs.canvas.addEventListener('pointerdown', (e) => handleCanvasPointer(e, refs));
	refs.canvas.addEventListener('touchstart', (e) => handleTouchTooltip(e, refs), { passive: true });
	refs.canvas.addEventListener('mouseleave', () => refs.tooltip.classList.add('hidden'));
	refs.canvas.addEventListener('touchend', () => refs.tooltip.classList.add('hidden'));
	observeCanvasResize(refs.canvas, refs.ctx, () => drawGraph(refs));
};

/**
 * Show the tooltip from the first touch point.
 * @brief Touch has no hover, so tap explicitly anchors the readout.
 * @param event Touch event from the canvas listener.
 * @param refs Cached DOM handles.
 * @return void
 */
const handleTouchTooltip = (event: TouchEvent, refs: ElementRefs): void => {
	const touch = event.touches[0];
	if (!touch) {
		return;
	}
	handleCanvasPointer({ clientX: touch.clientX, clientY: touch.clientY }, refs);
};
