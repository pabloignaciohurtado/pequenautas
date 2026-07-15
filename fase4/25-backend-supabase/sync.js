/* ==================== #25 Backend Supabase — sync.js (SCAFFOLD, gated OFF) ====================
   Módulo NUEVO y separado (no se toca app.js). Aditivo: solo define window.PequeSync.
   No se auto-incluye en index.html; ver 25-backend-supabase.md "Contrato de activación".

   REGLA DURA: bajo el flag por defecto (window.PEQUE_FLAGS.backendSync === false, que ya
   fija ship/app.js) o bajo location.protocol === 'file:', este archivo NO ejecuta ningún
   fetch/XHR/WebSocket ni de red ni local, en ningún punto de su ciclo de vida —ni siquiera
   al cargarse, ni con event listeners, ni con timers—. Todas las funciones públicas hacen
   early-return/no-op cuando isReady() es false. Diseño de datos completo en
   docs/backend-supabase.md (tablas, RLS, edge function) — este archivo es el cliente que
   *consumiría* ese backend una vez encendido con consentimiento real; hoy no encendemos red.

   Principios heredados de docs/backend-supabase.md (COPPA / GDPR-K):
   - Sin cuentas de niño: el titular de la cuenta es siempre un adulto.
   - Minimización de datos: solo alias (nunca el nombre real) + eventos {g,k,ft,at,ms,as}.
   - Consentimiento verificable previo, registrado con fecha/versión de política.
   - Una sola dirección: dispositivo -> nube. La app local sigue siendo la fuente de verdad.
*/
(function(){
  "use strict";

  var VERSION = '0.1.0-scaffold';

  /* -------- 0) Flag global. Ya existe en ship/app.js (línea ~921); si este archivo se
     carga solo (p.ej. en un test aislado) lo define con el mismo default OFF, sin pisar
     un valor ya presente. Nunca lo pone en true por sí mismo. -------- */
  window.PEQUE_FLAGS = Object.assign({ backendSync:false }, window.PEQUE_FLAGS||{});

  /* -------- 1) Gate duro de entorno. Bajo file:// (donde corren los smoke tests) o sin
     el flag encendido, el módulo queda completamente inerte: no hay wiring a DB, a la UI,
     ni listeners sobre afterCorrect/nextRound/etc. Esto es intencional: la wiring al ciclo
     de juego y la UI de consentimiento son parte de una activación futura, no de este
     scaffold (ver §"Qué falta" en el .md de este mismo directorio). -------- */
  function flagOn(){ return !!(window.PEQUE_FLAGS && window.PEQUE_FLAGS.backendSync === true); }
  function isSecureTransport(){
    try{ return typeof location!=='undefined' && location.protocol === 'https:'; }catch(e){ return false; }
  }
  /* file:// (smoke tests), http:// (salvo localhost de desarrollo) y cualquier flag OFF
     dejan isReady() en false para siempre, sin importar qué se llame después. */
  function isLocalDev(){
    try{ return typeof location!=='undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); }catch(e){ return false; }
  }
  function transportOk(){ return isSecureTransport() || isLocalDev(); }

  /* -------- 2) Config en memoria SOLO (nunca localStorage): url + anon key de Supabase.
     Deliberado: minimiza superficie de credenciales persistidas en el dispositivo de un
     niño. Debe volver a configurarse cada carga de página por quien active la sync (capa
     de consentimiento del adulto, fuera de este scaffold). -------- */
  var CFG = { url:null, anonKey:null, region:null };
  var CONSENT_KEY_IN_SETTINGS = 'sync'; // DB.settings.sync = { on, consentAt, policyVersion }

  function isConfigured(){ return !!(CFG.url && CFG.anonKey); }
  function hasConsent(){
    try{
      if(typeof DB!=='object'||!DB||!DB.settings) return false;
      var c=DB.settings[CONSENT_KEY_IN_SETTINGS];
      return !!(c && c.on === true && c.consentAt);
    }catch(e){ return false; }
  }
  /* isReady(): las CUATRO condiciones deben cumplirse a la vez para que flush() pueda
     siquiera intentar un fetch. Si falta una sola, es un no-op silencioso. */
  function isReady(){ return flagOn() && transportOk() && isConfigured() && hasConsent(); }

  function configure(opts){
    opts = opts||{};
    if(typeof opts.url==='string' && /^https:\/\//.test(opts.url)) CFG.url = opts.url;
    if(typeof opts.anonKey==='string' && opts.anonKey.length>10) CFG.anonKey = opts.anonKey;
    if(typeof opts.region==='string') CFG.region = opts.region;
    return isConfigured();
  }
  function clearConfig(){ CFG = { url:null, anonKey:null, region:null }; }

  /* -------- 3) Consentimiento (registro local, no dispara red). El futuro flujo de UI
     (parent gate -> pantalla de política -> aceptar) llamaría a setConsent(); aquí solo
     dejamos el contrato de datos y la persistencia local ya probada (saveDB). -------- */
  function setConsent(policyVersion){
    if(typeof DB!=='object'||!DB) return false;
    if(!DB.settings) DB.settings = {};
    DB.settings[CONSENT_KEY_IN_SETTINGS] = {
      on:true,
      consentAt: new Date().toISOString(),
      policyVersion: String(policyVersion||'v1')
    };
    if(typeof saveDB==='function'){ try{ saveDB(); }catch(e){} }
    return true;
  }
  function revokeConsent(){
    if(typeof DB!=='object'||!DB||!DB.settings) return false;
    DB.settings[CONSENT_KEY_IN_SETTINGS] = { on:false, consentAt:null, policyVersion:null };
    if(typeof saveDB==='function'){ try{ saveDB(); }catch(e){} }
    clearQueue();
    return true;
  }

  /* -------- 4) Alias seudónimo (NUNCA el nombre real, minimización de datos). Determinista
     por profile.id, sin PII, apto para mostrarse en un futuro panel remoto del educador. -------- */
  function aliasFor(profile){
    var seed = String((profile&&profile.id)||'peque');
    var h = 0;
    for(var i=0;i<seed.length;i++){ h = ((h<<5)-h + seed.charCodeAt(i))|0; }
    var n = Math.abs(h)%1000;
    return 'Peque '+n;
  }

  /* -------- 5) Cola en memoria + mapeo de eventos locales -> forma de payload del backend
     diseñado (docs/backend-supabase.md §2/§4). NO escribe a localStorage aparte (los
     eventos ya viven en DB.profiles[].ev; esto solo prepara el batch). No hay timers ni
     auto-flush: siempre requiere una llamada explícita a flush(). -------- */
  var QUEUE = [];

  function clientUidFor(profile, ev, idx){
    /* Idempotencia determinista: mismo evento reenviado no debería duplicarse en el
       servidor (ver `unique(owner, client_uid)` en docs/backend-supabase.md). */
    return [profile.id||'p', ev.g||'g', ev.k||'k', ev.ms||0, idx].join(':');
  }

  function mapEventsFor(profile){
    var ev = (profile && profile.ev) || [];
    return ev.map(function(e, idx){
      return {
        client_uid: clientUidFor(profile, e, idx),
        game: e.g, item: e.k,
        first_try: !!e.ft, attempts: e.at|0, ms: e.ms|0, assisted: !!e.as
      };
    });
  }

  function enqueueProfile(profile){
    if(!profile) return 0;
    var payload = {
      profile: { local_id: profile.id, alias: aliasFor(profile), avatar: profile.avatar, age_band:'3-5' },
      events: mapEventsFor(profile)
    };
    QUEUE.push(payload);
    return payload.events.length;
  }
  function enqueueAll(){
    if(typeof DB!=='object'||!DB||!DB.profiles) return 0;
    var total = 0;
    DB.profiles.forEach(function(p){ total += enqueueProfile(p); });
    return total;
  }
  function pendingCount(){ return QUEUE.reduce(function(acc,b){ return acc + (b.events?b.events.length:0); }, 0); }
  function clearQueue(){ QUEUE = []; }

  /* -------- 6) flush(): EL ÚNICO lugar de todo el módulo donde se llamaría a fetch().
     Con el flag por defecto o sin las 4 condiciones de isReady(), esto es un no-op que
     resuelve una promesa rechazada sin tocar la red — así se puede llamar de forma segura
     desde cualquier UI futura sin comprobaciones adicionales. */
  function flush(){
    if(!isReady()){
      return Promise.reject({ ok:false, reason: !flagOn() ? 'flag_off'
        : !transportOk() ? 'insecure_transport'
        : !isConfigured() ? 'not_configured'
        : 'no_consent' });
    }
    if(!QUEUE.length) return Promise.resolve({ ok:true, sent:0 });
    /* Implementación real pendiente de activación (ver contrato .md): POST batch por
       batch a `${CFG.url}/functions/v1/ingest` con Authorization: Bearer <jwt del adulto>.
       No se implementa aquí para no introducir NINGUNA llamada de red en este scaffold,
       ni siquiera detrás del flag, hasta que exista: (a) auth real del adulto con JWT y
       (b) UI de consentimiento verificado. Ambas están fuera del alcance de este entregable. */
    return Promise.reject({ ok:false, reason:'not_implemented_pending_auth' });
  }

  /* -------- 7) Derechos ARCO/RGPD locales (no dependen de red): exportar/olvidar lo que
     este módulo tiene en memoria/consentimiento. El borrado del backend remoto en sí
     requeriría la edge function / SQL de docs/backend-supabase.md §4. */
  function exportQueueJSON(){ return JSON.stringify(QUEUE); }
  function forgetLocal(){ clearQueue(); clearConfig(); revokeConsent(); }

  window.PequeSync = {
    VERSION: VERSION,
    /* estado */
    isFlagOn: flagOn,
    isSecureTransport: isSecureTransport,
    isConfigured: isConfigured,
    hasConsent: hasConsent,
    isReady: isReady,
    /* config + consentimiento (no disparan red) */
    configure: configure,
    clearConfig: clearConfig,
    setConsent: setConsent,
    revokeConsent: revokeConsent,
    /* cola local (no dispara red) */
    aliasFor: aliasFor,
    enqueueProfile: enqueueProfile,
    enqueueAll: enqueueAll,
    pendingCount: pendingCount,
    clearQueue: clearQueue,
    /* único punto de posible red; no-op salvo isReady()===true */
    flush: flush,
    /* ARCO/RGPD local */
    exportQueueJSON: exportQueueJSON,
    forgetLocal: forgetLocal
  };
})();
