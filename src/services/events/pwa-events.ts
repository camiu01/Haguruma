/**
 * @file pwa-events.ts
 * @brief Register the offline app-shell service worker when eligible.
 */
import { isSecureContext } from '../../core/pwa/pwa-utils';
import type { ElementRefs } from '../dom/element-refs';

/**
 * @brief Register ./sw.js on loopback or secure production origins.
 * @brief public/sw.js caches the app shell offline-first; registration is
 * @brief skipped on the Vite dev server and on insecure remote hosts, and
 * @brief a failed registration is logged without breaking the app.
 * @param _refs Cached DOM handles (kept for binder signature consistency).
 * @return void
 */
export const bindPwaEvents = (_refs: ElementRefs): void => {
	if (import.meta.env.DEV) {
		return;
	}
	if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
		return;
	}
	const { protocol, hostname } = window.location;
	if (!isSecureContext(protocol, hostname, window.isSecureContext === true)) {
		return;
	}
	navigator.serviceWorker.register('./sw.js').catch((err: unknown) => {
		console.warn('Service worker registration failed.', err);
	});
};
