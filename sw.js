/* Aventuras en el Bosque - Service Worker
   network-first (mismo origen) para que las actualizaciones lleguen siempre que haya red;
   cache como respaldo offline. Fuentes en cache-first. Bump de version para purgar cache viejo.

   Precache progresivo en segundo plano (feat/carga-progresiva): tras activarse,
   el SW descarga y cachea en background TODOS los módulos de fase4/ (spec.css +
   spec.js + los archivos que sus spec.css importan vía @import, p.ej. img/*.css
   con imágenes en base64) para que la app quede completamente disponible offline
   sin que el peque tenga que visitar cada pantalla primero. Reporta progreso real
   (no simulado) a las páginas controladas vía postMessage, para alimentar una
   barra de progreso en el primer pintado (ver fase4/50-progreso-carga). Un fetch
   que falla no detiene el resto: reintenta un par de veces y sigue.

   Dos políticas, no una (v4). El shell —navegación, app.js, manifest— sigue
   siendo network-first: es donde vive la lógica y una versión vieja ahí sí
   duele. Los módulos de fase4/ pasan a stale-while-revalidate, y el motivo es
   que la política anterior era contraproducente: forzaba cache:'reload' en
   TODO el mismo origen, así que en cada visita se volvían a bajar por red las
   ~28 piezas críticas de arte y la caché sólo servía de red offline, nunca
   para ir rápido. Resultado visible: al reabrir la app se veía el diseño en
   línea de index.html (el viejo) hasta que llegaba el arte. Ahora el arte se
   sirve de la caché al instante y se revalida por detrás, de modo que un
   despliegue nuevo entra en la visita siguiente —y de inmediato si cambió la
   versión de CACHE, porque activate() purga y runPrecache() vuelve a bajarlo
   todo con el portón de #50 en pantalla. */
/* v5: entra #61 con la voz locutada de Rufo. Se sube la versión a propósito
   —aunque el worker no cambie de política— porque los clips llegan dentro de
   archivos nuevos y queremos que activate() purgue y runPrecache() los baje de
   una vez, con el portón de #50 en pantalla, en lugar de que Rufo estrene voz
   a trozos según qué frase toque primero. */
/* v6: entra #62 con la voz grabada de la narradora. Se sube la versión por lo
   mismo que en v5: los clips llegan en archivos nuevos y conviene que
   activate() purgue y runPrecache() los baje de una vez, con el portón de #50
   en pantalla, en lugar de que la narradora estrene voz a trozos según qué
   frase toque primero. */
const CACHE='pequenautas-v6';
const SHELL=['./','./index.html','./app.js','./manifest.webmanifest'];
const FONT_HOSTS=['fonts.googleapis.com','fonts.gstatic.com'];

// Mismo listado (y mismo orden de referencia) que fase4/fase4.js. El orden no
// importa aquí -el precache es puramente una optimización de background/offline,
// no una dependencia de arranque- pero se mantiene la lista completa para que
// nada quede sin cachear.
const FASE4_MODULES=[
  '01-eval-pre-post','02-ab-testing','03-repaso-espaciado','04-indice-dominio','05-deteccion-frustracion',
  '11-materias-nuevas','12-mates-avanzadas','13-lectura-avanzada','14-ciencias-avanzada','15-cms-json',
  '07-secuenciacion','06-motor-adaptativo','08-zdp-dinamica','09-recomendador',
  '17-accesibilidad','18-dislexia','61-voz-rufo','62-voz-narradora','16-voces-mascota','20-animaciones-personaje','30-controles-parentales',
  '19-album-logros','21-reporte-semanal','22-metas-semanales','23-modo-aula',
  '28-pwa-tiendas',
  '31-identidad-visual','32-pantallas-bosque','33-hero-diorama','34-juegos','35-cajas3d',
  '36-gate-esquina','37-nav-iconos','38-bosque-arte','39-fondo-vivo','40-secciones-fondo',
  '41-fondo-juego','42-pantallas-fondo',
  '46-hud-iconos','47-opciones-layout','48-avatares','49-iconos-quiz-letras','50-progreso-carga',
  '51-hero-globo','52-juegos-tarjetas','53-formas-colores','54-ingenio','55-musica',
  '56-arrastrar','57-ambiente','58-emociones','59-puente-calma','60-habitos'
];

const PRECACHE_STATE={status:'idle',done:0,total:0,failed:[]};

self.addEventListener('install',(e)=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()).catch(()=>{})
  );
});

