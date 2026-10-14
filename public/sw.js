// horospaper's service worker: just enough to make the app installable
// (and packageable as an Android app) and to show a friendly page when
// there's no connection. It caches nothing else -- every page and reading
// always comes fresh from the network, so a stale horoscope is never shown.
const CACHE = "horospaper-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Drop older versions' caches.
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Only page loads: network first, the offline page if that fails.
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
