// Network-first app shell: avoid serving stale HTML and CSS after deployment.
const CACHE = 'webpfyer-v2-network-first';
const APP_SHELL = [
  './', './index.html', './404.html', './manifest.webmanifest',
  './assets/css/style.css?v=20261103-blue3', './assets/js/app.js',
  './assets/js/presets.js', './assets/js/image.js', './assets/js/zip.js',
  './assets/js/html.js', './assets/icons/favicon.svg',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
