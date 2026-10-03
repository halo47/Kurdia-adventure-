/* KURDIA ADVENTURE — Root Service Worker
 * Native Web Push / PWA only.
 *
 * IMPORTANT:
 * OneSignal is intentionally NOT imported here.
 * OneSignal uses its own isolated worker at /onesignal/OneSignalSDKWorker.js.
 * This prevents OneSignal SDK evaluation errors from breaking the root
 * service worker used by KURDIA's native Admin/site push.
 */
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {
      title: "KURDIA ADVENTURE",
      body: event.data ? event.data.text() : ""
    };
  }

  // Ignore OneSignal-shaped payloads defensively if they ever reach this worker.
  let custom = data && data.custom;
  if (typeof custom === "string") {
    try { custom = JSON.parse(custom); } catch (_) {}
  }
  if (custom && (custom.i || custom.a)) return;
  if (data && (data.onesignal || data.oneSignal)) return;

  const title = String(data.title || "KURDIA ADVENTURE");
  const body = String(data.body || "ئاگادارییەکی نوێ هەیە.");
  const url = String(data.url || "/");
  const tag = String(data.tag || "kurdia-notification");

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag,
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url }
    })
  );
});

self.addEventListener("notificationclick", event => {
  const ndata = event.notification && event.notification.data;

  // OneSignal owns its own notification click handling in its isolated worker.
  if (ndata && (ndata.onesignal || ndata.oneSignal)) return;

  event.notification.close();
  const target = ndata && ndata.url ? ndata.url : "/";

  event.waitUntil((async () => {
    const list = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of list) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) {
          try { await client.navigate(target); } catch (_) {}
        }
        return;
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(target);
    }
  })());
});
