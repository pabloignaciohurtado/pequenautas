/* ==================== #26 Panel nube · cohortes — cohorts.js (SCAFFOLD) ====================
   Módulo NUEVO y separado (no se toca app.js/index.html). Aditivo: solo define
   window.PequeCohorts. No se auto-incluye en index.html; ver 26-panel-nube-cohortes.md
   "Contrato de activación".

   Dos mitades muy distintas, léelas por separado:

   A) LOCAL (funciona HOY, sin red, sin backend, incluso bajo file://): agrupar los
      perfiles YA existentes de este dispositivo en "cohortes" (p.ej. una clase/salón) y
      calcular sus estadísticas agregadas reutilizando aggregate() de app.js — el mismo
      cálculo que ya usa el panel del educador local (#24, pestaña "Educador"). Esto es
      pura organización de datos que ya viven en DB; no requiere Supabase ni red.

   B) NUBE (gateada, NO implementada): el panel del educador "en la nube" — ver el mismo
      grupo de niños agregado a través de VARIOS dispositivos — depende por completo del
      backend de #25 (window.PEQUE_FLAGS.backendSync, hoy false) y de las vistas SQL de
      sql/006_cohorts_views.sql. Esta mitad de cohorts.js NUNCA hace fetch/XHR/WebSocket,
      ni bajo file://, ni con el flag activado a mano: toda función de la sección B es un
      no-op o una promesa rechazada, igual que sync.js::flush() en #25.

   REGLA DURA (idéntica a #25): bajo cualquier condición de este entorno, ningún camino de
   código de este archivo abre una conexión de red. La sección A no la necesita; la sección
   B la tiene deliberadamente sin implementar.
*/
(function(){
  "use strict";

  var VERSION = '0.1.0-scaffold';
  var SETTINGS_KEY = 'cohorts'; // DB.settings.cohorts = [{id,name,profileIds:[]}]

  /* -------------------------------------------------------------------------------
     A) LOCAL — agrupar perfiles del dispositivo, calcular sus stats. Sin red.
     ------------------------------------------------------------------------------- */

  function hasDB(){ return typeof window.DB === 'object' && window.DB && Array.isArray(window.DB.profiles); }
  function ensureCfg(){
    if(!hasDB()) return [];
    if(!window.DB.settings) window.DB.settings = {};
    if(!Array.isArray(window.DB.settings[SETTINGS_KEY])) window.DB.settings[SETTINGS_KEY] = [];
    return window.DB.settings[SETTINGS_KEY];
  }
  function persist(){ if(typeof window.saveDB === 'function'){ try{ window.saveDB(); }catch(e){} } }
  function newCohortId(){ return 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1000); }

  function listCohorts(){ return ensureCfg().slice(); }
  function getCohort(cohortId){ return ensureCfg().find(function(c){ return c.id === cohortId; }) || null; }

  function createCohort(name){
    var list = ensureCfg();
    var clean = String(name == null ? '' : name).trim().slice(0, 40);
    if(!clean) return null;
    var c = { id: newCohortId(), name: clean, profileIds: [] };
    list.push(c);
    persist();
    return c;
  }
  function renameCohort(cohortId, name){
    var c = getCohort(cohortId); if(!c) return false;
    var clean = String(name == null ? '' : name).trim().slice(0, 40);
    if(!clean) return false;
    c.name = clean;
    persist();
    return true;
  }
  function deleteCohort(cohortId){
    var list = ensureCfg();
    var idx = list.findIndex(function(c){ return c.id === cohortId; });
    if(idx < 0) return false;
    list.splice(idx, 1);
    persist();
    return true;
  }
  function addProfile(cohortId, profileId){
    var c = getCohort(cohortId); if(!c || !profileId) return false;
    if(c.profileIds.indexOf(profileId) < 0) c.profileIds.push(profileId);
    persist();
    return true;
  }
  function removeProfile(cohortId, profileId){
    var c = getCohort(cohortId); if(!c) return false;
    var i = c.profileIds.indexOf(profileId);
    if(i < 0) return false;
    c.profileIds.splice(i, 1);
    persist();
    return true;
  }
  function cohortsForProfile(profileId){
    return ensureCfg().filter(function(c){ return c.profileIds.indexOf(profileId) >= 0; });
  }

  /* Estadísticas locales de una cohorte: reutiliza window.aggregate() (definida en
     app.js, global no-módulo) sobre la unión de los ev[] de los perfiles miembro —
     mismo patrón que renderEducator() combina TODOS los perfiles del dispositivo. */
  function localStats(cohortId){
    var c = getCohort(cohortId); if(!c) return null;
    if(!hasDB() || typeof window.aggregate !== 'function') return null;
    var members = window.DB.profiles.filter(function(p){ return c.profileIds.indexOf(p.id) >= 0; });
    var allEv = [];
    members.forEach(function(p){ (p.ev || []).forEach(function(e){ allEv.push(e); }); });
    var agg = window.aggregate({ ev: allEv });
    return {
      cohortId: c.id,
      name: c.name,
      childCount: members.length,
      rounds: agg.rounds,
      firstRate: agg.firstRate,
      avg: agg.avg,
      byGame: agg.byGame,
      topFails: agg.topFails
    };
  }

  /* -------------------------------------------------------------------------------
     B) NUBE — gateado, sin implementar. Mismo patrón de 4 condiciones que
     ../25-backend-supabase/sync.js::isReady(). Si window.PequeSync ya está cargado
     (activación futura de #25), delega en él; si no, reimplementa el mismo cálculo
     localmente sin pisar nada. Ningún camino llega jamás a fetch().
     ------------------------------------------------------------------------------- */

  function flagOn(){ return !!(window.PEQUE_FLAGS && window.PEQUE_FLAGS.backendSync === true); }
  function isSecureTransport(){
    try{ return typeof location !== 'undefined' && location.protocol === 'https:'; }catch(e){ return false; }
  }
  function isLocalDev(){
    try{ return typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); }catch(e){ return false; }
  }
  function transportOk(){ return isSecureTransport() || isLocalDev(); }
  function hasConsent(){
    try{
      if(!hasDB() || !window.DB.settings) return false;
      var s = window.DB.settings.sync; // misma clave de consentimiento que #25
      return !!(s && s.on === true && s.consentAt);
    }catch(e){ return false; }
  }
  /* Config remota: delega en PequeSync.isConfigured() si #25 ya está cargado (no
     duplicamos credenciales en dos sitios); si no, siempre false. */
  function isConfigured(){
    try{ return !!(window.PequeSync && typeof window.PequeSync.isConfigured === 'function' && window.PequeSync.isConfigured()); }
    catch(e){ return false; }
  }
  function isReady(){ return flagOn() && transportOk() && isConfigured() && hasConsent(); }

  /* Prepara (en memoria, sin red) el payload que reflejaría cohorts/cohort_members
     de sql/004_cohorts_schema.sql, listo para un futuro flush() de #25. No envía nada. */
  var CLOUD_QUEUE = [];
  function enqueueCohortsForSync(){
    var list = ensureCfg();
    CLOUD_QUEUE = list.map(function(c){
      return { local_id: c.id, name: c.name, profileLocalIds: c.profileIds.slice() };
    });
    return CLOUD_QUEUE.length;
  }
  function pendingCohortCount(){ return CLOUD_QUEUE.length; }
  function clearCohortQueue(){ CLOUD_QUEUE = []; }

  /* Reflejo de sync.js::flush(): el ÚNICO lugar donde se llamaría a fetch() contra
     v_cohort_overview/v_cohort_child_stats/v_cohort_top_fails (sql/006_cohorts_views.sql).
     Con el flag por defecto, o sin las 4 condiciones, o incluso con todas cumplidas,
     esto NUNCA hace red en este scaffold — devuelve una promesa rechazada explicando
     por qué, igual que sync.js. Implementar el fetch real es parte del contrato de
     activación (ver 26-panel-nube-cohortes.md), no de este entregable. */
  function pullCohortOverview(cohortId){
    if(!isReady()){
      return Promise.reject({ ok:false, reason: !flagOn() ? 'flag_off'
        : !transportOk() ? 'insecure_transport'
        : !isConfigured() ? 'not_configured'
        : 'no_consent', cohortId: cohortId || null });
    }
    return Promise.reject({ ok:false, reason:'not_implemented_pending_auth', cohortId: cohortId || null });
  }

  window.PequeCohorts = {
    VERSION: VERSION,
    /* A) local, funciona hoy, sin red */
    listCohorts: listCohorts,
    getCohort: getCohort,
    createCohort: createCohort,
    renameCohort: renameCohort,
    deleteCohort: deleteCohort,
    addProfile: addProfile,
    removeProfile: removeProfile,
    cohortsForProfile: cohortsForProfile,
    localStats: localStats,
    /* B) nube, gateado, nunca hace red en este scaffold */
    isFlagOn: flagOn,
    isSecureTransport: isSecureTransport,
    isConfigured: isConfigured,
    hasConsent: hasConsent,
    isReady: isReady,
    enqueueCohortsForSync: enqueueCohortsForSync,
    pendingCohortCount: pendingCohortCount,
    clearCohortQueue: clearCohortQueue,
    pullCohortOverview: pullCohortOverview
  };
})();
