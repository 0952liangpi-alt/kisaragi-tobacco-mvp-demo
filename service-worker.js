const CACHE_NAME = 'kisaragi-demo-v20-company';
const APP_SHELL = ['./', './index.html', './company.css', './company.js', './assets/tougu-mark.svg', './manifest.webmanifest'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => /^kisaragi-demo-v\d+(?:-|$)/.test(key) && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const allowed = APP_SHELL.map((path) => new URL(path, self.registration.scope).href);
  if (!allowed.includes(url.href)) return;
  event.respondWith(fetch(event.request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, response.clone());
    }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(event.request)) || Response.error();
  }));
});
