// Offline-Cache: Netz zuerst, bei Ausfall der letzte gespeicherte Stand.
const CACHE = 'sub60-ernaehrung-v3';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
  );
});

// Trink-Erinnerung (Edge Function «water»): Nachricht zeigen, Tipp öffnet die App
self.addEventListener('push', (e) => {
  let m = {};
  try {
    m = e.data ? e.data.json() : {};
  } catch (_) {
    m = { body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(m.title || 'Zeit zu trinken', {
      body: m.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'water',
      renotify: true,
      data: { url: m.url || '/' },
    }),
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const w = list.find((c) => c.url.startsWith(self.registration.scope));
      return w ? w.focus() : self.clients.openWindow(url);
    }),
  );
});
