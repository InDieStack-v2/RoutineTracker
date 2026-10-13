// Bump VERSION to drop every cached resource on next activation.
const VERSION = 'v1';
const CACHE = `routine-tracker-${VERSION}`;

// Expo exports these with content-hashed filenames, so they never change.
const IMMUTABLE = /^\/(_expo\/static|assets)\//;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only full 200 responses are safe to store (skips 206 ranges, errors, opaque).
const put = (request, response) => {
  if (response.status === 200) {
    const copy = response.clone();
    caches.open(CACHE).then((c) => c.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // HTML: network-first so a deploy is picked up immediately; cache only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => put(request, res))
        .catch(() => caches.match(request).then((hit) => hit || caches.match('/index.html')))
    );
    return;
  }

  // Hashed assets: cache-first, a new deploy means a new URL.
  if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => put(request, res)))
    );
    return;
  }

  // Everything else (manifest, icons, wasm): serve cached, refresh in the background.
  event.respondWith(
    caches.match(request).then((hit) => {
      const net = fetch(request).then((res) => put(request, res));
      return hit || net;
    })
  );
});
