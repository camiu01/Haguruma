/**
 * @file pwa-utils.ts
 * @brief Pure PWA environment checks without direct window access.
 */

/**
 * Decide whether a service worker may be registered.
 * @brief Trust the browser flag, loopback hosts and https origins.
 * @param protocol Window location protocol (e.g. 'https:').
 * @param hostname Window location hostname.
 * @param secureFlag Window isSecureContext value.
 * @return True when registration is allowed.
 */
export const isSecureContext = (protocol: string, hostname: string, secureFlag: boolean): boolean => {
	if (secureFlag) {
		return true;
	}
	if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
		return true;
	}
	return protocol === 'https:' || protocol === 'wss:';
};

/**
 * Decide whether the app already runs as an installed PWA.
 * @brief Combines the display-mode query with the iOS navigator flag.
 * @param displayModeStandalone Match result of '(display-mode: standalone)'.
 * @param navigatorStandalone iOS navigator.standalone value.
 * @return True when running outside a regular browser tab.
 */
export const isStandalone = (displayModeStandalone: boolean, navigatorStandalone: boolean): boolean => {
	return displayModeStandalone || navigatorStandalone;
};

/**
 * Decide whether a request is eligible for service worker caching.
 * @brief Only plain GET requests over http(s) are cacheable.
 * @param method HTTP method (e.g. 'GET').
 * @param url Full request URL.
 * @return True when the request may be cached.
 */
export const isCacheableRequest = (method: string, url: string): boolean => {
	if (method.toUpperCase() !== 'GET') {
		return false;
	}
	return url.startsWith('http://') || url.startsWith('https://');
};
