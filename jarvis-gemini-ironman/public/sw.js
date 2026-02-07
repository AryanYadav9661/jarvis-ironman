const cacheName = 'jarvis-ironman-v1';
const assets = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json'
];
self.addEventListener('install', (e)=>{ e.waitUntil(caches.open(cacheName).then(c=>c.addAll(assets))); self.skipWaiting(); });
self.addEventListener('activate', (e)=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e)=>{ e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))); });
