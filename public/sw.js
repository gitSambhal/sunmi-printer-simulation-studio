(() => {
  // src/sw.ts
  self.addEventListener("install", () => {
    self.skipWaiting();
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => Promise.all(cacheNames.map((name) => caches.delete(name)))).then(() => self.registration.unregister()).then(() => self.clients.claim())
    );
  });
  self.addEventListener("fetch", () => {
    return;
  });
})();
