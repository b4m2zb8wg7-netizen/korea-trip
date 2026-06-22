/* Service worker — makes the app work offline.
   Bump CACHE_VERSION whenever you change the files below so users get the update. */

const CACHE_VERSION = "korea-trip-v17";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./activities.json"
];

// Install: pre-cache the core app files.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: drop any old caches from previous versions.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy (same-origin only; CDN / map tiles always go to the network):
//   • activities.json — NETWORK-FIRST so your data edits show up immediately when
//     online, falling back to the cached copy when offline.
//   • everything else (the app shell) — CACHE-FIRST for speed and offline use.
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // CDN / map tiles → network

  if (url.pathname.endsWith("/activities.json")) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Refresh the cached copy for next time we're offline.
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request))
  );
});
