/*
  Social Receipt — Service Worker
  Network-first for the app shell so deployed fixes reach phones reliably.
*/

var CACHE_NAME = "social-receipt-v18-network-first";
var OFFLINE_URL = "/index.html";
var PRECACHE_URLS = [
  "/",
  "/index.html",
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
