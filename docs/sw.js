/* Ateeq offline cache: everything the app needs is cached on the first visit,
   then served from the cache while a fresh copy is fetched in the background. */
var VERSION = 'ateeq-0.5.0';
var ASSETS = [
  './', 'index.html', 'site.css', 'site.js', 'privacy.html',
  'app/', 'app/index.html', 'app/app.css', 'app/app.js', 'app/logic.js', 'app/palettes.js', 'app/manifest.webmanifest',
  'data/rite.json', 'data/duas.json', 'data/i18n.json', 'data/faith.json',
  'fonts/fonts.css',
  'fonts/NotoKufiArabic-400-arabic.woff2', 'fonts/NotoKufiArabic-400-latin.woff2', 'fonts/NotoKufiArabic-400-latin-ext.woff2',
  'fonts/ScheherazadeNew-400-arabic.woff2', 'fonts/ScheherazadeNew-400-latin.woff2', 'fonts/ScheherazadeNew-400-latin-ext.woff2',
  'fonts/ScheherazadeNew-700-arabic.woff2', 'fonts/ScheherazadeNew-700-latin.woff2', 'fonts/ScheherazadeNew-700-latin-ext.woff2',
  'assets/icon.svg', 'assets/logo.svg', 'assets/mark-flat.svg', 'assets/mark-352.png', 'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) c.put(req, res.clone());
        return res;
      }).catch(function () { return hit || c.match('app/index.html'); });
      return hit || net;
    });
  }));
});
