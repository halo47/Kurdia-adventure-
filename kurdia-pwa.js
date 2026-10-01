(()=>{window.KurdiaPWA={
 registerSW:()=>navigator.serviceWorker?.register("/sw.js",{scope:"/"}),
 askNotifications:async()=>("Notification"in window)?Notification.requestPermission():"unsupported"
};addEventListener("load",()=>window.KurdiaPWA.registerSW?.());})();