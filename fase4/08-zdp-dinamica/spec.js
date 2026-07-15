"use strict";
/* ============================================================================
   Fase 4 · Mejora #8 "zdp-dinamica"
   ZDP dinámica (Zona de Desarrollo Próximo, Vygotsky): mide la racha de
   ACIERTO EN VENTANA DESLIZANTE por materia y, si el % de aciertos-a-la-1ª
   se sale de la banda ~70–85%, ajusta el reto EN VIVO (ronda a ronda) para
   volver a traerlo a esa banda. Es un mecanismo distinto y complementario al
   de la mejora #6 "motor-adaptativo" (que sube/baja por RACHAS de N rondas
   consecutivas, solo en Números): aquí el disparador es el % de acierto
   dentro de una ventana de las últimas rondas, y cubre las 3 materias
   (Números, Letras, Animales) con una palanca de reto propia para cada una.

   100% ADITIVO, mismo mecanismo que ya usa ship/app.js (AudioBank sobre
   speak/speakSeq, Bilingüe sobre afterCorrect/nextRound, Educador sobre
   showTab, Motor adaptativo sobre afterCorrect/roundMathCount): envuelve
   funciones existentes POR REASIGNACIÓN de window.*, guardando y llamando
   SIEMPRE primero a la referencia previa.
   - No redefine el CUERPO de ninguna función existente (nunca la reescribe;
     cuando necesita cambiar lo que una ronda genera, lo hace sesgando datos
     de ENTRADA de solo lectura —p.best.math, LETTERS[lang]— de forma
     síncrona y efímera, restaurados en un finally, o eligiendo QUÉ función
     de ronda ya existente invocar).
   - No toca init() ni applyLang().
   - No usa .onclick= sobre #langBtn/#tabSet (usa addEventListener).
   - i18n aditivo vía Object.assign(UI.es,{...}) / Object.assign(UI.en,{...}).
   - Bajo file:// no abre red: solo DOM/localStorage (vía saveDB() ya
     existente). Cero fetch/XHR/WebSocket.
   - Sin animaciones nuevas (solo texto); si las hubiera, transform/opacity
     y respeto de prefers-reduced-motion (ver spec.css, no aplica en v1).

   ---------------------------------------------------------------------------
   MODELO

   Por perfil se guarda un estado mínimo y aditivo, uno por materia:
     profile.zdp = {
       math:    { tier:0, win:[...0|1], n:0, lastAdjN:0 },
       reading: { tier:0, win:[...0|1], n:0, lastAdjN:0 },
       science: { tier:0, win:[...0|1], n:0, lastAdjN:0 }
     }
   `win` guarda hasta WIN_SIZE resultados de ronda (1 = acierto a la 1ª
   intentona sin pista revelada, 0 = con intentos/pista) — la misma señal
   `ft` que ya registra logRound(). `tier` es un entero acotado a
   [TIER_MIN,TIER_MAX] que representa cuánto más difícil (tier>0) o más
   fácil (tier<0) que el nivel "de base" del niño se le está presentando el
   contenido AHORA MISMO, sin tocar su progreso permanente.

   Tras cada ronda resuelta (afterCorrect, siempre se llega ahí: la pista
   progresiva revela la respuesta tras 2 fallos):
     1) win.push(S.attempts===0 ? 1 : 0); recorta a los últimos WIN_SIZE.
     2) Si hay al menos MIN_SAMPLES datos Y pasaron al menos COOLDOWN rondas
        desde el último ajuste (evita oscilar ronda a ronda):
          acc = suma(win) / win.length
          acc > 0.85  -> tier = min(TIER_MAX, tier+1)   (va sobrado: más reto)
          acc < 0.70  -> tier = max(TIER_MIN, tier-1)   (le cuesta: más apoyo)
          0.70..0.85  -> se queda igual (JUSTO en su ZDP: no se toca nada)

   Aplicación del tier (siempre restaurando el estado real, nunca persiste
   una progresión distinta a la que ya gobierna finishGame()/best.math):

     · Números (roundMath, dispatcher ya existente desde Fase 2): antes de
       invocar la implementación previa, sesga SOLO EN MEMORIA
       profile.best.math = clamp(real + tier, 0, MATH_LEVELS.length-1) y lo
       restaura en un finally. Esto amplía/reduce el rango de conteo
       (MATH_LEVELS) y adelanta/retrasa el desbloqueo del modo "comparar"
       (pickMathRound ya mira best.math>=1) — ambos ya existentes, sin
       tocar su código.
     · Letras (roundReading): si tier<0 (le cuesta), antes de invocar la
       implementación previa, sustituye temporalmente LETTERS[lang] por un
       subconjunto de solo 3 letras (las primeras del set curado — ver nota
       de diseño en integration.md) para reducir la variedad y así la carga;
       se restaura de inmediato. Si tier>=0 no se toca nada (el set curado
       de 8 letras ya es el "techo" de reto disponible sin curar contenido
       nuevo — ver "Límites" más abajo).
     · Animales (renderScienceRound, dispatcher ya existente desde Fase 2):
       en vez de alternar hábitat/dieta 1:1 por ronda, si tier<0 se queda
       SIEMPRE en hábitat (roundScience, el tipo más concreto/directo); si
       tier>0 se queda SIEMPRE en dieta (roundScienceDiet, el tipo más
       inferencial/abstracto); si tier===0 conserva la alternancia original.

   Notas de diseño:
   - Banda 70–85% con evidencia de "desirable difficulty" (Bjork) y ZDP
     (Vygotsky): ni tan fácil que aburra, ni tan difícil que frustre.
   - tier nunca se comunica al niño como logro/fallo (no hay texto ni sonido
     nuevo en el juego); es invisible para él, igual que el "motor
     adaptativo" de la mejora #6.
   - OFF por defecto (DB.settings.zdp=false): mejora #8 es un mecanismo
     nuevo y este entregable no fue verificado en producción con usuarios
     reales; se activa desde Ajustes. Con OFF, todas las envolturas
     devuelven de inmediato la implementación previa sin tocar nada (tier
     se sigue registrando en profile.zdp para no perder histórico, pero no
     se APLICA a ninguna ronda) — así los 19 tests existentes, que no
     activan el toggle, quedan exactamente iguales.
   - Ventana WIN_SIZE=6, MIN_SAMPLES=4, COOLDOWN=3 rondas entre ajustes:
     conservador a propósito para no "perseguir" cada resultado aislado.
     Centralizado en constantes al inicio del IIFE para recalibrar sin
     tocar el resto de la lógica.

   Límites (alcance v1, documentados en vez de forzados con hacks frágiles):
   - Letras solo puede ENDURECERSE hasta el techo del set curado actual (8
     letras/idioma): no se inventan letras "difíciles" nuevas ni distractores
     extra (los helpers rnd/shuffle/sample son `const`, no reasignables por
     diseño del propio ship/app.js; ver integration.md). Con tier>0 el juego
     de letras simplemente no se endurece más allá del baseline — no hay
     retroceso ni ruptura, solo un techo documentado.
   - Animales no tiene "rango" de dificultad graduable dentro de cada tipo
     de ronda (siempre 3 hábitats o 2 dietas fijos); el reto se ajusta
     eligiendo el TIPO de ronda, no la dificultad interna de cada una.

   Evidencia: Vygotsky (ZDP) · Bjork (desirable difficulty) · Csikszentmihalyi
   (Flow) · mismo espíritu que la pista progresiva (onWrong) ya existente.
   ============================================================================ */
