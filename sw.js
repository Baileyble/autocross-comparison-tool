// Network-first service worker: always tries the latest version, falls back to cache offline.
const CACHE = 'racecompare-v2';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/main.js', 'js/ui.js', 'js/store.js', 'js/model.js', 'js/signal.js', 'js/players.js', 'js/sync.js',
  'js/analyze.js', 'js/common.js', 'js/charts.js', 'js/timeline.js', 'js/automark.js', 'icon.svg',
  'js/views/library.js', 'js/views/event.js', 'js/views/run.js', 'js/views/compare.js',
  'js/views/progress.js', 'js/views/settings.js', 'js/views/import.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // YouTube etc. go straight to network
  e.respondWith(
    fetch(e.request)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
