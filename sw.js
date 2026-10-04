/* SIBAGI RPS: service worker. Tampilan disimpan supaya cepat dibuka; data selalu langsung dari server. */
var CACHE = 'sibagi-a9adbbf573';
var INTI = ['./', 'index.html', 'sibagi-api.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  // cache: 'reload' = ambil langsung dari server, bukan dari cache browser (GitHub Pages menyimpan berkas sampai 10 menit)
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(INTI.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;   // server SIBAGI & pustaka luar: langsung jaringan
  // jaringan dulu dan selalu dicek ulang ke server (no-cache), jadi update langsung terasa; cache kalau sedang offline.
  // Pakai URL-nya saja: permintaan navigasi tidak boleh dibuat ulang dengan opsi tambahan.
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) {
    if (r.ok) {
      var salin = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, salin); });
    }
    return r;
  }).catch(function () {
    return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); });
  }));
});
