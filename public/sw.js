/**
 * @file sw.js
 * @brief Offline-first service worker for Haguruma.
 *
 * Navigations stay network-first with an app-shell fallback so the UI never
 * goes stale. Same-origin GET assets (car JSON presets, JS/CSS) use
 * stale-while-revalidate with a capped entry count for track-side offline use.
 */
const CACHE = 'haguruma-v2';

/** Maximum cached asset entries before the oldest is evicted. */
const MAX_ENTRIES = 60;

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
