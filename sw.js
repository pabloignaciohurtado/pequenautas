/* Pequeñautas Service Worker — app shell offline, cache-first + limpieza de versiones */
const CACHE='pequenautas-v1';
const SHELL=['./','./index.html','./app.js','./manifest.webmanifest'];
const FONT_HOSTS=['fonts.googleapis.com','fonts.gstatic.com'];

self.addEventListener('install',(e)=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()).catch(()=>{})
  );
});

self.addEventListener('activate',(e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE && k.indexOf('pequenautas-')===0).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',(e)=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  const sameOrigin=url.origin===self.location.origin;
  const isFont=FONT_HOSTS.indexOf(url.hostname)!==-1;
  if(!sameOrigin && !isFont) return;
  e.respondWith(
    caches.match(req).then(cached=>{
      if(cached) return cached;
      return fetch(req).then(res=>{
        if(res && (res.ok || res.type==='opaque')){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
        }
        return res;
      }).catch(()=>{
        if(req.mode==='navigate') return caches.match('./index.html');
        return cached;
      });
    })
  );
});
