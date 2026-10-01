const CACHE_NAME = "kurdia-pwa-v1";
const CORE = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE).catch(()=>{})).then(()=>self.skipWaiting())); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener("fetch", event => {
  const r=event.request;
  if(r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return;
  const u=new URL(r.url);
  if(u.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(r).then(res=>{
    if(res.ok && (r.mode === "navigate" || /\.(?:html|css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(u.pathname))){
      const copy=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(r,copy)).catch(()=>{});
    }
    return res;
  }).catch(()=>caches.match(r).then(x=>x || caches.match("/"))));
});
self.addEventListener("push", event => {
  let data={};
  try{ data=event.data ? event.data.json() : {}; }catch(_){ data={body:event.data?.text?.()||""}; }
  const title=String(data.title||"KURDIA ADVENTURE");
  const options={
    body:String(data.body||data.message||"ئاگادارییەکی نوێ لە KURDIA ADVENTURE"),
    icon:String(data.icon||"/icons/icon-192.png"),
    badge:String(data.badge||"/icons/icon-192.png"),
    dir:"rtl", lang:"ku", vibrate:[120,60,120],
    tag:String(data.tag||("kurdia-"+Date.now())),
    renotify:true,
    data:{url:String(data.url||"/")}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target=event.notification?.data?.url || "/";
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const c of list){ if("focus" in c){ try{ if(new URL(c.url).origin===self.location.origin){ if(target && target!=="/") c.navigate(target); return c.focus(); } }catch(_){} } }
    return clients.openWindow(target);
  }));
});
