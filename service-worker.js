const CACHE_NAME = 'suuf-v3';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/firebase-config.js',
  './js/auth.js',
  './js/terrains.js',
  './js/messages.js',
  './js/notaires.js',
  './js/carte.js',
  './js/app.js',
  './manifest.json',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // On ne met en cache que les requêtes GET du même domaine ;
  // Firebase, tuiles OSM etc. passent toujours par le réseau.
  if (event.request.method !== 'GET') return;

  // Réseau d'abord (pour toujours avoir la dernière version en ligne),
  // secours sur le cache uniquement si hors-ligne ou requête échouée.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copie = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});
