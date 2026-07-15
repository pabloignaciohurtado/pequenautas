"use strict";
/* ============================================================================
   Fase 4 · Mejora #9 "recomendador" — "¿Qué jugar hoy?"
   ----------------------------------------------------------------------------
   Tarjeta en Inicio que sugiere, POR NIÑO, la materia de mayor "palanca":
   aquella en la que practicar hoy tiene más potencial de mejora. Se calcula
   100% offline a partir de profile.ev[] (ya existente), reutilizando
   aggregate() sin modificarla.

   Regla de "palanca" (recoScore):
     - Materia NUNCA jugada por este perfil -> prioridad media (0.55):
       explorar algo nuevo es valioso, pero un problema real de precisión
       pesa más (ver abajo).
     - Materia ya jugada -> prioridad = (1 - precisión) [0..1], con un
       pequeño extra (+0.15) si hay pocas rondas registradas (<3), porque la
       señal todavía es poco confiable y conviene reforzarla. Con esto, una
       materia con precisión baja (p.ej. 30%) SIEMPRE supera a una materia
       nunca jugada (0.7 > 0.55), y una materia dominada (p.ej. 95%) queda
       muy por debajo de cualquiera de las dos.
   Empate -> menos rondas jugadas primero (favorece variedad); empate total
   -> se conserva el orden math > reading > science (determinístico, sin
   Math.random(), para que sea testeable).

   PATRÓN DE EXTENSIÓN (igual que speak/speakSeq/afterCorrect/nextRound en
   ship/app.js): este bloque ENVUELVE window.refreshHome() por reasignación.
   No redefine refreshHome/applyLang/init ni ninguna otra función existente.
   No usa .onclick= sobre #langBtn/#tabSet (no los toca). Solo anima
   transform/opacity y respeta prefers-reduced-motion (ver spec.css). Bajo
   file:// no se abre ningún socket de red: todo el cálculo es lectura pura
   de DB.profiles vía currentProfile()/aggregate(), ambas ya existentes.
   ============================================================================ */