(function(){
  if(window.__zdpDinWrapped) return; // idempotente: evita doble envoltura
  window.__zdpDinWrapped = true;

  var GAMES        = ['math','reading','science'];
  var WIN_SIZE      = 6;    // rondas recordadas en la ventana deslizante por materia
  var MIN_SAMPLES   = 4;    // mínimo de rondas en ventana antes de evaluar
  var COOLDOWN      = 3;    // rondas mínimas entre dos ajustes de tier (evita oscilar)
  var TIER_MIN      = -1;   // techo de apoyo (1 escalón más fácil)
  var TIER_MAX      = 2;    // techo de reto (2 escalones más difícil)
  var ACC_HIGH      = 0.85; // por encima: sube el reto
  var ACC_LOW       = 0.70; // por debajo: baja el reto
  var EASY_READ_N   = 3;    // nº de letras del subconjunto "fácil" (primeras del set curado)

  /* ---------- i18n aditivo (Object.assign, nunca sobreescribe claves previas) ---------- */
  if (typeof UI === 'object' && UI && UI.es && UI.en) {
    Object.assign(UI.es, {
      setZdpN: 'Reto en su Zona de Desarrollo Próximo',
      setZdpD: 'Ajusta el desafío en vivo para mantener ~70–85% de acierto'
    });
    Object.assign(UI.en, {
      setZdpN: 'Zone-of-proximal-development challenge',
      setZdpD: 'Live-adjusts difficulty to keep ~70–85% accuracy'
    });
  }

  /* ---------- configuración (device-wide, mismo patrón que DB.settings.session/coplay) ---------- */
  function zdpCfg(){
    if(!DB.settings) DB.settings = {};
    if(typeof DB.settings.zdp !== 'boolean') DB.settings.zdp = false; // OFF por defecto
    return DB.settings.zdp;
  }
  function setZdpOn(v){ if(!DB.settings) DB.settings={}; DB.settings.zdp=!!v; if(typeof saveDB==='function') saveDB(); syncZdpToggle(); }

  /* ---------- estado por perfil (campo nuevo, aditivo, con valores por defecto) ---------- */
  function ensureZdp(p){
    if(!p) return null;
    if(!p.zdp) p.zdp = {};
    GAMES.forEach(function(g){
      if(!p.zdp[g] || typeof p.zdp[g] !== 'object') p.zdp[g] = { tier:0, win:[], n:0, lastAdjN:0 };
      var z = p.zdp[g];
      if(typeof z.tier !== 'number') z.tier = 0;
      if(!Array.isArray(z.win)) z.win = [];
      if(typeof z.n !== 'number') z.n = 0;
      if(typeof z.lastAdjN !== 'number') z.lastAdjN = 0;
    });
    return p.zdp;
  }

  function tierOf(game){
    var p = (typeof currentProfile==='function') ? currentProfile() : null;
    if(!p) return 0;
    var z = ensureZdp(p);
    return (z && z[game]) ? z[game].tier : 0;
  }

  /* Registra el resultado (acierto a la 1ª o no) de la ronda recién resuelta
     y reajusta el tier si la ventana ya tiene datos suficientes y pasó el
     cooldown. Se ejecuta SIEMPRE (registra histórico) aunque el toggle esté
     OFF, para no perder datos si el adulto lo activa más tarde; solo la
     APLICACIÓN a las rondas está gateada por zdpCfg() en cada envoltura. */
  function recordOutcome(game, firstTry){
    if(GAMES.indexOf(game) < 0) return;
    var p = (typeof currentProfile==='function') ? currentProfile() : null;
    if(!p) return;
    var z = ensureZdp(p)[game];
    z.win.push(firstTry ? 1 : 0);
    if(z.win.length > WIN_SIZE) z.win.shift();
    z.n++;
    if(z.win.length >= MIN_SAMPLES && (z.n - z.lastAdjN) >= COOLDOWN){
      var acc = z.win.reduce(function(a,b){ return a+b; }, 0) / z.win.length;
      if(acc > ACC_HIGH && z.tier < TIER_MAX){ z.tier++; z.lastAdjN = z.n; }
      else if(acc < ACC_LOW && z.tier > TIER_MIN){ z.tier--; z.lastAdjN = z.n; }
    }
    if(typeof saveDB === 'function') saveDB();
  }

  /* ---------- envoltura 1: afterCorrect — captura el resultado de la ronda ----------
     Lee S.game/S.attempts ANTES de llamar a la implementación previa (que ya
     puede venir envuelta por bilingüe/motor-adaptativo/etc.): esos valores de
     S. no se reinician hasta nextRound() (diferido ~1.15s por setTimeout), así
     que se capturan al entrar por claridad de intención, no por necesidad. */
  var _afterCorrect = window.afterCorrect;
  window.afterCorrect = function(key){
    var game = (typeof S === 'object' && S) ? S.game : null;
    var firstTry = (typeof S === 'object' && S) ? (S.attempts === 0) : false;
    var r = _afterCorrect(key);
    try{ recordOutcome(game, firstTry); }catch(e){ /* nunca rompe el flujo de juego */ }
    return r;
  };

  /* ---------- envoltura 2: roundMath — sesga temporalmente best.math (Números) ----------
     roundMath() es el dispatcher de Fase 2 (pickMathRound + roundMathCount/
     Subitize/Compare); ambos leen currentProfile().best.math de forma
     síncrona dentro del mismo tick. Se intercambia por el nivel efectivo
     justo antes de llamar a la implementación previa y se restaura en un
     finally: nunca queda persistido (ni el badge "Nivel N" de Inicio ni
     finishGame() lo ven jamás). */
  var _roundMath = window.roundMath;
  window.roundMath = function(){
    var p = (typeof currentProfile==='function') ? currentProfile() : null;
    var t = tierOf('math');
    if(!p || !zdpCfg() || t === 0 || typeof MATH_LEVELS === 'undefined'){ return _roundMath(); }
    var real = p.best.math || 0;
    p.best.math = Math.max(0, Math.min(MATH_LEVELS.length - 1, real + t));
    try{ return _roundMath(); }
    finally{ p.best.math = real; }
  };

  /* ---------- envoltura 3: roundReading — reduce el pool en tier<0 (Letras) ----------
     LETTERS es un objeto `const`, pero sus propiedades (LETTERS.es/LETTERS.en,
     arrays) son mutables: se sustituye el array del idioma activo por un
     subconjunto de las primeras EASY_READ_N letras del set curado (asumiendo
     que ya vienen en un orden pedagógicamente creciente, como en ship/app.js)
     justo antes de llamar a la implementación previa, y se restaura siempre
     en un finally. Con tier>=0 no se toca nada: el juego de letras no tiene
     hoy un eje de "más difícil" disponible sin curar contenido nuevo (ver
     "Límites" en la cabecera de este archivo). */
  var _roundReading = window.roundReading;
  window.roundReading = function(){
    var t = tierOf('reading');
    if(!zdpCfg() || t >= 0 || typeof LETTERS === 'undefined'){ return _roundReading(); }
    var lang = S.lang, full = LETTERS[lang];
    if(!full || full.length <= EASY_READ_N){ return _roundReading(); }
    LETTERS[lang] = full.slice(0, EASY_READ_N);
    try{ return _roundReading(); }
    finally{ LETTERS[lang] = full; }
  };

  /* ---------- envoltura 4: renderScienceRound — sesga el TIPO de ronda (Animales) ----------
     Dispatcher de Fase 2 (alterna roundScience/roundScienceDiet por paridad
     de ronda). Con tier<0 se fuerza siempre hábitat (más concreto); con
     tier>0 siempre dieta (más inferencial); con tier===0 se deja la
     alternancia original intacta. No se reescribe roundScience ni
     roundScienceDiet: solo se elige cuál invocar. */
  var _renderScienceRound = window.renderScienceRound;
  window.renderScienceRound = function(){
    var t = tierOf('science');
    if(!zdpCfg() || t === 0){ return _renderScienceRound(); }
    if(t < 0 && typeof roundScience === 'function') return roundScience();
    if(t > 0 && typeof roundScienceDiet === 'function') return roundScienceDiet();
    return _renderScienceRound();
  };

  /* ---------- envoltura 5: refreshHome — indicador discreto opcional (adulto/niño) ----------
     Añade un emoji pequeño y no verbal junto al badge "Nivel N" de cada
     materia cuando el tier vigente no es 0 (🔥 = más reto ahora mismo,
     🌱 = más apoyo ahora mismo). Puramente informativo; no cambia el nivel
     permanente mostrado ni ningún otro texto. Se ejecuta DESPUÉS de la
     implementación previa (que ya fijó el texto base "Nivel N"). */
  var _refreshHome = window.refreshHome;
  window.refreshHome = function(){
    var r = _refreshHome();
    try{
      if(!zdpCfg()) return r;
      var ids = { math:'lvMath', reading:'lvRead', science:'lvSci' };
      GAMES.forEach(function(g){
        var el = $(ids[g]); if(!el) return;
        var t = tierOf(g);
        var base = el.textContent.replace(/\s*[🔥🌱]\s*$/, '');
        el.textContent = base + (t > 0 ? ' 🔥' : t < 0 ? ' 🌱' : '');
      });
    }catch(e){ /* nunca rompe Inicio */ }
    return r;
  };

  /* ---------- fila de Ajustes (#setZdp) — auto-inyectada (patrón loader, como #setAdaptive de #6) ---------- */
  function ensureZdpRow(){
    var set = $('setView'); if(!set) return;
    var row = $('setZdp');
    if(!row){
      row = document.createElement('div'); row.className = 'setting'; row.id = 'setZdp';
      row.innerHTML = '<div><div class="name" id="setZdpN"></div><div class="desc" id="setZdpD"></div></div>'
        + '<button class="toggle" id="tgZdp" role="switch"><span class="knob"></span></button>';
      var anchor = $('setSessLimit');
      if(anchor && anchor.parentNode === set) set.insertBefore(row, anchor);
      else set.appendChild(row);
    }
    wireZdpToggle();
    applyZdpLang();
    syncZdpToggle();
  }
  function applyZdpLang(){
    var t = UI[S.lang]; if(!t) return;
    var n = $('setZdpN'), d = $('setZdpD');
    if(n) n.textContent = t.setZdpN || '';
    if(d) d.textContent = t.setZdpD || '';
  }
  function syncZdpToggle(){
    var tg = $('tgZdp'); if(!tg) return;
    var on = zdpCfg();
    tg.classList.toggle('on', on);
    tg.setAttribute('aria-checked', String(on));
  }
  function wireZdpToggle(){
    var tg = $('tgZdp');
    if(tg && !tg._zdpWired){
      tg._zdpWired = true;
      tg.addEventListener('click', function(){ setZdpOn(!zdpCfg()); });
    }
  }

  function wireChrome(){
    var ts = $('tabSet');
    if(ts && !ts._zdpWired){ ts._zdpWired = true; ts.addEventListener('click', function(){ ensureZdpRow(); }); }
    var lb = $('langBtn');
    if(lb && !lb._zdpWired){ lb._zdpWired = true; lb.addEventListener('click', applyZdpLang); }
  }

  function init(){
    ensureZdpRow();
    wireChrome();
  }
  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', function(){ try{ init(); }catch(e){} }); }
  else { try{ init(); }catch(e){} }

  /* ---------- API pública para tests/tooling (no expone estado sensible de perfiles) ---------- */
  window.ZDP = {
    isOn: zdpCfg,
    setOn: setZdpOn,
    tier: tierOf,
    state: function(game){
      var p = (typeof currentProfile==='function') ? currentProfile() : null;
      if(!p) return null;
      var z = ensureZdp(p)[game];
      return z ? { tier:z.tier, win:z.win.slice(), n:z.n, lastAdjN:z.lastAdjN } : null;
    },
    forceTier: function(game, n){ // solo para tests deterministas
      var p = (typeof currentProfile==='function') ? currentProfile() : null; if(!p) return;
      var z = ensureZdp(p)[game]; if(!z) return;
      z.tier = Math.max(TIER_MIN, Math.min(TIER_MAX, n|0));
      if(typeof saveDB==='function') saveDB();
    },
    feed: function(game, firstTry){ recordOutcome(game, !!firstTry); }, // inyecta un resultado sintético
    reset: function(game){
      var p = (typeof currentProfile==='function') ? currentProfile() : null; if(!p) return;
      var z = ensureZdp(p); if(game){ z[game] = { tier:0, win:[], n:0, lastAdjN:0 }; }
      else { GAMES.forEach(function(g){ z[g] = { tier:0, win:[], n:0, lastAdjN:0 }; }); }
      if(typeof saveDB==='function') saveDB();
    },
    limits: { WIN_SIZE:WIN_SIZE, MIN_SAMPLES:MIN_SAMPLES, COOLDOWN:COOLDOWN, TIER_MIN:TIER_MIN, TIER_MAX:TIER_MAX, ACC_HIGH:ACC_HIGH, ACC_LOW:ACC_LOW, EASY_READ_N:EASY_READ_N }
  };
})();
