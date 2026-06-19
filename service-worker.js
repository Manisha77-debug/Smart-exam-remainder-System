const CACHE_NAME = 'exam-app-v3';
const urlsToCache = [
  "/",
  "/index.html",
  "/student.html",
  "/admin.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/icons/icon-v2-192.png",
  "/icons/icon-v2-512.png"
];

// Install
/*self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate
self.addEventListener("activate", event => {
  console.log("Service Worker Activated");
});

// Fetch
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});*/
self.addEventListener("install", event => {
  self.skipWaiting(); // force activation
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim()); // control page immediately
  console.log("Service Worker Activated");
});