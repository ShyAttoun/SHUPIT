/* SHUPIT service worker.
 * - App shell: network-first for navigations, with cached shell / offline page as fallback.
 * - Static build assets (hashed) and icons: cache-first.
 * - /api/* and anything cross-origin (Firebase, merchant images, icons): never cached.
 * - Web Share Target: receives POST /share (text, url, image) and hands it to the app.
 * Authenticated data is never stored by this worker.
 */
const VERSION = 'v4';
const SHELL_CACHE = `shupit-shell-${VERSION}`;
const ASSET_CACHE = `shupit-assets-${VERSION}`;
const SHARE_CACHE = 'shupit-share-v1';
const PRECACHE = ['/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.svg', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE, SHARE_CACHE]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function handleShare(request) {
  try {
    const form = await request.formData();
    const cache = await caches.open(SHARE_CACHE);
    const file = form.get('image');
    const meta = {
      title: String(form.get('title') || ''),
      text: String(form.get('text') || ''),
      url: String(form.get('url') || ''),
      hasImage: file instanceof File && file.size > 0 && file.type.startsWith('image/'),
      at: Date.now(),
    };
    if (meta.hasImage) {
      await cache.put('/__shared/image', new Response(file, { headers: { 'content-type': file.type } }));
    } else {
      await cache.delete('/__shared/image');
    }
    await cache.put('/__shared/meta', new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }));
  } catch (_) {
    // fall through: the app will show an empty share screen
  }
  return Response.redirect('/share?from=target', 303);
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'SHUPIT', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'SHUPIT', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      tag: data.tag || undefined,
      data: { url: data.url || '/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/notifications';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('focus' in c) {
          await c.focus();
          if ('navigate' in c) await c.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method === 'POST' && url.origin === location.origin && url.pathname === '/share') {
    event.respondWith(handleShare(req));
    return;
  }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Precached static files (offline page, manifest, icons): cache first.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(url.pathname)) || fetch(req);
      })(),
    );
    return;
  }

  // Navigations: network first, then the cached shell, then the offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && res.type === 'basic') {
            const cache = await caches.open(SHELL_CACHE);
            cache.put('/', res.clone());
          }
          return res;
        } catch (_) {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match('/')) || (await cache.match('/offline.html')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Hashed build output and icons are immutable: cache first.
  if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
  }
});
