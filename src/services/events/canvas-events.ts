/**
 * @file canvas-events.ts
 * @brief Canvas hover, touch, resize and fullscreen bindings.
 */
import type { ElementRefs } from '../dom/element-refs';
import { handleCanvasHover, handleCanvasPointer } from '../graph/graph-tooltip';
import { drawGraph } from '../graph/graph-renderer';
import { observeCanvasResize } from '../graph/canvas-setup';
import { invalidateStaticLayer } from '../graph/graph-layers';
import { t } from '../../core/i18n/language';

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
	refs.btnExpandGraph.addEventListener('click', () => toggleGraphFullscreen(refs));
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isGraphFullscreen(refs)) {
			setGraphFullscreen(refs, false);
		}
	});
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

/**
 * @brief Resolve the graph card hosting the canvas.
 * @param refs Cached DOM handles.
 * @return Card element, or null when the markup changed.
 */
const graphCardOf = (refs: ElementRefs): HTMLElement | null => {
	return refs.canvas.closest('.graph-card');
};

/**
 * @brief Check whether the graph card is fullscreen.
 * @param refs Cached DOM handles.
 * @return True while the fullscreen class is set.
 */
const isGraphFullscreen = (refs: ElementRefs): boolean => {
	return graphCardOf(refs)?.classList.contains('graph-fullscreen') ?? false;
};

/**
 * @brief Toggle the graph card fullscreen overlay.
 * @param refs Cached DOM handles.
 * @return void
 */
const toggleGraphFullscreen = (refs: ElementRefs): void => {
	setGraphFullscreen(refs, !isGraphFullscreen(refs));
};

/**
 * @brief Set the graph card fullscreen overlay state.
 * @brief ResizeObserver repaints the canvas on the layout change.
 * @param refs Cached DOM handles.
 * @param open True to expand, false to collapse.
 * @return void
 */
const setGraphFullscreen = (refs: ElementRefs, open: boolean): void => {
	const card = graphCardOf(refs);
	if (!card) {
		return;
	}
	card.classList.toggle('graph-fullscreen', open);
	document.body.style.overflow = open ? 'hidden' : '';
	refs.btnExpandGraph.setAttribute('aria-expanded', String(open));
	const label = open ? t('graph.collapse') : t('graph.expand');
	const tip = open ? t('graph.collapseTip') : t('graph.expandTip');
	refs.btnExpandGraph.textContent = label;
	refs.btnExpandGraph.title = tip;
	refs.btnExpandGraph.setAttribute('data-tip', tip);
	refs.btnExpandGraph.setAttribute('aria-label', tip);
	invalidateStaticLayer();
};
