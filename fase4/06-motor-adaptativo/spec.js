"use strict";
/* ============================================================================
   Fase 4 · Mejora #6 "motor-adaptativo"
   Motor de dificultad ADAPTATIVA: sube/baja el NIVEL EFECTIVO de Números
   según el desempeño reciente del peque, sin castigar (nunca reduce
   estrellas, nunca baja el nivel PERMANENTE/insignia p.best.math, y nunca
   se lo comunica al niño como un fallo — solo es visible, opcionalmente,
   en el panel de adultos).

   100% ADITIVO, mismo mecanismo que ya usa ship/app.js (AudioBank sobre
   speak/speakSeq, Bilingüe sobre afterCorrect/nextRound, Educador sobre
   renderEducator): envuelve funciones existentes POR REASIGNACIÓN de
   window.*, guardando y llamando SIEMPRE primero a la referencia previa.
   - No redefine ninguna función existente (no reescribe su cuerpo).
   - No toca init() ni applyLang().
   - No usa .onclick= sobre #langBtn/#tabSet (usa addEventListener).
   - i18n aditivo vía Object.assign(UI.es,{...}) / Object.assign(UI.en,{...}).
   - Bajo file:// no abre red: solo DOM/localStorage (vía saveDB() ya
     existente). No usa fetch/XHR/WebSocket en ningún punto.
   - Animación limitada a transform/opacity (ver spec.css), respeta
     prefers-reduced-motion.

   ---------------------------------------------------------------------------
   MODELO (alcance v1: materia "math", que es la única con niveles
   explícitos vía MATH_LEVELS/best.math en ship/app.js; reading/science no
   tienen escala de nivel que ajustar. Diseño extensible: ver "Extensión a
   futuras materias" más abajo).

   Por cada perfil se guarda un estado MÍNIMO y aditivo:
     profile.adapt = { math: { delta:0, upStreak:0, downStreak:0 } }
   (campo nuevo, ignorado por el resto de la app; no se toca profile.ev,
   profile.best ni profile.stars).

   `delta` es un desplazamiento respecto del nivel PERMANENTE/insignia
   (profile.best.math, 0-index, el mismo que ya gobierna MATH_LEVELS y el
   texto "Nivel N" en Inicio). El NIVEL EFECTIVO usado solo para generar
   el RANGO de conteo de la ronda es:
     efectivo = clamp(best.math + delta, 0, MATH_LEVELS.length-1)

   Tras cada ronda de matemáticas resuelta (siempre se resuelve: la pista
   progresiva revela la respuesta tras 2 fallos, así que toda ronda termina
   en afterCorrect con un registro {ft,at,as}):
     - "fuerte" (ft=1, at=1, as=0 · acierto al primer toque, sin pista):
         upStreak++, downStreak=0
         tras 3 rondas fuertes seguidas -> delta=min(+1, delta+1); reinicia upStreak
     - "con dificultad" (at>=3 · 3+ intentos, o as=1 · se reveló la pista):
         downStreak++, upStreak=0
         tras 2 rondas con dificultad seguidas -> delta=max(-2, delta-1); reinicia downStreak
     - cualquier otro caso (p.ej. at=2 sin pista): no penaliza ni premia,
       solo reinicia ambas rachas (evita que un segundo intento aislado
       cuente como "racha rota" injustamente, pero tampoco lo trata como
       señal fuerte de ninguna dirección)

   Notas de diseño ("sin castigar"):
   - Subir exige 3 aciertos limpios seguidos (umbral alto, conservador:
     solo se ofrece un reto extra cuando hay evidencia sólida de dominio).
   - Bajar solo exige 2 rondas con dificultad seguidas (umbral más bajo:
     se prioriza aliviar la frustración rápido) y puede bajar hasta 2
     niveles (MAX_DOWN=-2) para dar aire real, pero solo puede SUBIR 1
     nivel por encima de lo ya ganado (MAX_UP=+1): nunca "adelanta" tanto
     contenido como para generar frustración por sobre-reto.
   - Nunca se persiste en profile.best.math ni se muestra al niño ningún
     mensaje de "bajaste de nivel": el intercambio de nivel en
     roundMathCount() es efímero (dura solo el render síncrono de esa
     ronda) y se restaura de inmediato, así que la insignia "Nivel N" en
     Inicio y el desbloqueo de tipos de ronda (pickMathRound) siguen
     gobernados EXCLUSIVAMENTE por el progreso real (finishGame), intacto.
   - El adulto puede ver una nota breve y opcional en el panel de Progreso
     ("un poco más fácil/desafiante ahora mismo") — nunca el niño.
   - Activable/desactivable en Ajustes (ON por defecto); apagarlo congela
     delta=0 sin perder el historial acumulado (se puede reactivar luego).

   Evidencia: Zona de Desarrollo Próximo (Vygotsky) — el reto debe
   mantenerse ligeramente por encima de lo dominado, con andamiaje;
   Flow (Csikszentmihalyi) — el aprendizaje/disfrute se sostiene cuando
   reto y habilidad quedan emparejados, evitando tanto el aburrimiento
   como la ansiedad; mismo espíritu que la pista progresiva (onWrong) ya
   presente en ship/app.js, que tampoco "castiga" el error.
   ============================================================================ */
