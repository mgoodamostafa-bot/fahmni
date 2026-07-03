// Self-destructing Service Worker to completely disable PWA caching
// This ensures that users always get the freshest code and prevents offline bugs

self.addEventListener('install', (e) => {
  // Immediately install the new (empty) service worker
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Clear all existing caches on activation
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          console.log('[Service Worker] Deleting cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      // Force all clients to reload and unregister
      return self.clients.claim();
    })
  );
});

// Do not intercept any fetch requests. Just pass them through.
self.addEventListener('fetch', (e) => {
  // No caching logic here
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
