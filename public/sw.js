// Service Worker for Hollywood Groove PWA
const CACHE_NAME = 'hollywood-groove-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/fonts/BudmoJigglish.woff2',
  '/fonts/BudmoJigglish.woff',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Only handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // Dev safety: don't let the SW interfere with localhost development servers.
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1' || self.location.hostname === '::1') {
    return;
  }

  // Avoid Chrome's "only-if-cached" + "no-cors" fetch error.
  // https://developer.chrome.com/docs/workbox/caching-strategies-overview/#avoid-opaque-only-if-cached
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
    return;
  }

  // Skip cross-origin requests
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // In Vite dev, bypass SW for HMR + module assets (these can break when cached/intercepted).
  const path = url.pathname;
  const isViteDevAsset =
    path === '/@vite/client' ||
    path.startsWith('/@vite/') ||
    path.startsWith('/@react-refresh') ||
    path.startsWith('/@fs/') ||
    path.startsWith('/src/') ||
    path.startsWith('/node_modules/') ||
    path.startsWith('/__vite_ping');

  if (isViteDevAsset) {
    return;
  }

  // Don't hijack standalone static HTML files (e.g. /font-test.html). Let them hit the network.
  if (event.request.mode === 'navigate' && path.endsWith('.html') && path !== '/index.html') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return offline page if available
          return caches.match('/index.html');
        });
      })
  );
});
