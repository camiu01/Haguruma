/**
 * @file sw.js
 * @brief Minimal offline-first service worker for Haguruma.
 */
const CACHE = 'haguruma-v1';

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

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') {
		return;
	}
	if (!req.url.startsWith('http://') && !req.url.startsWith('https://')) {
		return;
	}
	event.respondWith(
		fetch(req)
			.then((res) => {
				const copy = res.clone();
				caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
				return res;
			})
			.catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
	);
});
