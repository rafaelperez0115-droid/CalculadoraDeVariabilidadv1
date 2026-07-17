// Service Worker - C&S Industries Calculadora de Variabilidad
// Compatible con GitHub Pages en subcarpeta
// v5: network-first para index.html (siempre busca la versión más reciente)
const CACHE_NAME = 'cs-variabilidad-v5';
const BASE = self.location.pathname.replace('/sw.js', '');

const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
  // Firebase SDK (para que la app cargue sin internet)
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .catch(err => console.warn('[SW] Cache parcial:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ¿Es una petición del index.html o navegación?
function esIndex(request) {
  if (request.mode === 'navigate') return true;
  const url = new URL(request.url);
  return url.pathname === BASE + '/' || url.pathname === BASE + '/index.html';
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;

  // Nunca interceptar el tráfico de Firestore/Auth (tiempo real y sincronización)
  if (url.includes('firestore.googleapis.com') ||
      url.includes('identitytoolkit.googleapis.com') ||
      url.includes('securetoken.googleapis.com')) return;

  // NETWORK-FIRST para index.html:
  // siempre intenta traer la versión más reciente; usa caché solo sin internet.
  // Así, subir un index.html corregido a GitHub se refleja de inmediato.
  if (esIndex(event.request)) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() =>
        caches.match(event.request).then(c => c || caches.match(BASE + '/index.html'))
      )
    );
    return;
  }

  // CACHE-FIRST para el resto (iconos, manifest, SDK de Firebase)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const cacheable = response && response.status === 200 &&
          (response.type === 'basic' || url.includes('www.gstatic.com/firebasejs'));
        if (cacheable) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(BASE + '/index.html'));
    })
  );
});