(function(){
  "use strict";

  /* ---- i18n aditivo: nuevas claves, no se toca ninguna existente ---- */
  if (typeof UI === 'object' && UI.es && UI.en){
    Object.assign(UI.es, {
      recoKicker:  'Sugerencia de hoy',
      recoWhyNew:  '¡Aún no lo has probado! Genial para hoy.',
      recoWhyWeak: 'Le vendría bien practicar hoy.',
      recoPlay:    'Jugar'
    });
    Object.assign(UI.en, {
      recoKicker:  "Today's pick",
      recoWhyNew:  "Haven't tried it yet! Great pick for today.",
      recoWhyWeak: 'Could use a little practice today.',
      recoPlay:    'Play'
    });
  }

  var GAMES  = ['math','reading','science'];
  var LBLKEY = { math:'math', reading:'read', science:'sci' }; // -> claves ya existentes en UI (t.math/t.read/t.sci)
  var EMOJI  = { math:'🔢', reading:'🔤', science:'🐢' };       // mismos emojis que .subject en Inicio
  var ACCENT = { math:'var(--math)', reading:'var(--read)', science:'var(--sci)' }; // custom props ya definidas en :root

  /* Puntaje de palanca para UNA materia, a partir de {r,err} de aggregate().byGame[g]. */
  function recoScore(gg){
    var r = (gg && gg.r) || 0;
    if (r === 0) return { score:0.55, acc:null, r:0, never:true };
    var acc = 1 - (gg.err / r);
    var score = (1 - acc) + (r < 3 ? 0.15 : 0);
    return { score:score, acc:acc, r:r, never:false };
  }

  /* Elige la materia de mayor palanca para el perfil p. Devuelve null si no
     hay perfil o si aggregate() no está disponible (defensivo; en ship/app.js
     siempre existe). Nunca lanza. */
  function recoPick(p){
    if (!p || typeof aggregate !== 'function') return null;
    var a = aggregate(p);
    var best = null;
    GAMES.forEach(function(g){
      var gg = (a.byGame && a.byGame[g]) || { r:0, err:0 };
      var s = recoScore(gg);
      s.g = g;
      if (!best || s.score > best.score) best = s; // estrictamente mayor: en empate gana el primero visto (math>reading>science)
    });
    return best;
  }

  /* Pinta la tarjeta #recoCard (ver spec.html) para el perfil actual. No-op
     silencioso si el markup no está integrado en index.html todavía. */
  function renderReco(){
    var host = $('recoCard'); if (!host) return;
    var p = (typeof currentProfile === 'function') ? currentProfile() : null;
    if (!p){ host.hidden = true; return; }
    var pick = recoPick(p);
    if (!pick){ host.hidden = true; return; }
    var t = (typeof UI === 'object' && UI[S.lang]) ? UI[S.lang] : UI.es;

    host.hidden = false;
    host.dataset.game = pick.g;
    host.style.setProperty('--recoAccent', ACCENT[pick.g]);

    var kEl = $('recoKicker');  if (kEl) kEl.textContent = t.recoKicker;
    var iEl = $('recoIcon');    if (iEl) iEl.textContent = EMOJI[pick.g];
    var sEl = $('recoSubject'); if (sEl) sEl.textContent = t[LBLKEY[pick.g]];
    var rEl = $('recoReason');
    if (rEl){
      if (pick.never){
        rEl.textContent = t.recoWhyNew;
      } else {
        var pct = Math.round(pick.acc * 100);
        rEl.textContent = t.recoWhyWeak + ' (' + pct + '% ' + String(t.mAcc || 'aciertos').toLowerCase() + ')';
      }
    }
    var pEl = $('recoPlayTxt'); if (pEl) pEl.textContent = t.recoPlay;
  }

  /* Cablea el botón "Jugar" UNA sola vez (idempotente); usa addEventListener,
     nunca .onclick=, y reutiliza ac()/startGame() ya existentes (mismo gesto
     que los botones .subject de Inicio). */
  function wirePlay(){
    var btn = $('recoPlayBtn');
    if (btn && !btn._recoWired){
      btn._recoWired = true;
      btn.addEventListener('click', function(){
        var host = $('recoCard');
        var g = host && host.dataset.game;
        if (!g) return;
        if (typeof ac === 'function') ac();
        if (typeof startGame === 'function') startGame(g);
      });
    }
  }

  /* Envuelve window.refreshHome() por reasignación (mismo mecanismo que
     AudioBank envuelve speak/speakSeq y el modo bilingüe envuelve
     afterCorrect/nextRound). refreshHome() ya se llama, en ship/app.js
     original, desde goHome(), desde applyLang() (si S.screen==='home') y
     desde el bloque de init para usuarios recurrentes: con esta envoltura,
     la tarjeta se actualiza automáticamente en los tres casos, incluido el
     cambio de idioma, sin tocar ninguna de esas funciones. */
  if (!window.__recoWrapped){
    window.__recoWrapped = true;
    var _refreshHome = window.refreshHome;
    window.refreshHome = function(){
      _refreshHome();
      try{ renderReco(); }catch(e){}
    };
  }

  wirePlay();

  /* Pintado inicial: el bloque de init() de ship/app.js corre ANTES de que
     este archivo se cargue/ejecute (va al final), así que si un usuario
     recurrente entra directo a Inicio, esa primera llamada a refreshHome()
     usó todavía la versión sin envolver. Se pinta aquí una vez más, de forma
     defensiva, para que la tarjeta aparezca ya en la primera pantalla. */
  try{
    if (typeof currentProfile === 'function' && currentProfile() &&
        typeof S === 'object' && S.screen === 'home'){
      renderReco();
    }
  }catch(e){}

  /* API pública para tests/tooling (no expone datos sensibles: solo la
     lógica de puntaje, de solo lectura). */
  window.__reco = { pick: recoPick, render: renderReco, score: recoScore };
})();
