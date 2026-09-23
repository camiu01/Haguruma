/**
 * @file viewport-events.ts
 * @brief Canvas container ResizeObserver + debounced redraw and mobile keyboard avoidance.
 */
import type { ElementRefs } from '../dom/element-refs';
import { debounce } from '../../core/debounce';

/**
 * Wire canvas container resize detection, visualViewport and keyboard-avoidance listeners.
 * @brief Keeps the graph crisp across layout changes, URL bar toggles and keyboard scroll.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback (normally bound to renderAll).
 * @return Cleanup function to disconnect the observer and cancel pending timers.
 */
export const bindViewportEvents = (refs: ElementRefs, render: () => void): (() => void) => {
	const cleanups: (() => void)[] = [];

	const debouncedRender = debounce(render, 150);

	bindContainerResize(refs, debouncedRender, cleanups);
	bindVisualViewport(debouncedRender, cleanups);
	bindKeyboardAvoidance();

	return () => {
		debouncedRender.cancel();
		for (let i = cleanups.length - 1; i >= 0; i--) {
			cleanups[i]();
		}
	};
};

/**
 * Observe the canvas container element with a ResizeObserver.
 * @brief Primary layout-change detection — fires only when graph-wrap actually resizes.
 * @param refs Cached DOM handles.
 * @param onResize Debounced redraw trigger.
 * @param cleanups Collector for teardown callbacks.
 * @return void
 */
const bindContainerResize = (
	refs: ElementRefs,
	onResize: () => void,
	cleanups: (() => void)[],
): void => {
	const container = refs.canvas.parentElement;

	if (container && typeof ResizeObserver !== 'undefined') {
		const observer = new ResizeObserver(() => {
			onResize();
		});
		observer.observe(container);
		cleanups.push(() => {
			observer.disconnect();
		});
		return;
	}

	// Fallback: debounced window.resize when ResizeObserver is unavailable.
	const onFallbackResize = (): void => {
		onResize();
	};
	window.addEventListener('resize', onFallbackResize);
	cleanups.push(() => {
		window.removeEventListener('resize', onFallbackResize);
	});
};

/**
 * Redraw on visual viewport resizes with debounce.
 * @brief Fires when mobile chrome shows or hides without a window resize.
 * @param onResize Debounced redraw trigger.
 * @param cleanups Collector for teardown callbacks.
 * @return void
 */
const bindVisualViewport = (
	onResize: () => void,
	cleanups: (() => void)[],
): void => {
	const viewport = window.visualViewport;
	if (!viewport) {
		return;
	}
	const onVpResize = (): void => {
		onResize();
	};
	viewport.addEventListener('resize', onVpResize);
	cleanups.push(() => {
		viewport.removeEventListener('resize', onVpResize);
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