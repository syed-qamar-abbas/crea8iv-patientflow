const CACHE_PREFIX = 'patientflow-';

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX))
        .map((key) => caches.delete(key)),
    );

    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await self.registration.unregister();

    await Promise.all(
      clients.map((client) => client.navigate(client.url)),
    );
  })());
});

// PatientFlow is live-data software. Do not intercept requests; the browser
// must always hit the current Node app and API instead of an old app cache.
self.addEventListener('fetch', () => {});
