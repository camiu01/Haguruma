/**
 * @file viewport-events.ts
 * @brief Mobile viewport resize handling and keyboard avoidance.
 */
import type { ElementRefs } from '../dom/element-refs';
import { resizeCanvas } from '../graph/canvas-setup';
import { drawGraph } from '../graph/graph-renderer';

/** Pending debounced redraw timer for visual viewport resizes. */
let resizeTimer = 0;

/**
 * Wire mobile viewport and keyboard-avoidance listeners.
 * @brief Keeps the graph crisp when the URL bar or keyboard moves.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindViewportEvents = (refs: ElementRefs): void => {
	bindVisualViewport(refs);
	bindKeyboardAvoidance();
};

/**
 * Redraw on visual viewport resizes with debounce.
 * @brief Fires when mobile chrome shows or hides without a window resize.
 * @param refs Cached DOM handles.
 * @return void
 */
const bindVisualViewport = (refs: ElementRefs): void => {
	const viewport = window.visualViewport;
	if (!viewport) {
		return;
	}
	viewport.addEventListener('resize', () => {
		window.clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			if (resizeCanvas(refs.canvas, refs.ctx)) {
				drawGraph(refs);
			}
		}, 150);
	});
};

/**
 * Keep focused inputs visible above the software keyboard.
 * @brief Scrolls the active field into view without stealing focus.
 * @return void
 */
const bindKeyboardAvoidance = (): void => {
	document.addEventListener('focusin', (e: FocusEvent) => {
		const target = e.target as HTMLElement | null;
		if (!target) {
			return;
		}
		if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') {
			return;
		}
		try {
			target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		} catch {
			target.scrollIntoView();
		}
	});
};
