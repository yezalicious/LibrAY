// LibrAY offline support: the app itself opens without a connection, and covers already seen stay available.
const SHELL = 'libray-shell-v3';
const MEDIA = 'libray-media-v1';
const SHELL_FILES = ['./', 'index.html', 'zxing.min.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
const MEDIA_HOSTS = ['covers.openlibrary.org', 'archive.org', 'books.google.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== MEDIA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    // App files: newest when online, cached copy when not.
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(SHELL).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match('index.html')))
    );
    return;
  }

  if (MEDIA_HOSTS.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) {
    // Covers and fonts: cached copy first.
    event.respondWith(
      caches.open(MEDIA).then(cache =>
        cache.match(request).then(hit => hit || fetch(request).then(response => {
          cache.put(request, response.clone());
          return response;
        }))
      )
    );
  }
});
