/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Self-clearing Service Worker: immediately claims clients, deletes all caches, and unregisters itself
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(cacheNames.map((name) => caches.delete(name))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});

// Pass all requests directly through to the network
self.addEventListener('fetch', () => {
  // Do not intercept or block any requests
  return;
});
