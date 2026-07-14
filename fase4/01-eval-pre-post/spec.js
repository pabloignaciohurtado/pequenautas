"use strict";
/* ==================== FASE 4 · #1: Evaluación pre/post por materia (eval-pre-post) ====================
   Baseline al iniciar una materia (primera SESIÓN COMPLETA de S.totalRounds rondas)
   + medición de ganancia real de aprendizaje (precisión al primer intento y ritmo)
   en cada sesión completa posterior de esa misma materia. Persiste en profile.assess[].

   100% ADITIVO y offline:
   - Envuelve window.nextRound (hook permitido por el patrón de extensión) para
     detectar el cierre de cada sesión (S.round>=S.totalRounds) SIN tocar su cuerpo
     original ni el de finishGame/afterCorrect/logRound/aggregate/renderProgress2.
   - La medición se calcula a partir de las últimas S.totalRounds entradas de
     profile.ev para S.game, que YA fueron logueadas por logRound()/afterCorrect()
     durante el juego normal (no se inventan datos ni se añaden rondas extra).
   - La sección "Evaluación pre/post" se inyecta en runtime dentro de #progBody
     (el panel de Progreso del adulto) vía MutationObserver — mismo patrón que usa
     el Modo guiado padre-hijo con #stage — por lo que aparece sin importar si la
     pestaña se abrió con click en #tabProg o directamente desde passGate() tras el
     gate. No se define/edita showTab/renderProgress2/passGate.
   - i18n aditivo con Object.assign(UI.es,...)/Object.assign(UI.en,...).
   - #langBtn se engancha solo con addEventListener (nunca .onclick=) para no
     romper la cadena de listeners ya registrados por otras extensiones.
   - Bajo file:// no se abre red: todo vive en profile.assess[] + localStorage
     (mismo mecanismo de persistencia que DB, con fallback en memoria si falla).
   - Solo se anima con transform/opacity si se anima algo (aquí no se anima nada
     nuevo: la sección es texto estático, reutiliza clases ya existentes).

   Evidencia: ganancia normalizada pre/post (Hake 1998) · medir precisión y fluidez,
   no solo recompensas extrínsecas como las estrellas (Hirsh-Pasek 2015).
   ======================================================================= */
