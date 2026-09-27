/**
 * @file focus-trap.ts
 * @brief Tab key trap keeping keyboard focus inside overlays.
 */

/** Selectors counted as keyboard stops inside a trap container. */
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * @brief Check whether an element can receive keyboard focus.
 * @param el Candidate element.
 * @return True when visible and enabled.
 */
const isFocusable = (el: HTMLElement): boolean => {
	if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
		return false;
	}
	const rect = el.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
};

/**
 * @brief Keep Tab navigation inside an open overlay container.
 * @param container Overlay element holding focus (drawer or modal).
 * @param event Keyboard event to handle.
 * @return void
 */
export const trapTabKey = (container: HTMLElement, event: KeyboardEvent): void => {
	if (event.key !== 'Tab') {
		return;
	}
	const stops = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable);
	if (stops.length === 0) {
		event.preventDefault();
		return;
	}
	const first = stops[0];
	const last = stops[stops.length - 1];
	if (event.shiftKey && document.activeElement === first) {
		event.preventDefault();
		last.focus();
		return;
	}
	if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first.focus();
	}
};
