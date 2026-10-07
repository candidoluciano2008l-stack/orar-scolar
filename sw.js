const CACHE="orar-scolar-v12";
const APP_SHELL=["/","/index.html","/styles.css","/manifest.json","/icon.svg"];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?.json()||{}}catch(_){data={body:event.data?.text()||""}}
  const title=data.title||"Orarul meu";
  const body=data.body||"Ai o noutate pe site.";
  const options={
    body,
    icon:"/icon.svg",
    badge:"/icon.svg",
    tag:data.tag||"orar-update",
    renotify:true,
    data:{url:data.data?.url||"https://orar-scolar.vercel.app/"}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=event.notification.data?.url||"/";
  event.waitUntil(
    clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
      const existing=list.find(client=>client.url.startsWith(self.location.origin));
      if(existing){
        existing.focus();
        existing.navigate(target);
        return;
      }
      return clients.openWindow(target);
    })
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const isHtmlRequest=event.request.mode==="navigate" || url.pathname==="/" || url.pathname==="/index.html";
  event.respondWith(
    (isHtmlRequest
      ? fetch(new Request(event.request,{cache:"no-store"}))
      : fetch(event.request)
    ).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
      return response;
    }).catch(()=>caches.match(event.request).then(response=>response||caches.match("/index.html")))
  );
});
