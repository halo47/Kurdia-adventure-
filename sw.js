const CACHE = 'kurdia-adventure-v2';
const CORE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Never cache the service worker itself.
  const url = new URL(event.request.url);
  if (url.pathname === '/sw.js') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => {
            cache.put(event.request, copy).catch(() => {});
          }).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(response =>
          response || caches.match('/')
        )
      )
  );
});

self.addEventListener('push', event => {
  let data = {};

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (_) {
    try {
      data = { body: event.data ? event.data.text() : '' };
    } catch (__) {
      data = {};
    }
  }

  const title = String(data.title || 'KURDIA ADVENTURE');
  const options = {
    body: String(data.body || 'ئاگادارییەکی نوێ لە KURDIA ADVENTURE'),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'kurdia-adventure',
    renotify: true,
    requireInteraction: false,
    data: {
      url: String(data.url || '/')
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const target = event.notification?.data?.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      const absoluteUrl = new URL(target, self.location.origin).href;

      for (const client of clientList) {
        if ('navigate' in client) {
          client.navigate(absoluteUrl).catch(() => {});
        }
        if ('focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
    })
  );
});
