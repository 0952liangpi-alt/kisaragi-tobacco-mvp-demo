const CACHE_NAME = 'kisaragi-demo-v13-catalog';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './styles-base.css',
  './image-layer.css',
  './catalog-data.js',
  './app.js',
  './manifest.webmanifest',
  './assets/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  const catalogRuntime = /(?:world-tobacco|catalog-core|catalog-runtime|sprite-loader|user-sprite36|deployment-receipt)/.test(url.pathname);
  if (catalogRuntime) {
    event.respondWith(fetch(event.request, {cache:'no-store'}).catch(() => caches.match(event.request)));
    return;
  }
  const dest = event.request.destination;
  if (event.request.mode === 'navigate' || dest === 'style' || dest === 'image') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
