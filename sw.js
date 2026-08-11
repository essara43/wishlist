/* ==========================================================================
   sw.js — Service worker de la PWA.
   Deux rôles : rendre l'application installable, et la garder utilisable
   hors ligne. Aucune donnée utilisateur ne transite ici : les articles
   restent dans le localStorage de la page.
   ========================================================================== */

/* Incrémenter cette version à chaque modification des fichiers listés :
   l'ancien cache est alors supprimé à l'activation. */
const CACHE = 'wishlist-manager-v1';

const RESSOURCES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/model.js',
  './js/store.js',
  './js/filters.js',
  './js/io.js',
  './js/ui.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(RESSOURCES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cles) =>
      Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
    )
  );
  self.clients.claim();
});

/* Réseau d'abord : un déploiement récent est toujours pris en compte quand la
   connexion est disponible, le cache ne servant que de repli hors ligne.
   Les requêtes vers d'autres domaines (images d'articles saisies par
   l'utilisateur) ne sont jamais mises en cache. */
self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (requete.method !== 'GET') return;
  if (new URL(requete.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(requete)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE).then((cache) => cache.put(requete, copie));
        return reponse;
      })
      .catch(() => caches.match(requete).then((c) => c || caches.match('./index.html')))
  );
});
