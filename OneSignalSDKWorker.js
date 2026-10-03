/* KURDIA ADVENTURE — Unified Root Service Worker
 * OneSignal Web Push v16 + existing KURDIA PWA/custom push logic.
 * This single root worker prevents two root-scope service workers from competing.
 */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { title: 'KURDIA ADVENTURE', body: event.data ? event.data.text() : '' }; }

  // OneSignal's own SDK handles OneSignal payloads. Do not create a duplicate notification.
  let custom = data && data.custom;
  if (typeof custom === 'string') {
    try { custom = JSON.parse(custom); } catch (_) {}
  }
  if (custom && (custom.i || custom.a)) return;
  if (data && (data.onesignal || data.oneSignal)) return;

  const title = String(data.title || 'KURDIA ADVENTURE');
  const body = String(data.body || 'ئاگادارییەکی نوێ هەیە.');
  const url = String(data.url || '/');
  const tag = String(data.tag || 'kurdia-notification');
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url }
  }));
});

self.addEventListener('notificationclick', event => {
  // OneSignal notifications are handled by the OneSignal SDK listener.
  const ndata = event.notification && event.notification.data;
  if (ndata && (ndata.onesignal || ndata.oneSignal)) return;

  event.notification.close();
  const target = ndata && ndata.url ? ndata.url : '/';
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
