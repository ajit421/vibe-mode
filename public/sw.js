/*
 * Vibe Mode service worker: makes the site installable and repeat visits
 * instant. Registered from `src/main.tsx`, in production only.
 *
 *  - The page itself: network first, so a new deploy is never hidden behind
 *    an old cache. The last good copy is kept for opening offline.
 *  - `/assets/*` (hashed by Vite, so a URL's content never changes): cache
 *    first. Capped, because every deploy adds new hashes and old ones would
 *    otherwise pile up forever.
 *  - Other same-site files (backgrounds, icons): show the cached copy, refresh
 *    it in the background, so a replaced picture still arrives next visit.
 *  - Never touched: anything cross-origin (YouTube, fonts, oEmbed), anything
 *    not a GET, and range requests — the background video streams in pieces,
 *    and the Cache API refuses partial (206) responses.
 *
 * Kill switch: if this ever misbehaves in the wild, deploy a sw.js whose
 * activate handler calls `self.registration.unregister()`.
 */
const VERSION = 'v1';
const SHELL = `vibe-shell-${VERSION}`;
const ASSETS = `vibe-assets-${VERSION}`;
const FILES = `vibe-files-${VERSION}`;
const MAX_ASSETS = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS, FILES]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const cacheable = (response) => response && response.ok && response.type === 'basic';

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // Oldest first, so the newest deploy's files are the ones kept.
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (cacheable(response)) {
            const copy = response.clone();
            event.waitUntil(caches.open(SHELL).then((cache) => cache.put('/', copy)));
          }
          return response;
        } catch {
          return (await caches.match('/')) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (cacheable(response)) {
          const copy = response.clone();
          event.waitUntil(
            caches
              .open(ASSETS)
              .then((cache) => cache.put(request, copy))
              .then(() => trim(ASSETS, MAX_ASSETS)),
          );
        }
        return response;
      })(),
    );
    return;
  }

  if (url.pathname === '/sw.js') return;

  // The refresh is registered with `waitUntil` up front: calling it later,
  // after a cached copy has already been answered, throws, and the refreshed
  // file would silently never be saved.
  const refresh = caches.open(FILES).then(async (cache) => {
    const response = await fetch(request);
    if (cacheable(response)) await cache.put(request, response.clone());
    return response;
  });
  event.waitUntil(refresh.catch(() => undefined));
  event.respondWith(
    caches.open(FILES).then(async (cache) => (await cache.match(request)) ?? refresh),
  );
});
