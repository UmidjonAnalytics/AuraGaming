/* Kassa — service worker.
   Ilova fayllari keshlanadi: internet bo'lmasa ham ochiladi.
   Ma'lumot (operatsiyalar) baribar qurilmada saqlanadi va aloqa
   tiklanganda Google Sheets'ga yuboriladi. */

const VERSION = 'kassa-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './logo.png',
  './icon-512.png',
  './vendor/jspdf.umd.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // sinxronlash so'rovlariga tegmaymiz

  const url = new URL(req.url);
  if (url.hostname.endsWith('script.google.com')) return;   // backend — hech qachon keshlanmaydi

  // Ilova fayli: avval tarmoq (yangilanish tushishi uchun), bo'lmasa kesh
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