self.addEventListener('activate',(e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE && k.indexOf('pequenautas-')===0).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim()).then(()=>{ runPrecache(); })
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

  // stale-while-revalidate para los modulos de fase4/: el arte pesa y casi
  // nunca cambia, asi que responder desde cache es lo que hace que al reabrir
  // la app el bosque ya este ahi en el primer pintado en vez de aparecer a
  // pedazos. La revalidacion va por detras, sin bloquear la respuesta, y deja
  // la version nueva lista para la visita siguiente. Un despliegue que cambie
  // arte de verdad viene acompanado de un bump de CACHE, y entonces activate()
  // purga y runPrecache() lo baja todo de una con el porton de #50 delante.
  if(url.pathname.indexOf('/fase4/')!==-1){
    e.respondWith(
      caches.match(req).then(cached=>{
        const red=fetch(req).then(res=>{
          if(res && res.ok){
            const copy=res.clone();
            caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
          }
          return res;
        });
        if(cached){ red.catch(()=>{}); return cached; }
        return red.catch(()=>undefined);
      })
    );
    return;
  }

  // network-first para el resto del mismo origen (shell y logica): siempre trae la ultima version cuando hay red,
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

self.addEventListener('message',(e)=>{
  const d=e && e.data;
  if(!d || !d.type) return;
  if(d.type==='PA_QUERY_PRECACHE'){
    try{
      e.source && e.source.postMessage(
        PRECACHE_STATE.status==='done'
          ? {type:'precache-complete', failed:PRECACHE_STATE.failed}
          : {type:'precache-progress', done:PRECACHE_STATE.done, total:PRECACHE_STATE.total}
      );
    }catch(err){}
  }
});

function fase4Assets(){
  const base='./fase4/';
  const urls=[];
  FASE4_MODULES.forEach(m=>{ urls.push(base+m+'/spec.css'); urls.push(base+m+'/spec.js'); });
  return urls;
}

function fetchWithRetry(url,attempts){
  attempts = attempts || 3;
  return fetch(url,{cache:'no-cache'}).then(res=>{
    if(!res || !(res.ok || res.type==='opaque')) throw new Error('bad-response');
    return res;
  }).catch(err=>{
    if(attempts>1) return fetchWithRetry(url, attempts-1);
    throw err;
  });
}

function extractImports(cssText, cssUrl){
  const out=[];
  const re=/@import\s+url\(["']?([^"')]+)["']?\)/g;
  let m;
  while((m=re.exec(cssText))){
    try{ out.push(new URL(m[1], cssUrl).href); }catch(e){}
  }
  return out;
}

function broadcast(msg){
  return self.clients.matchAll({includeUncontrolled:true}).then(list=>{
    list.forEach(c=>{ try{ c.postMessage(msg); }catch(e){} });
  }).catch(()=>{});
}

// Descarga+cachea cada módulo (y los archivos que su spec.css importa vía
// @import, p.ej. img/*.css con las imágenes base64) uno a uno para reportar
// progreso granular. Un fallo puntual no detiene el resto (se reintenta y,
// si sigue fallando, se salta y se registra en PRECACHE_STATE.failed).
function precacheOne(cache, url){
  return fetchWithRetry(url,3).then(res=>{
    const copy=res.clone();
    return cache.put(url, copy).then(()=>res);
  }).then(res=>{
    if(!/\.css($|\?)/.test(url)) return;
    return res.clone().text().then(txt=>{
      const imports = extractImports(txt, url);
      return Promise.all(imports.map(iu=>
        fetchWithRetry(iu,2).then(ires=>cache.put(iu, ires)).catch(()=>{ PRECACHE_STATE.failed.push(iu); })
      ));
    }).catch(()=>{});
  }).catch(()=>{ PRECACHE_STATE.failed.push(url); });
}

function runPrecache(){
  if(PRECACHE_STATE.status==='running' || PRECACHE_STATE.status==='done') return Promise.resolve();
  const urls = fase4Assets();
  PRECACHE_STATE.status='running';
  PRECACHE_STATE.total=urls.length;
  PRECACHE_STATE.done=0;
  PRECACHE_STATE.failed=[];
  return caches.open(CACHE).then(cache=>{
    let chain = Promise.resolve();
    urls.forEach(u=>{
      chain = chain.then(()=>precacheOne(cache, u)).then(()=>{
        PRECACHE_STATE.done++;
        return broadcast({type:'precache-progress', done:PRECACHE_STATE.done, total:PRECACHE_STATE.total});
      });
    });
    return chain;
  }).then(()=>{
    PRECACHE_STATE.status='done';
    return broadcast({type:'precache-complete', failed:PRECACHE_STATE.failed});
  }).catch(()=>{
    PRECACHE_STATE.status='done';
    return broadcast({type:'precache-complete', failed:PRECACHE_STATE.failed});
  });
}
