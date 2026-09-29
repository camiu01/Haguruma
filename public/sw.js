/**
 * @file sw.js
 * @brief Offline-first service worker for Haguruma.
 *
 * Navigations stay network-first with an app-shell fallback so the UI never
 * goes stale. Same-origin GET assets (car JSON presets, JS/CSS) use
 * stale-while-revalidate with a capped entry count for track-side offline use.
 * Versioned JSON payloads additionally expire by max-age: a stale catalog
 * entry is dropped and re-fetched instead of served.
 */
const CACHE = 'haguruma-v3';

/** Maximum cached asset entries before the oldest is evicted. */
const MAX_ENTRIES = 60;

/** Max age of cached JSON payloads before forced refresh (7 days). */
const JSON_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest'])).catch(() => undefined),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
	);
});

/**
 * @brief Trim the cache to MAX_ENTRIES, evicting the oldest entry.
 * @param cache Open cache handle.
 * @return Promise resolving when the cap holds.
 */
const trimCache = (cache) => {
	return cache.keys().then((keys) => {
		if (keys.length <= MAX_ENTRIES) {
			return undefined;
		}
		return cache.delete(keys[0]).then(() => trimCache(cache));
	}).catch(() => undefined);
};

/**
 * @brief Check whether a cached JSON response expired by max-age.
 * @param hit Cached response, possibly without a Date header.
 * @return True when the entry is JSON and older than JSON_MAX_AGE_MS.
 */
const isJsonExpired = (req, hit) => {
	if (!hit || !req.url.endsWith('.json')) {
		return false;
	}
	const date = Date.parse(hit.headers.get('date') || '');
	if (!Number.isFinite(date)) {
		return false;
	}
	return Date.now() - date > JSON_MAX_AGE_MS;
};

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') {
		return;
	}
	if (!req.url.startsWith('http://') && !req.url.startsWith('https://')) {
		return;
	}
	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req)
				.then((res) => {
					const copy = res.clone();
					caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
					return res;
				})
				.catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
		);
		return;
	}
	event.respondWith(
		caches.match(req).then((hit) => {
			if (hit && isJsonExpired(req, hit)) {
				caches.open(CACHE).then((cache) => cache.delete(req)).catch(() => undefined);
				hit = undefined;
			}
			const refresh = fetch(req)
				.then((res) => {
					if (!res || !res.ok) {
						return res;
					}
					const copy = res.clone();
					caches.open(CACHE).then((cache) => cache.put(req, copy).then(() => trimCache(cache))).catch(() => undefined);
					return res;
				})
				.catch(() => undefined);
			return hit || refresh.then((res) => res || caches.match('./index.html'));
		}),
	);
});
