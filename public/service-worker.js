/* To Do service worker.
 * Two jobs:
 *  1) PWA: make the app installable + work offline via runtime caching.
 *  2) Notifications: better mobile-web display + click handling.
 * Time-based delivery for a fully closed tab would require Web Push (server +
 * VAPID) and is intentionally out of scope for this local-first app.
 */
const CACHE = 'learnplan-pwa-v2';
// Resolve against the SW script location so paths work under a subpath (e.g.
// GitHub Pages /todo-app/) as well as at the domain root.
const u = (p) => new URL(p, self.location.href).toString();
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './pwa-icon.png', './favicon.png'].map(u);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Network-first runtime caching for same-origin GET requests. Falls back to the
// cache when offline, and to the cached app shell for navigations.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === 'basic') {
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const shell = (await cache.match(u('./'))) || (await cache.match(u('./index.html')));
          if (shell) return shell;
        }
        throw err;
      }
    })(),
  );
});

// Allow the page to show notifications via the SW registration.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'show-notification') {
    self.registration.showNotification(data.title || 'Reminder', {
      body: data.body || '',
      icon: u('./pwa-icon.png'),
      tag: data.tag,
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(u('./'));
      return undefined;
    }),
  );
});
