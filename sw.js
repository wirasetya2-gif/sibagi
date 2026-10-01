/* SIBAGI RPS: service worker. Tampilan disimpan supaya cepat dibuka; data selalu langsung dari server. */
var CACHE = 'sibagi-a0a8d3c89d';
var INTI = ['./', 'index.html', 'sibagi-api.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(INTI); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;   // server SIBAGI & pustaka luar: langsung jaringan
  // jaringan dulu (update langsung terasa), cache kalau sedang offline
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok) {
      var salin = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, salin); });
    }
    return r;
  }).catch(function () {
    return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); });
  }));
});