(function(){
  if(window.__adaptiveWrapped) return; // idempotente: evita doble envoltura si el script se carga más de una vez
  window.__adaptiveWrapped = true;

  var UP_STREAK_N   = 3;   // rondas fuertes seguidas para subir 1 nivel efectivo
  var DOWN_STREAK_N = 2;   // rondas con dificultad seguidas para bajar 1 nivel efectivo
  var MAX_UP        = 1;   // tope superior del delta (nunca más de 1 nivel por encima de lo ganado)
  var MAX_DOWN      = -2;  // tope inferior del delta (hasta 2 niveles más fácil, temporalmente)

  /* ---------- i18n aditivo (Object.assign, nunca sobreescribe claves previas) ---------- */
  if (typeof UI === 'object' && UI && UI.es && UI.en) {
    Object.assign(UI.es, {
      setAdaptN: 'Ajuste automático de dificultad',
      setAdaptD: 'Sube o baja el reto según cómo le va, sin quitar estrellas ni nivel',
      adaptUp:     '🎯 Ahora un poquito más desafiante — ¡lo está logrando genial!',
      adaptDown:   '🎯 Ahora un poquito más fácil, para tomar confianza.',
      adaptSteady: '🎯 Reto ajustado a su ritmo actual.'
    });
    Object.assign(UI.en, {
      setAdaptN: 'Automatic difficulty',
      setAdaptD: 'Nudges the challenge up or down based on how it’s going — no stars or level lost',
      adaptUp:     '🎯 A bit more challenging right now — doing great!',
      adaptDown:   '🎯 A bit easier right now, to build confidence.',
      adaptSteady: '🎯 Challenge matched to their current pace.'
    });
  }

  /* ---------- configuración (device-wide, mismo patrón que DB.settings.session/coplay) ---------- */
  function ensureAdaptCfg(){
    if(!DB.settings) DB.settings = {};
    if(!DB.settings.adaptive) DB.settings.adaptive = { on:true };
    if(typeof DB.settings.adaptive.on !== 'boolean') DB.settings.adaptive.on = true;
    return DB.settings.adaptive;
  }
  function adaptOn(){ return !!ensureAdaptCfg().on; }

  /* ---------- estado por perfil (campo nuevo, aditivo, con valores por defecto) ---------- */
  function ensureAdapt(p){
    if(!p.adapt) p.adapt = {};
    if(!p.adapt.math || typeof p.adapt.math !== 'object') p.adapt.math = { delta:0, upStreak:0, downStreak:0 };
    var m = p.adapt.math;
    if(typeof m.delta      !== 'number') m.delta      = 0;
    if(typeof m.upStreak   !== 'number') m.upStreak   = 0;
    if(typeof m.downStreak !== 'number') m.downStreak = 0;
    return p.adapt;
  }

  function clampLevel(n){
    if(n < 0) return 0;
    if(n > MATH_LEVELS.length-1) return MATH_LEVELS.length-1;
    return n;
  }

  /* Nivel EFECTIVO (0-index) para la materia math del perfil dado. */
  function effectiveMathLevelFor(p){
    if(!p) return 0;
    ensureAdapt(p);
    var base = (p.best && typeof p.best.math === 'number') ? p.best.math : 0;
    return clampLevel(base + (p.adapt.math.delta || 0));
  }

  /* Actualiza el estado adaptativo con el resultado de UNA ronda de math ya resuelta.
     evSnap = { ft:0|1, at:number, as:0|1 } (misma forma que logRound). */
  function updateAdaptiveMath(evSnap){
    var p = (typeof currentProfile === 'function') ? currentProfile() : null;
    if(!p || !evSnap) return;
    ensureAdapt(p);
    var st = p.adapt.math;
    var strong = evSnap.ft === 1 && evSnap.at === 1 && !evSnap.as;
    var struggled = evSnap.at >= 3 || !!evSnap.as;
    if(strong){
      st.downStreak = 0;
      st.upStreak = (st.upStreak||0) + 1;
      if(st.upStreak >= UP_STREAK_N){ st.delta = Math.min(MAX_UP, (st.delta||0) + 1); st.upStreak = 0; }
    } else if(struggled){
      st.upStreak = 0;
      st.downStreak = (st.downStreak||0) + 1;
      if(st.downStreak >= DOWN_STREAK_N){ st.delta = Math.max(MAX_DOWN, (st.delta||0) - 1); st.downStreak = 0; }
    } else {
      st.upStreak = 0; st.downStreak = 0; // ronda "neutra": no suma ni resta, solo reinicia rachas
    }
    if(typeof saveDB === 'function') saveDB();
  }

  /* ---------- envoltura 1: afterCorrect — captura el resultado de la ronda ----------
     Se lee S.attempts/S.revealed ANTES de llamar a la implementación previa (que a su
     vez ya puede estar envuelta, p.ej. por el modo bilingüe): esos valores de S. no
     se reinician hasta nextRound() (diferido ~1.15s por setTimeout), así que también
     serían válidos leídos después, pero se capturan antes por claridad de intención. */
  var _afterCorrect = window.afterCorrect;
  window.afterCorrect = function(key){
    var game = (typeof S === 'object' && S) ? S.game : null;
    var evSnap = (typeof S === 'object' && S) ? { ft: S.attempts===0?1:0, at: S.attempts+1, as: S.revealed?1:0 } : null;
    _afterCorrect(key);
    try{ if(adaptOn() && game==='math') updateAdaptiveMath(evSnap); }catch(e){ /* nunca rompe el flujo de juego */ }
  };

  /* ---------- envoltura 2: roundMathCount — usa el nivel EFECTIVO solo en este render ----------
     Intercambia p.best.math por el nivel efectivo justo antes de llamar a la
     implementación previa (que lee currentProfile().best.math de forma síncrona para
     elegir el rango [min,max] de MATH_LEVELS y ya no vuelve a leerlo después: los
     manejadores de los botones cierran sobre variables locales, no sobre p.best.math),
     y lo restaura de inmediato en el mismo tick. Por eso NUNCA queda persistido el
     valor efectivo: ni el badge "Nivel N" de Inicio ni finishGame() lo ven jamás. */
  var _roundMathCount = window.roundMathCount;
  window.roundMathCount = function(){
    var p = (typeof currentProfile === 'function') ? currentProfile() : null;
    if(!p || !adaptOn()){ return _roundMathCount(); }
    ensureAdapt(p);
    var orig = p.best.math;
    var eff = effectiveMathLevelFor(p);
    p.best.math = eff;
    try{ _roundMathCount(); }
    finally{ p.best.math = orig; }
  };

  /* ---------- envoltura 3: renderProgress2 — nota breve y opcional para el adulto ----------
     Se añade DESPUÉS de que la implementación previa ya reconstruyó #progBody por
     completo (host.innerHTML=...), por lo que basta con appendChild: no hay riesgo de
     "ya pintado" duplicado porque cada render limpia el host desde cero. Nunca se
     muestra al niño (vive detrás del parent-gate, en la pestaña Progreso). */
  function paintAdaptiveNote(){
    var host = $('progBody'); if(!host) return;
    var p = (typeof currentProfile === 'function') ? currentProfile() : null;
    if(!p || !p.ev || !p.ev.length) return; // el estado "sin datos" ya se muestra; no añadir ruido
    var t = UI[S.lang]; if(!t) return;
    var delta = 0;
    if(p.adapt && p.adapt.math) delta = p.adapt.math.delta || 0;
    var label = delta > 0 ? t.adaptUp : (delta < 0 ? t.adaptDown : t.adaptSteady);
    var note = document.createElement('div');
    note.id = 'adaptNote'; note.className = 'tip adaptNote';
    note.textContent = label;
    host.appendChild(note);
  }
  if(typeof window.renderProgress2 === 'function'){
    var _renderProgress2 = window.renderProgress2;
    window.renderProgress2 = function(){
      _renderProgress2();
      try{ paintAdaptiveNote(); }catch(e){ /* nunca rompe el panel de progreso */ }
    };
  }

  /* ---------- fila de Ajustes (#setAdaptive), mismo patrón que #setCoplay ---------- */
  function ensureAdaptRow(){
    var set = $('setView'); if(!set) return;
    var row = $('setAdaptive');
    if(!row){
      row = document.createElement('div'); row.className = 'setting'; row.id = 'setAdaptive';
      row.innerHTML = '<div><div class="name" id="setAdaptN"></div><div class="desc" id="setAdaptD"></div></div>'
        + '<button class="toggle" id="tgAdaptive" role="switch"><span class="knob"></span></button>';
      var anchor = $('setSessLimit');
      if(anchor && anchor.parentNode === set) set.insertBefore(row, anchor);
      else set.appendChild(row);
    }
    var tg = $('tgAdaptive');
    if(tg && !tg._adWired){
      tg._adWired = true;
      tg.addEventListener('click', function(){
        var cfg = ensureAdaptCfg(); cfg.on = !cfg.on;
        if(typeof saveDB === 'function') saveDB();
        syncAdaptRow();
      });
    }
    applyAdaptiveLang();
    syncAdaptRow();
  }
  function syncAdaptRow(){
    var tg = $('tgAdaptive'); if(!tg) return;
    var on = adaptOn();
    tg.classList.toggle('on', on);
    tg.setAttribute('aria-checked', String(on));
  }
  function applyAdaptiveLang(){
    var t = UI[S.lang]; if(!t) return;
    var n = $('setAdaptN'), d = $('setAdaptD');
    if(n) n.textContent = t.setAdaptN || '';
    if(d) d.textContent = t.setAdaptD || '';
  }

  function wireChrome(){
    var ts = $('tabSet');
    if(ts && !ts._adWired){ ts._adWired = true; ts.addEventListener('click', function(){ ensureAdaptRow(); }); }
    var lb = $('langBtn');
    if(lb && !lb._adWired){ lb._adWired = true; lb.addEventListener('click', applyAdaptiveLang); }
  }

  function init(){
    ensureAdaptCfg();
    ensureAdaptRow();
    wireChrome();
  }
  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', function(){ try{ init(); }catch(e){} }); }
  else { try{ init(); }catch(e){} }

  /* ---------- Extensión a futuras materias (documentado, no implementado en v1) ----------
     reading/science no tienen una escala de "nivel" propia en ship/app.js (LETTERS y
     ANIMALS se muestran completos desde el nivel 1). Si una futura mejora introdujera
     niveles para esas materias, el mismo patrón aplicaría: (a) un
     p.adapt.<game>={delta,upStreak,downStreak} análogo, (b) una envoltura de la
     función de render de esa ronda que intercambie temporalmente el valor leído para
     elegir dificultad, tal como aquí se hace con roundMathCount/p.best.math. */

  /* ---------- API pública para tests/tooling (no expone estado sensible de perfiles) ---------- */
  window.AdaptiveEngine = {
    isOn: adaptOn,
    setOn: function(v){ ensureAdaptCfg().on = !!v; if(typeof saveDB==='function') saveDB(); syncAdaptRow(); },
    effectiveMathLevel: function(){ var p=(typeof currentProfile==='function')?currentProfile():null; return effectiveMathLevelFor(p); },
    getState: function(){ var p=(typeof currentProfile==='function')?currentProfile():null; if(!p) return {delta:0,upStreak:0,downStreak:0}; ensureAdapt(p); return { delta:p.adapt.math.delta, upStreak:p.adapt.math.upStreak, downStreak:p.adapt.math.downStreak }; },
    feed: function(evSnap){ updateAdaptiveMath(evSnap); }, // inyecta un resultado de ronda sintético (tests)
    reset: function(){ var p=(typeof currentProfile==='function')?currentProfile():null; if(!p) return; p.adapt = { math:{delta:0,upStreak:0,downStreak:0} }; if(typeof saveDB==='function') saveDB(); },
    limits: { UP_STREAK_N:UP_STREAK_N, DOWN_STREAK_N:DOWN_STREAK_N, MAX_UP:MAX_UP, MAX_DOWN:MAX_DOWN }
  };
})();
