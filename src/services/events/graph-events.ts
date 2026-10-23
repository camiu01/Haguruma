/**
 * @file graph-events.ts
 * @brief Graph crosshair bindings plus the fullscreen expand toggle.
 */
import type { ElementRefs } from '../dom/element-refs';
import { bindGraphInteractions, toggleGraphExpand } from '../graph/graph-renderer';

/**
 * Wire the SVG plot interactions exactly once.
 * @brief Crosshair, layer pills and export buttons live in the graph module;
 * @brief this binder owns the card-level fullscreen affordance and Escape.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindGraphEvents = (refs: ElementRefs): void => {
	bindGraphInteractions(refs);
	refs.btnExpandGraph.addEventListener('click', () => toggleGraphExpand(refs));
	document.addEventListener('keydown', (event: KeyboardEvent) => {
		if (event.key === 'Escape' && isGraphFullscreen(refs)) {
			toggleGraphExpand(refs);
		}
	});
};

/**
 * @brief Check whether the graph card is currently expanded.
 * @param refs Cached DOM handles.
 * @return True while the fullscreen class is set on the graph card.
 */
const isGraphFullscreen = (refs: ElementRefs): boolean => {
	return refs.graphHost.closest('.graph-card')?.classList.contains('graph-fullscreen') ?? false;
};
