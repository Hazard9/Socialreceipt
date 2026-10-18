/*
  Social Receipt — Service Worker
  Network-first for the app shell so deployed fixes reach phones reliably.
*/

/* Merged cache lineage: social-receipt-v27-journal + social-receipt-v27-share-card + social-receipt-v27-first-thirty + social-receipt-v28-share-card + social-receipt-v29-first-thirty + social-receipt-v30-return-loop + social-receipt-v31-evidence + social-receipt-v31-first-peel + social-receipt-v32-first-peel */
var CACHE_NAME = "social-receipt-v33-scripts";
var OFFLINE_URL = "/index.html";
var PRECACHE_URLS = [
  "/",
  "/index.html",
  "/presend-analysis.js",
  "/draft-guidance.js",
  "/deep-layers.js",
  "/both-sides.js",
  "/share-card.js",
  "/journal.js",
  "/return-loop.js",
  "/app-language.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).catch(function(err) {
      console.log("SW precache failed:", err);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(cacheNames.filter(function(name) {
        return name !== CACHE_NAME;
      }).map(function(name) {
        return caches.delete(name);
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function(event) {
  var url = event.request.url;

  if (url.indexOf("fonts.googleapis.com") !== -1 || url.indexOf("fonts.gstatic.com") !== -1) {
    event.respondWith(fetch(event.request).then(function(response) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
      return response;
    }).catch(function() { return caches.match(event.request); }));
    return;
  }

  if (event.request.mode === "navigate" || url.indexOf(".html") !== -1 || url.indexOf("manifest.json") !== -1) {
    event.respondWith(fetch(event.request, { cache: "no-store" }).then(function(response) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
      return response;
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        return cached || caches.match(OFFLINE_URL);
      });
    }));
    return;
  }

  event.respondWith(fetch(event.request).catch(function() { return caches.match(event.request); }));
});
