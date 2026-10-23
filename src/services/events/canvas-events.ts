/**
 * @file canvas-events.ts
 * @brief Canvas hover, touch, resize and fullscreen bindings.
 */
import type { ElementRefs } from '../dom/element-refs';
import { bindGraphGestures } from './graph-gesture-events';
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
	bindGraphGestures(refs);
	refs.canvas.addEventListener('mouseleave', () => refs.tooltip.classList.add('hidden'));
	observeCanvasResize(refs.canvas, refs.ctx, () => drawGraph(refs));
	refs.btnExpandGraph.addEventListener('click', () => toggleGraphFullscreen(refs));
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isGraphFullscreen(refs)) {
			setGraphFullscreen(refs, false);
		}
	});
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
	const tipKey = open ? 'graph.collapseTip' : 'graph.expandTip';
	refs.btnExpandGraph.setAttribute('aria-expanded', String(open));
	// The button is icon-only, so the state lives in the tooltip. Swapping the
	// key keeps applyI18n() honest after a later language switch.
	refs.btnExpandGraph.dataset.i18nTip = tipKey;
	const tip = t(tipKey);
	refs.btnExpandGraph.title = tip;
	refs.btnExpandGraph.setAttribute('data-tip', tip);
	refs.btnExpandGraph.setAttribute('aria-label', tip);
	invalidateStaticLayer();
};
