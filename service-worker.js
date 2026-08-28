const CACHE_NAME = 'kisaragi-demo-v7';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './catalog-data.js',
  './app.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/catalog/image2.jpg',
  './assets/catalog/image3.png',
  './assets/catalog/image4.jpg',
  './assets/catalog/image5.jpg',
  './assets/catalog/image8.jpg',
  './assets/catalog/image17.jpg'
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
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
