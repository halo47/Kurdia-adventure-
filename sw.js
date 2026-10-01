const CACHE="kurdia-pwa-v2";
self.addEventListener("install",e=>e.waitUntil(self.skipWaiting()));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
 const r=e.request,u=new URL(r.url);
 if(r.method!=="GET"||u.origin!==self.location.origin||u.pathname.startsWith("/api/"))return;
 e.respondWith(fetch(r).catch(()=>caches.match(r).then(x=>x||caches.match("/"))));
});
self.addEventListener("push",e=>{
 let d={};try{d=e.data?e.data.json():{}}catch(_){d={body:e.data?.text?.()||""}}
 e.waitUntil(self.registration.showNotification(String(d.title||"KURDIA ADVENTURE"),{
  body:String(d.body||d.message||"ئاگادارییەکی نوێ"),
  icon:String(d.icon||"/icons/icon-192.png"),badge:String(d.badge||"/icons/icon-192.png"),
  dir:"rtl",lang:"ku",vibrate:[120,60,120],data:{url:String(d.url||"/")}
 }));
});
self.addEventListener("notificationclick",e=>{
 e.notification.close();const t=e.notification?.data?.url||"/";
 e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(a=>{
  for(const c of a){try{if(new URL(c.url).origin===self.location.origin){if(t!=="/"&&"navigate"in c)c.navigate(t);return c.focus()}}catch(_){}}
  return clients.openWindow(t);
 }));
});