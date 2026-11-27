/**
 * @file haptics.ts
 * @brief Subtle haptic ticks through the Vibration API.
 *
 * The Android WebView (Capacitor) and mobile Chrome implement
 * `navigator.vibrate`; desktop browsers and iOS ignore it, so the call is a
 * silent no-op there. Users who ask for reduced motion get no haptics either.
 */

/**
 * @brief Fire one short haptic pulse when the platform supports it.
 * @param ms Pulse length in milliseconds.
 * @return True when a pulse was requested.
 */
export const haptic = (ms = 8): boolean => {
	if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
		return false;
	}
	if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
		return false;
	}
	try {
		return navigator.vibrate(ms);
	} catch {
		return false;
	}
};
