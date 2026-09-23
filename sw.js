/*
  Social Receipt — Service Worker
  Strategy: cache-first for app shell, network-first for external fonts
  Version bump the CACHE_NAME when you deploy updates.
*/

var CACHE_NAME = "social-receipt-v16-stable-fix";
var OFFLINE_URL = "/index.html";

/* Files to cache on install — every URL here must exist in the repo,
   or cache.addAll() rejects and NOTHING gets precached (see the v14 bug
   this replaced: it referenced a file that was never actually deployed). */
var PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

/* Install — cache app shell immediately */
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

/* Activate — clean old caches */
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* Fetch — cache first for app shell, network first for fonts */
self.addEventListener("fetch", function(event) {
  var url = event.request.url;

  /* Google Fonts — network first, fallback to cache */
  if (url.indexOf("fonts.googleapis.com") !== -1 ||
      url.indexOf("fonts.gstatic.com") !== -1) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  /* App shell — cache first, network fallback */
  if (event.request.mode === "navigate" ||
      url.indexOf(".html") !== -1 ||
      url.indexOf("manifest.json") !== -1) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        }).catch(function() {
          /* Offline fallback */
          return caches.match(OFFLINE_URL);
        });
      })
    );
    return;
  }

  /* Default: try network, fall back to cache */
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});