(function(){
  "use strict";

  var GAMES = ['math','reading','science'];
  var ICONS = {math:'🔢', reading:'🔤', science:'🐢'};

  /* nº de entradas de ev (para esa materia) ya evaluadas, por 'profileId|game'.
     Evita doble registro si nextRound() se invoca de nuevo sin rondas nuevas. */
  var loggedAt = {};

  function ensureAssess(p){ if(!p.assess) p.assess = []; return p.assess; }
  function evForGame(p, g){ return (p.ev||[]).filter(function(e){ return e.g === g; }); }

  /* Calcula y persiste una medición pre/post al cerrar una sesión completa. */
  function maybeRecord(){
    try{
      var p = (typeof currentProfile === 'function') ? currentProfile() : null;
      if(!p) return;
      var g = S.game; if(!g) return;
      var n = S.totalRounds || 5;
      var evg = evForGame(p, g);
      if(evg.length < n) return;                    // sesión incompleta: no medir

      var key = p.id + '|' + g;
      if(loggedAt[key] === evg.length) return;       // ya medido para este total
      loggedAt[key] = evg.length;

      var last = evg.slice(-n);
      var ft = last.filter(function(e){ return e.ft; }).length;
      var acc = ft / n;
      var avgMs = Math.round(last.reduce(function(s,e){ return s + (e.ms||0); }, 0) / n);
      var avgAt = Math.round((last.reduce(function(s,e){ return s + (e.at||1); }, 0) / n) * 100) / 100;
      var lvl = (p.best && typeof p.best[g] === 'number') ? p.best[g] : 0;

      var list = ensureAssess(p);
      var pre = list.filter(function(a){ return a.g === g && a.phase === 'pre'; })[0];
      var phase = pre ? 'post' : 'pre';

      var entry = { g:g, phase:phase, at:Date.now(), n:n, acc:acc, avgMs:avgMs, avgAt:avgAt, lvl:lvl, gain:null };
      if(phase === 'post' && pre){ entry.gain = Math.round((acc - pre.acc) * 100) / 100; }

      list.push(entry);
      if(list.length > 200) p.assess = list.slice(-200);
      saveDB();
    }catch(e){ /* silencioso: nunca debe romper el flujo de juego */ }
  }

  /* ---------- envoltura aditiva de nextRound (patrón permitido) ---------- */
  if(!window.__assessWrapped){
    window.__assessWrapped = true;
    var _nextRound = window.nextRound;
    window.nextRound = function(){
      try{ if(S.round >= S.totalRounds) maybeRecord(); }catch(e){}
      return _nextRound();
    };
  }

  /* ---------- i18n aditivo (no toca literales existentes) ---------- */
  Object.assign(UI.es, {
    assessTitle:  'Evaluación pre/post',
    assessBase:   'Base',
    assessNow:    'Ahora',
    assessGainUp:   '▲ Mejoró',
    assessGainDown: '▼ Bajó',
    assessGainSame: '= Igual',
    assessNoPost: 'Aún midiendo la línea base…'
  });
  Object.assign(UI.en, {
    assessTitle:  'Pre/post evaluation',
    assessBase:   'Baseline',
    assessNow:    'Now',
    assessGainUp:   '▲ Improved',
    assessGainDown: '▼ Dropped',
    assessGainSame: '= Same',
    assessNoPost: 'Still measuring the baseline…'
  });

  /* ---------- UI: sección de ganancia dentro del panel de Progreso ---------- */
  function gname(g){ var t = UI[S.lang]; return g==='math' ? t.math : g==='reading' ? t.read : t.sci; }

  function buildSection(p){
    var t = UI[S.lang];
    var list = p.assess || [];
    if(!list.length) return '';
    var any = false;
    var html = '<div class="eduHead" id="assessHead">' + eduEsc(t.assessTitle) + '</div><div id="assessRows">';
    GAMES.forEach(function(g){
      var pre = list.filter(function(a){ return a.g===g && a.phase==='pre'; })[0];
      if(!pre) return;
      any = true;
      var posts = list.filter(function(a){ return a.g===g && a.phase==='post'; });
      var latest = posts.length ? posts[posts.length-1] : null;
      var baseAcc = Math.round(pre.acc*100);
      var icon = ICONS[g] || '⭐';
      if(!latest){
        html += '<div class="failitem"><span class="fx">'+icon+'</span>'
          + '<span>'+eduEsc(gname(g))+' · '+eduEsc(t.assessBase)+' '+baseAcc+'%</span>'
          + '<span class="fc assessGain same">'+eduEsc(t.assessNoPost)+'</span></div>';
      } else {
        var nowAcc = Math.round(latest.acc*100);
        var diff = Math.round((latest.gain||0)*100);
        var cls = diff>0 ? 'up' : diff<0 ? 'down' : 'same';
        var lbl = diff>0 ? t.assessGainUp : diff<0 ? t.assessGainDown : t.assessGainSame;
        html += '<div class="failitem"><span class="fx">'+icon+'</span>'
          + '<span>'+eduEsc(gname(g))+' · '+eduEsc(t.assessBase)+' '+baseAcc+'% → '+eduEsc(t.assessNow)+' '+nowAcc+'%</span>'
          + '<span class="fc assessGain '+cls+'">'+eduEsc(lbl)+' '+(diff>=0?'+':'')+diff+'%</span></div>';
      }
    });
    html += '</div>';
    return any ? html : '';
  }

  function paintAssess(){
    var host = $('progBody'); if(!host) return;
    if(host.querySelector('.empty')) return;         // sin rondas todavía: nada que mostrar
    if(host.querySelector('#assessHead')) return;     // ya pintado para este render
    var p = (typeof currentProfile === 'function') ? currentProfile() : null; if(!p) return;
    var html = buildSection(p);
    if(html) host.insertAdjacentHTML('beforeend', html);
  }

  function refreshAssessSection(){
    var host = $('progBody'); if(!host) return;
    var head = host.querySelector('#assessHead'); if(head) head.remove();
    var rows = host.querySelector('#assessRows'); if(rows) rows.remove();
    paintAssess();
  }

  /* Repinta cada vez que renderProgress2() reescribe #progBody (host.innerHTML=...),
     sin importar qué disparó la apertura del panel (click en #tabProg o passGate()). */
  var __assessObsBound = false;
  function bindObserver(){
    var host = $('progBody'); if(!host || __assessObsBound) return;
    __assessObsBound = true;
    var obs = new MutationObserver(function(){ paintAssess(); });
    obs.observe(host, { childList:true });
  }

  /* #langBtn: SOLO addEventListener (nunca .onclick=) para no romper la cadena
     de listeners ya registrados por otras extensiones (regla del patrón). */
  var __lb = $('langBtn');
  if(__lb) __lb.addEventListener('click', function(){ requestAnimationFrame(refreshAssessSection); });

  bindObserver();

  /* ---------- API pública (integración / tests) ---------- */
  window.__assess = {
    list: function(){ var p = (typeof currentProfile==='function') ? currentProfile() : null; return p ? (p.assess||[]).slice() : []; },
    forSubject: function(g){ var p = (typeof currentProfile==='function') ? currentProfile() : null; return p ? (p.assess||[]).filter(function(a){ return a.g===g; }) : []; },
    recordNow: maybeRecord /* fuerza la evaluación si S.game ya tiene >=S.totalRounds rondas logueadas (uso en tests) */
  };
})();
