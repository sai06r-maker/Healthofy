/* =============================================
   Healthofy Service Worker
   Offline-first cache + auto-update
   ============================================= */

const CACHE_NAME = 'healthofy-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* ---------- INSTALL: pre-cache core assets ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll fails if ANY asset is missing.
      // Fall back to per-item add so one bad URL doesn't kill the install.
      return Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Skipped caching:', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

/* ---------- ACTIVATE: clear old caches ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ---------- FETCH: cache-first, then network ---------- */
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Only handle same-origin requests (skip CDN, Google Fonts, etc.)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    // Let external resources (fonts, Font Awesome) go straight to network
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached version if we have it
      if (cached) return cached;

      // Otherwise fetch from network and cache the response
      return fetch(event.request)
        .then((response) => {
          // Only cache valid successful responses
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }

          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });

          return response;
        })
        .catch(() => {
          // Offline fallback → serve index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

/* ---------- MESSAGE: allow page to trigger update ---------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});