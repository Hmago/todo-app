/* To Do service worker.
 * Two jobs:
 *  1) PWA: make the app installable + work offline via runtime caching.
 *  2) Notifications: better mobile-web display + click handling.
 * Time-based delivery for a fully closed tab would require Web Push (server +
 * VAPID) and is intentionally out of scope for this local-first app.
 */
const CACHE = 'learnplan-pwa-v3';
// Resolve against the SW script location so paths work under a subpath (e.g.
// GitHub Pages /todo-app/) as well as at the domain root.
const u = (p) => new URL(p, self.location.href).toString();
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './pwa-icon.png', './favicon.png'].map(u);

// How long a navigation may wait for the network before we fall back to the
// cached app shell. iOS Safari can leave fetches hanging for a long time when a
// backgrounded PWA resumes on a flaky connection — without this bound the app
// appears frozen on a blank screen until the request finally errors.
const NAV_TIMEOUT_MS = 3500;

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

// Immutable, content-hashed build assets (Expo emits them under /_expo/static/)
// plus the usual static file types. These never change for a given URL, so we
// serve them cache-first and refresh in the background (stale-while-revalidate).
function isStaticAsset(url) {
  return (
    url.pathname.includes('/_expo/') ||
    /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|avif|woff2?|ttf|otf|ico)$/i.test(url.pathname)
  );
}

function fetchAndCache(cache, req) {
  return fetch(req).then((res) => {
    if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
    return res;
  });
}

// Stale-while-revalidate: return the cached copy immediately (instant load, no
// network dependency) while fetching a fresh copy in the background for next
// time. This is what removes the "hangs while loading" behaviour on mobile —
// the 1MB JS bundle no longer blocks startup on a network round-trip.
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetchAndCache(cache, req).catch(() => undefined);
  if (cached) {
    network; // fire-and-forget revalidation
    return cached;
  }
  const res = await network;
  if (res) return res;
  throw new Error('offline and not cached');
}

// Network-first with a hard timeout, falling back to the cache and finally to
// the cached app shell. Used for navigations / HTML so a slow or stalled
// network can never freeze the first paint.
async function networkFirstNavigation(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('nav-timeout')), NAV_TIMEOUT_MS);
      fetch(req).then(
        (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
    if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    const shell = (await cache.match(u('./'))) || (await cache.match(u('./index.html')));
    if (shell) return shell;
    throw err;
  }
}

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

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(req));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Other same-origin GETs (e.g. manifest): cache-first with background refresh
  // keeps them resilient offline without ever blocking on the network.
  event.respondWith(staleWhileRevalidate(req));
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
