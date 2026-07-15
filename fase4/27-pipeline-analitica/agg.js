/* ==================== #27 Pipeline de analítica agregada anonimizada — agg.js (SCAFFOLD, gated OFF) ====================
   Módulo NUEVO y separado (no se toca app.js ni index.html). Aditivo: solo define
   window.PequeAggPipeline y compone window.PEQUE_FLAGS sin pisar valores existentes
   (mismo mecanismo que sync.js del punto #25).

   QUÉ ES ESTO (y qué NO es):
   - #25 (backend-supabase/sync.js) diseña la sync PSEUDONIMIZADA por niño (alias +
     eventos crudos) para alimentar el panel del educador/tutor DEL MISMO adulto que
     los generó. Sigue siendo "sus datos, su panel".
   - #27 (este módulo) diseña un pipeline DISTINTO: analítica de producto agregada
     entre TODOS los dispositivos que opten por participar, para responder preguntas
     de contenido ("¿qué letra es la más difícil globalmente?", "¿tiempo medio por
     ítem por franja de edad?"). Aquí NO hay cuenta de adulto, NO hay alias, NO hay
     identificador de perfil/niño en ningún punto de la cadena. Solo CONTEOS
     agregados por (juego, ítem, franja de edad, semana) etiquetados con un id de
     DISPOSITIVO anónimo y rotable — nunca un id de niño.
   - La anonimización real (k-anonimato) se aplica en el SERVIDOR (ver sql/021_kanon_views.sql):
     ningún bucket se publica si participan menos de k dispositivos distintos. Este
     archivo solo puede preparar/encolar conteos; nunca decide qué se publica.

   REGLA DURA: bajo el flag por defecto (window.PEQUE_FLAGS.analyticsAgg === false,
   que este mismo archivo fija) o bajo location.protocol === 'file:', o si falta
   configuración/consentimiento, este módulo NO ejecuta ningún fetch/XHR/WebSocket,
   ni de red ni local, en ningún punto de su ciclo de vida. rollupLocal() y
   kAnonFilter() son funciones PURAS (sin efectos secundarios, sin red) y pueden
   usarse/probarse offline ahora mismo; solo enqueue()/flush() tocarían red en un
   futuro con las 4 condiciones cumplidas, y flush() está deliberadamente sin
   implementar el fetch real (ver más abajo "Por qué agg.js NUNCA hace red hoy").
*/
(function(){
  "use strict";

  var VERSION = '0.1.0-scaffold';

  /* -------- 0) Flag global NUEVO e independiente de backendSync (#25). Participar en
     este pipeline es una decisión distinta a activar el respaldo/sync por niño: un
     adulto podría aceptar analítica agregada anónima sin querer respaldo en la nube
     de los datos de su hijo, o viceversa. Object.assign no-destructivo: si
     PEQUE_FLAGS ya existe (definido por ship/app.js o por sync.js), no se pisa nada,
     solo se añade la clave si falta. -------- */
  window.PEQUE_FLAGS = Object.assign({ analyticsAgg:false }, window.PEQUE_FLAGS||{});
  if(typeof window.PEQUE_FLAGS.analyticsAgg !== 'boolean') window.PEQUE_FLAGS.analyticsAgg = false;

  function flagOn(){ return !!(window.PEQUE_FLAGS && window.PEQUE_FLAGS.analyticsAgg === true); }
  function isSecureTransport(){
    try{ return typeof location!=='undefined' && location.protocol === 'https:'; }catch(e){ return false; }
  }
  function isLocalDev(){
    try{ return typeof location!=='undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); }catch(e){ return false; }
  }
  function transportOk(){ return isSecureTransport() || isLocalDev(); }

  /* -------- 1) Config en memoria SOLO (nunca localStorage): endpoint del pipeline.
     Nada de claves de servicio aquí: el ingest anónimo (ver edge/agg-ingest.ts) no
     requiere JWT de usuario, solo una clave pública de proyecto con permisos de
     "insert only, sin select" — igual de sensible que una anon key normal, por lo
     que se mantiene fuera de localStorage por el mismo motivo que sync.js. -------- */
  var CFG = { url:null, publicKey:null };
  function isConfigured(){ return !!(CFG.url && CFG.publicKey); }
  function configure(cfg){ cfg=cfg||{}; CFG.url=cfg.url||null; CFG.publicKey=cfg.publicKey||null; }
  function clearConfig(){ CFG.url=null; CFG.publicKey=null; }

  /* -------- 2) Consentimiento — propio de este pipeline, separado del de sync (#25).
     DB.settings.analyticsConsent = { on, consentAt, policyVersion }. Un "no" aquí no
     afecta a DB.settings.sync ni viceversa: son dos decisiones independientes. -------- */
  var CONSENT_KEY = 'analyticsConsent';
  function hasConsent(){
    try{
      if(typeof DB!=='object'||!DB||!DB.settings) return false;
      var c=DB.settings[CONSENT_KEY];
      return !!(c && c.on === true && c.consentAt);
    }catch(e){ return false; }
  }
  function setConsent(policyVersion){
    try{
      if(typeof DB!=='object'||!DB) return false;
      if(!DB.settings) DB.settings={};
      DB.settings[CONSENT_KEY] = { on:true, consentAt:new Date().toISOString(), policyVersion:String(policyVersion||'v1') };
      if(typeof saveDB==='function') saveDB();
      return true;
    }catch(e){ return false; }
  }
  function revokeConsent(){
    try{
      if(typeof DB!=='object'||!DB||!DB.settings) return false;
      DB.settings[CONSENT_KEY] = { on:false, consentAt:null, policyVersion:null };
      if(typeof saveDB==='function') saveDB();
      clearQueue();
      return true;
    }catch(e){ return false; }
  }

  /* Las CUATRO condiciones deben cumplirse a la vez para que flush() intente algo. */
  function isReady(){ return flagOn() && transportOk() && isConfigured() && hasConsent(); }

  /* -------- 3) Id de dispositivo anónimo — NUNCA derivado de datos del niño (no usa
     profile.id, avatar ni name). UUID v4 aleatorio, guardado bajo una clave DISTINTA
     al store principal (STORE_KEY de app.js) para poder rotarlo/borrarlo sin tocar
     los perfiles. Rotación: ver política en 27-pipeline-analitica.md §"Rotación de
     anon_device_id" (recomendado: rotar cada 90 días para limitar linkabilidad
     longitudinal entre envíos, a costa de perder continuidad de series temporales
     por dispositivo — trade-off documentado, no implementado como cron aquí). -------- */
  var ANON_ID_KEY = 'pequenautas.analyticsAnonId.v1';
  var memAnonId = null; // fallback en memoria si localStorage no está disponible
  function uuidv4(){
    // No requiere crypto fuerte (no es un secreto ni identifica a nadie por sí solo);
    // usa crypto.getRandomValues si existe, si no cae a Math.random.
    var buf = null;
    try{ if(window.crypto && window.crypto.getRandomValues){ buf = new Uint8Array(16); window.crypto.getRandomValues(buf); } }catch(e){}
    function h(n){ return n.toString(16).padStart(2,'0'); }
    var b = buf || (function(){ var a=new Array(16); for(var i=0;i<16;i++) a[i]=Math.floor(Math.random()*256); return a; })();
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var hex = Array.prototype.map.call(b, h).join('');
    return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  }
  function getAnonDeviceId(){
    try{
      var v = localStorage.getItem(ANON_ID_KEY);
      if(v) return v;
      v = uuidv4();
      localStorage.setItem(ANON_ID_KEY, v);
      return v;
    }catch(e){
      if(!memAnonId) memAnonId = uuidv4();
      return memAnonId;
    }
  }
  function rotateAnonDeviceId(){
    var v = uuidv4();
    try{ localStorage.setItem(ANON_ID_KEY, v); }catch(e){ memAnonId = v; }
    return v;
  }
  function forgetAnonDeviceId(){
    try{ localStorage.removeItem(ANON_ID_KEY); }catch(e){}
    memAnonId = null;
  }

  /* -------- 4) rollupLocal(): función PURA. Colapsa DB.profiles[].ev (que ya no
     tiene PII: {g,k,ft,at,ms,as}) de TODOS los perfiles del dispositivo en conteos
     por (día, juego, ítem), SIN ninguna referencia a qué perfil/niño generó cada
     evento. Este es el primer nivel de agregación (a nivel dispositivo); el segundo
     nivel (k-anonimato entre dispositivos) vive en sql/021_kanon_views.sql, no aquí.
     No lee localStorage, no escribe nada, no requiere flag/consentimiento: es
     analizable y testeable offline en cualquier momento. -------- */
  function dayKey(ms){ try{ return new Date(ms).toISOString().slice(0,10); }catch(e){ return 'unknown'; } }
  function rollupLocal(profiles, opts){
    opts = opts || {};
    var now = opts.now || Date.now();
    var buckets = {}; // 'day|game|item' -> acumulador
    (profiles||[]).forEach(function(p){
      (p && p.ev || []).forEach(function(e){
        if(!e || !e.g || !e.k) return;
        var day = opts.dayOf ? opts.dayOf(e) : dayKey(now); // app.js no guarda timestamp por evento hoy;
        // ver 27-pipeline-analitica.md §"Falta timestamp por evento" para el cambio de esquema necesario.
        var key = day+'|'+e.g+'|'+e.k;
        var b = buckets[key];
        if(!b){ b = buckets[key] = { day:day, game:e.g, item:e.k, n_events:0, n_first_try:0, n_assisted:0, sum_ms:0, sum_attempts:0 }; }
        b.n_events += 1;
        if(e.ft) b.n_first_try += 1;
        if(e.as) b.n_assisted += 1;
        b.sum_ms += (e.ms|0);
        b.sum_attempts += (e.at|0);
      });
    });
    return Object.keys(buckets).map(function(k){ return buckets[k]; });
  }

  /* -------- 5) kAnonFilter(): función PURA que implementa la supresión de
     k-anonimato del lado del SERVIDOR (documentada aquí también para que el diseño
     sea auditable/testeable sin desplegar Postgres). Recibe filas agregadas con un
     campo n_devices (COUNT(DISTINCT anon_device_id) en SQL) y descarta cualquier
     fila con n_devices < k. k=5 por defecto: mismo umbral que sql/021_kanon_views.sql. -------- */
  var DEFAULT_K = 5;
  function kAnonFilter(rows, k){
    k = (typeof k === 'number' && k > 0) ? k : DEFAULT_K;
    return (rows||[]).filter(function(r){ return (r && typeof r.n_devices === 'number') ? r.n_devices >= k : false; });
  }

  /* -------- 6) Cola local de rollups pendientes de envío (en memoria; no persiste en
     localStorage para no acumular "analítica pendiente" indefinidamente en el
     dispositivo de un niño si el adulto nunca configura/consciente el envío). -------- */
  var QUEUE = [];
  function enqueueRollup(rows){
    if(!Array.isArray(rows) || !rows.length) return 0;
    var id = getAnonDeviceId();
    rows.forEach(function(r){ QUEUE.push(Object.assign({ anon_device_id:id }, r)); });
    return rows.length;
  }
  function pendingCount(){ return QUEUE.length; }
  function clearQueue(){ QUEUE = []; }
  function exportQueueJSON(){ return JSON.stringify(QUEUE); }

  /* -------- 7) flush(): SIEMPRE no-op salvo que isReady() sea true, y AÚN ASÍ no
     hace ningún fetch real todavía (ver razón abajo). Devuelve una Promise para que
     el contrato de la API futura ya esté fijado y no requiera cambiar firmas cuando
     se implemente. -------- */
  function flush(){
    if(!flagOn())         return Promise.resolve({ ok:false, reason:'flag_off' });
    if(!transportOk())    return Promise.resolve({ ok:false, reason:'insecure_transport' });
    if(!isConfigured())   return Promise.resolve({ ok:false, reason:'not_configured' });
    if(!hasConsent())     return Promise.resolve({ ok:false, reason:'no_consent' });
    /* Por qué agg.js NUNCA hace red hoy, incluso con las 4 condiciones cumplidas:
       igual que sync.js (#25), este scaffold se entrega ANTES de que exista un
       proyecto Supabase real, una edge function desplegada y una decisión de
       producto/legal sobre el umbral k y la política de retención (ver
       27-pipeline-analitica.md §"Contrato de activación"). Implementar aquí un
       fetch() "por si acaso" violaría la restricción dura del brief (nada debe
       abrir red bajo file:// ni en el estado actual) y dejaría código de red sin
       revisar contra un endpoint que no existe todavía. */
    return Promise.resolve({ ok:false, reason:'not_implemented_pending_backend', queued:QUEUE.length });
  }

  /* API pública */
  window.PequeAggPipeline = {
    version: VERSION,
    // estado / gates
    isFlagOn: flagOn,
    isSecureTransport: isSecureTransport,
    isConfigured: isConfigured,
    hasConsent: hasConsent,
    isReady: isReady,
    // config / consentimiento
    configure: configure,
    clearConfig: clearConfig,
    setConsent: setConsent,
    revokeConsent: revokeConsent,
    // id anónimo de dispositivo (nunca de niño)
    getAnonDeviceId: getAnonDeviceId,
    rotateAnonDeviceId: rotateAnonDeviceId,
    forgetAnonDeviceId: forgetAnonDeviceId,
    // agregación (funciones puras, usables offline sin flag)
    rollupLocal: rollupLocal,
    kAnonFilter: kAnonFilter,
    DEFAULT_K: DEFAULT_K,
    // cola / envío (gated; flush() no hace red hoy)
    enqueueRollup: enqueueRollup,
    pendingCount: pendingCount,
    clearQueue: clearQueue,
    exportQueueJSON: exportQueueJSON,
    flush: flush
  };
})();
