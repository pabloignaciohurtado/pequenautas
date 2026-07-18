/* Aventuras en el Bosque - Service Worker
   network-first (mismo origen) para que las actualizaciones lleguen siempre que haya red;
   cache como respaldo offline. Fuentes en cache-first. Bump de version para purgar cache viejo. */
const CACHE='pequenautas-v3';
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
  const isFont=FONT_HOSTS.indexOf(url.hostname)!==-1; // Fredoka (CSS + woff2) para uso offline
  if(!sameOrigin && !isFont) return;                 // el resto va directo a la red

  if(isFont){
    // cache-first para fuentes (rara vez cambian; sirve offline)
    e.respondWith(
      caches.match(req).then(cached=>cached || fetch(req).then(res=>{
        if(res && (res.ok || res.type==='opaque')){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
        }
        return res;
      }))
    );
    return;
  }

  // network-first para mismo origen: siempre trae la ultima version cuando hay red,
  // refresca el cache, y cae al cache (o al index.html) si no hay conexion.
  e.respondWith(
    fetch(req,{cache:'reload'}).then(res=>{
      if(res && res.ok){
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
      }
      return res;
    }).catch(()=>
      caches.match(req).then(cached=>
        cached || (req.mode==='navigate' ? caches.match('./index.html') : undefined)
      )
    )
  );
});
