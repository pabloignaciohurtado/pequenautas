"use strict";
/* ==================== FASE 4 · #5: Detección de frustración (deteccion-frustracion) ====================
   Detecta señales de frustración durante el juego (tiempos altos + fallos seguidos +
   abandono a mitad de ronda + inactividad prolongada) y muestra una alerta SUAVE y NO
   bloqueante al ADULTO (nunca al niño): una tarjeta discreta que se retira sola, más
   una insignia persistente en #profileChip y un resumen en los paneles de Progreso
   (#progBody) y Educador (#eduBody), ambos ya existentes.

   100% ADITIVO y offline:
   - Envuelve window.afterCorrect por REASIGNACIÓN (mismo mecanismo ya usado en
     ship/app.js para speak/speakSeq y para afterCorrect/nextRound en el módulo
     bilingüe): guarda la referencia previa, la llama SIEMPRE primero, y solo
     DESPUÉS evalúa la señal de fin de ronda (tiempo + racha de fallos). No
     redefine su cuerpo.
   - Envuelve window.renderEducator por reasignación (idéntico patrón al usado
     por 04-indice-dominio) para añadir el resumen agregado a #eduBody.
   - El resumen de #progBody se inyecta vía MutationObserver sobre ese host
     (idéntico patrón al usado por 01-eval-pre-post), así aparece sin importar
     si el panel se abrió con click en #tabProg o directamente desde passGate()
     tras el gate de adulto.
   - La detección de abandono/inactividad usa un intervalo propio (setInterval,
     mismo mecanismo que ya usa ship/app.js para el límite de sesión con
     sessTick) que solo LEE S/DB; no envuelve nextRound/goHome/show ni ningún
     otro global adicional.
   - No toca init() ni applyLang().
   - #langBtn y #tabSet se enganchan SOLO con addEventListener (nunca
     .onclick=), igual que hacen los módulos de sesión/co-juego/bilingüe ya
     presentes en ship/app.js, para no romper la cadena de listeners.
   - i18n aditivo vía Object.assign(UI.es,{...}) / Object.assign(UI.en,{...}).
   - Persiste solo un contador y un flag mínimos (profile.frustAlerts,
     DB.settings.frustration) sobre el mecanismo de persistencia ya existente
     (saveDB/localStorage con fallback en memoria). No agrega campos nuevos a
     profile.ev[] ni cambia su forma.
   - Bajo file:// no abre red: todo es DOM + localStorage.
   - Animación limitada a transform/opacity (ver spec.css), respeta
     prefers-reduced-motion.

   Señales (documentadas y deterministas):
     1) Fallos seguidos: rondas consecutivas SIN acierto a la 1ª intacto
        (attempts>0 o asistida) → dispara con racha >= STREAK_LIMIT.
     2) Tiempos altos: ms de una ronda > máx(HITIME_ABS_MS*0.6, mediana propia
        del perfil para esa materia * HITIME_FACTOR); si además la ronda
        necesitó pista revelada, cuenta para una racha de "lentitud asistida"
        que dispara con HITIME_STREAK rondas seguidas.
     3) Abandono a mitad de ronda: se sale de la pantalla 'game' con la sesión
        de esa materia sin terminar (round < totalRounds) habiendo ya fallado
        al menos una vez en la ronda abandonada, o viniendo de racha >= 2.
     4) Inactividad: en medio de una ronda ya fallada al menos una vez, sin
        ningún toque (pointerdown) durante IDLE_MS.
   Cada disparo respeta un cooldown (COOLDOWN_MS) para no saturar al adulto.

   Evidencia: zona de frustración productiva vs. improductiva (Vygotsky, ZPD) ·
   regulación emocional y andamiaje adulto en preescolares (NAEYC 2022) ·
   persistencia en tareas de esfuerzo (Lepper 1973) · AAP: co-juego adulto.
   ============================================================================ */
(function () {
  "use strict";

  /* ---------- umbrales (documentados, fáciles de recalibrar) ---------- */
  var STREAK_LIMIT     = 3;      // rondas seguidas sin acierto limpio a la 1ª
  var HITIME_ABS_MS     = 17000; // techo absoluto si no hay línea base propia
  var HITIME_FACTOR     = 2.4;   // vs. mediana propia del perfil/materia
  var HITIME_STREAK     = 2;     // rondas "lentas + asistidas" seguidas
  var IDLE_MS           = 22000; // sin tocar #stage en medio de una ronda ya fallada
  var COOLDOWN_MS       = 150000; // no repetir aviso antes de esto (2.5 min)
  var TICK_MS           = 1000;
  var CARD_AUTOHIDE_MS  = 14000; // la tarjeta se retira sola; la insignia queda

  /* ---------- i18n aditivo (no toca literales existentes) ---------- */
  if (typeof UI === "object" && UI && UI.es && UI.en) {
    Object.assign(UI.es, {
      frustSettingN: "Alertas de frustración",
      frustSettingD: "Aviso suave si tu peque parece frustrado o cansado",
      frustKicker: "Aviso para ti",
      frustMsgStreak: "Tu peque llevaba varios intentos fallidos seguidos. ¿Le ayudamos o hacemos una pausa?",
      frustMsgSlow: "Está tardando bastante y necesitando pistas. Puede estar costándole esta parte.",
      frustMsgAbandon: "Salió del juego a mitad de una ronda difícil. Podría estar frustrado.",
      frustMsgIdle: "Lleva un rato sin tocar la pantalla en medio de una ronda.",
      frustPause: "Sugerir pausa",
      frustDismiss: "Seguir jugando",
      frustInsightTitle: "😊 Señales de frustración",
      frustInsightNone: "Sin señales detectadas. ¡Todo tranquilo!",
      frustInsightOne: "1 señal detectada hasta ahora.",
      frustInsightMany: "{n} señales detectadas."
    });
    Object.assign(UI.en, {
      frustSettingN: "Frustration alerts",
      frustSettingD: "Gentle heads-up if your child seems frustrated or tired",
      frustKicker: "Heads-up for you",
      frustMsgStreak: "Your child has missed several tries in a row. Offer help or a short break?",
      frustMsgSlow: "This is taking a while and needing hints. This part might be tough right now.",
      frustMsgAbandon: "They left mid-round during a hard one. They might be frustrated.",
      frustMsgIdle: "No taps for a while in the middle of a round.",
      frustPause: "Suggest a break",
      frustDismiss: "Keep playing",
      frustInsightTitle: "😊 Frustration signals",
      frustInsightNone: "No signals detected. All calm!",
      frustInsightOne: "1 signal detected so far.",
      frustInsightMany: "{n} signals detected."
    });
  }

  /* ---------- ajustes persistidos (DB.settings.frustration) ---------- */
  function cfg() {
    if (typeof DB !== "object" || !DB) return { on: true, unseen: false };
    if (!DB.settings) DB.settings = {};
    if (!DB.settings.frustration) DB.settings.frustration = { on: true, unseen: false };
    var c = DB.settings.frustration;
    if (typeof c.on !== "boolean") c.on = true;         // ON por defecto: aviso de seguridad/calidad
    if (typeof c.unseen !== "boolean") c.unseen = false;
    return c;
  }
  function isOn() { return !!cfg().on; }
  function L() { var l = (typeof S === "object" && S) ? S.lang : "es"; return (typeof UI === "object" && UI[l]) ? UI[l] : null; }

  /* ---------- estado de sesión (no persiste tal cual; se recalcula al vuelo) ---------- */
  var streak = 0, hiTimeStreak = 0, lastAlertAt = 0;
  var lastScreen = null, lastGame = null, lastRound = 0, lastAttempts = 0;
  var idleFlagged = false, lastInteractAt = Date.now();

  /* mediana propia del perfil para esa materia (línea base personal) */
  function baselineMs(game) {
    try {
      var p = (typeof currentProfile === "function") ? currentProfile() : null;
      if (!p || !p.ev) return null;
      var arr = p.ev.filter(function (e) { return e.g === game; }).slice(-20).map(function (e) { return e.ms || 0; });
      if (arr.length < 5) return null; // sin historial suficiente: usa el techo absoluto
      arr.sort(function (a, b) { return a - b; });
      return arr[Math.floor(arr.length / 2)];
    } catch (e) { return null; }
  }
  function isHighTime(game, ms) {
    var base = baselineMs(game);
    var limit = base ? Math.max(HITIME_ABS_MS * 0.6, base * HITIME_FACTOR) : HITIME_ABS_MS;
    return ms > limit;
  }

  /* ---------- tarjeta de alerta (no bloqueante, se retira sola) ---------- */
  var card = null, hideTimer = null;
  function buildCard() {
    if (card) return card;
    card = document.createElement("div");
    card.id = "frustCard"; card.className = "frustCard";
    card.setAttribute("role", "status"); card.setAttribute("aria-live", "polite");
    card.innerHTML =
      '<span class="frustIcon" aria-hidden="true">💛</span>' +
      '<div class="frustBody">' +
        '<div class="frustKicker" id="frustKicker"></div>' +
        '<div class="frustMsg" id="frustMsg"></div>' +
        '<div class="frustBtns">' +
          '<button class="btn ghost small" id="frustPauseBtn" type="button"></button>' +
          '<button class="btn ghost small" id="frustDismissBtn" type="button"></button>' +
        "</div>" +
      "</div>";
    var host = $("app") || document.body;
    host.appendChild(card);
    var db = $("frustDismissBtn"), pb = $("frustPauseBtn");
    if (db) db.addEventListener("click", hideCard);
    if (pb) pb.addEventListener("click", function () {
      hideCard();
      try { if (typeof window.triggerSessionBreak === "function") window.triggerSessionBreak(); } catch (e) {}
    });
    return card;
  }
  function paintCardTexts(reasonKey) {
    var t = L(); if (!t || !card) return;
    var k = $("frustKicker"), m = $("frustMsg"), pb = $("frustPauseBtn"), db = $("frustDismissBtn");
    if (k) k.textContent = t.frustKicker;
    if (m) m.textContent = t[reasonKey] || t.frustMsgStreak;
    if (pb) pb.textContent = t.frustPause;
    if (db) db.textContent = t.frustDismiss;
  }
  function showCard(reasonKey) {
    buildCard(); paintCardTexts(reasonKey);
    card.style.display = "flex";
    void card.offsetWidth; // reflow: reinicia la animación de entrada
    card.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideCard, CARD_AUTOHIDE_MS);
  }
  function hideCard() {
    if (!card) return;
    card.classList.remove("show");
    clearTimeout(hideTimer);
    setTimeout(function () { if (card && !card.classList.contains("show")) card.style.display = "none"; }, 260);
  }

  /* ---------- insignia discreta sobre #profileChip (visible en 'home' y 'game') ---------- */
  var badge = null;
  function buildBadge() {
    if (badge) return badge;
    var chip = $("profileChip"); if (!chip) return null;
    try { if (getComputedStyle(chip).position === "static") chip.style.position = "relative"; } catch (e) {}
    badge = document.createElement("span");
    badge.id = "frustBadge"; badge.className = "frustBadge"; badge.hidden = true;
    badge.setAttribute("aria-hidden", "true");
    chip.appendChild(badge);
    return badge;
  }
  function paintBadge() {
    if (!badge) buildBadge();
    if (!badge) return;
    badge.hidden = !cfg().unseen;
  }
  function markSeen() {
    try {
      var c = cfg();
      if (c.unseen) { c.unseen = false; if (typeof saveDB === "function") saveDB(); }
    } catch (e) {}
    paintBadge();
  }

  /* ---------- persistencia mínima + disparo (con cooldown) ---------- */
  function recordAlert(reasonKey) {
    try {
      var p = (typeof currentProfile === "function") ? currentProfile() : null;
      if (p) { p.frustAlerts = (p.frustAlerts || 0) + 1; if (p.frustAlerts > 9999) p.frustAlerts = 9999; }
      var c = cfg(); c.unseen = true;
      if (typeof saveDB === "function") saveDB();
    } catch (e) {}
    paintBadge();
  }
  function trigger(reasonKey) {
    if (!isOn()) return;
    var nowT = Date.now();
    if (nowT - lastAlertAt < COOLDOWN_MS) return; // avisos espaciados: no saturar al adulto
    lastAlertAt = nowT;
    recordAlert(reasonKey);
    // Solo interrumpe visualmente si el adulto puede verla AHORA (sigue en 'game');
    // si ya se salió (abandono), la insignia + el panel de Progreso bastan.
    if (typeof S === "object" && S && S.screen === "game") showCard(reasonKey);
  }

  /* ---------- señales 1+2: fin de ronda (fallos seguidos + tiempos altos) ---------- */
  function evaluateRoundEnd(attempts, ms, assisted, game) {
    var firstTryClean = attempts === 0 && !assisted;
    if (firstTryClean) { streak = 0; } else { streak++; }
    var hi = isHighTime(game, ms);
    if (hi && assisted) { hiTimeStreak++; } else { hiTimeStreak = 0; }
    if (streak >= STREAK_LIMIT) trigger("frustMsgStreak");
    else if (hiTimeStreak >= HITIME_STREAK) trigger("frustMsgSlow");
  }
  if (!window.__frustWrapped) {
    window.__frustWrapped = true;
    var _afterCorrect = window.afterCorrect;
    window.afterCorrect = function (key) {
      // Captura ANTES de llamar al original: S.attempts/S.revealed/S.roundStart
      // son exactamente los mismos valores que usa logRound() para esta ronda.
      var attempts = S.attempts, ms = now() - S.roundStart, assisted = S.revealed, game = S.game;
      _afterCorrect(key);
      try { evaluateRoundEnd(attempts, ms, assisted, game); } catch (e) {}
    };
  }

  /* ---------- señales 3+4: abandono a mitad de ronda + inactividad (tick propio) ---------- */
  document.addEventListener("pointerdown", function () { lastInteractAt = Date.now(); }, true);
  function tick() {
    try {
      if (typeof S !== "object" || !S) return;
      var screenNow = S.screen, roundNow = S.round, gameNow = S.game, totalR = S.totalRounds || 5;

      // Abandono: veníamos de 'game' con una materia sin terminar y ya no estamos ahí.
      if (lastScreen === "game" && screenNow !== "game" && lastGame && lastRound < totalR) {
        if (lastAttempts >= 1 || streak >= 2) trigger("frustMsgAbandon");
        streak = 0; hiTimeStreak = 0;
      }

      // Nueva ronda detectada: reinicia el reloj de inactividad para esa ronda.
      if (gameNow !== lastGame || roundNow !== lastRound) { lastInteractAt = Date.now(); idleFlagged = false; }

      // Inactividad: en juego, ronda en curso, ya con un fallo, sin tocar hace rato.
      if (screenNow === "game" && !S.onBreak && !idleFlagged && (S.attempts || 0) >= 1 && roundNow < totalR) {
        if (Date.now() - lastInteractAt > IDLE_MS) { idleFlagged = true; trigger("frustMsgIdle"); }
      }

      lastScreen = screenNow; lastGame = gameNow; lastRound = roundNow; lastAttempts = S.attempts || 0;
    } catch (e) {}
  }
  setInterval(tick, TICK_MS);

  /* ---------- resumen en el panel de Progreso (#progBody vía MutationObserver) ---------- */
  function insightHTML(n, t) {
    var txt = n === 0 ? t.frustInsightNone : (n === 1 ? t.frustInsightOne : t.frustInsightMany.replace("{n}", n));
    return '<div class="frustInsight" id="frustInsight">' +
      '<div class="lab" style="font-size:13px;font-weight:600;color:var(--ink-soft);margin-bottom:2px">' + eduEsc(t.frustInsightTitle) + "</div>" +
      '<div class="frustInsightRow">' + eduEsc(txt) + "</div></div>";
  }
  function paintProgressInsight() {
    var host = $("progBody"); if (!host) return;
    if (host.querySelector("#frustInsight")) { markSeen(); return; }   // ya pintado para este render
    var t = L(); if (!t) return;
    var p = (typeof currentProfile === "function") ? currentProfile() : null;
    var n = p ? (p.frustAlerts || 0) : 0;
    // El estado "sin datos" (renderProgress2 pinta .empty) puede coexistir con
    // señales de frustración reales: un abandono a mitad de ronda NO llega a
    // registrarse en profile.ev (logRound solo corre en afterCorrect, al
    // ACERTAR), así que un perfil puede tener frustAlerts>0 con 0 rondas
    // logueadas. Solo omitimos el resumen si además no hay ninguna señal.
    if (host.querySelector(".empty") && n === 0) { markSeen(); return; }
    host.insertAdjacentHTML("beforeend", insightHTML(n, t));
    markSeen();
  }
  var __progObsBound = false;
  function bindProgressObserver() {
    var host = $("progBody"); if (!host || __progObsBound) return;
    __progObsBound = true;
    var obs = new MutationObserver(function () { paintProgressInsight(); });
    obs.observe(host, { childList: true });
  }

  /* ---------- resumen en el panel Educador (#eduBody vía envoltura de renderEducator) ---------- */
  function paintEducatorInsight() {
    var host = $("eduBody"); if (!host) return;
    var old = host.querySelector("#frustEduInsight"); if (old) old.remove();
    var t = L(); if (!t) return;
    var profs = (typeof DB === "object" && DB && DB.profiles) ? DB.profiles : [];
    var total = profs.reduce(function (s, p) { return s + (p.frustAlerts || 0); }, 0);
    // Mismo criterio que paintProgressInsight(): un abandono a mitad de ronda
    // puede dejar frustAlerts>0 sin ninguna ronda logueada en profile.ev, así
    // que el estado "sin datos" del panel no debe ocultar señales reales.
    if (host.querySelector(".empty") && total === 0) { markSeen(); return; }
    var txt = total === 0 ? t.frustInsightNone : (total === 1 ? t.frustInsightOne : t.frustInsightMany.replace("{n}", total));
    host.insertAdjacentHTML("beforeend",
      '<div class="frustInsight" id="frustEduInsight"><div class="eduHead">' + eduEsc(t.frustInsightTitle) + "</div>" +
      '<div class="frustInsightRow">' + eduEsc(txt) + "</div></div>");
    markSeen();
  }
  function wireEducator() {
    if (window.__frustEduWrapped) return;
    if (typeof window.renderEducator !== "function") return; // se reintenta más abajo
    window.__frustEduWrapped = true;
    var _renderEducator = window.renderEducator;
    window.renderEducator = function () {
      _renderEducator();
      try { paintEducatorInsight(); } catch (e) {}
    };
  }
  wireEducator();
  if (!window.__frustEduWrapped) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { try { wireEducator(); } catch (e) {} });
    else { try { wireEducator(); } catch (e) {} }
  }

  /* ---------- fila de Ajustes: toggle (idempotente, mismo patrón que setCoplay/setSessLimit) ---------- */
  function ensureSettingRow() {
    var set = $("setView"); if (!set) return;
    var row = $("setFrust");
    if (!row) {
      row = document.createElement("div"); row.className = "setting"; row.id = "setFrust";
      row.innerHTML = '<div><div class="name" id="setFrustN"></div><div class="desc" id="setFrustD"></div></div>' +
        '<button class="toggle" id="tgFrust" role="switch"><span class="knob"></span></button>';
      var anchor = $("setCoplay") || $("setBilMode") || $("setSessLimit");
      if (anchor && anchor.parentNode === set) set.insertBefore(row, anchor.nextSibling);
      else set.appendChild(row);
    }
    var tg = $("tgFrust");
    if (tg && !tg._frustWired) {
      tg._frustWired = true;
      tg.addEventListener("click", function () {
        var c = cfg(); c.on = !c.on;
        if (typeof saveDB === "function") saveDB();
        syncRow();
        if (!c.on) hideCard();
      });
    }
    applyLangRow(); syncRow();
  }
  function syncRow() {
    var tg = $("tgFrust");
    if (tg) { tg.classList.toggle("on", isOn()); tg.setAttribute("aria-checked", String(isOn())); }
  }
  function applyLangRow() {
    var t = L(); if (!t) return;
    var n = $("setFrustN"), d = $("setFrustD");
    if (n) n.textContent = t.frustSettingN || "";
    if (d) d.textContent = t.frustSettingD || "";
  }

  /* ---------- init ---------- */
  function init() {
    cfg();
    buildBadge(); paintBadge();
    bindProgressObserver();
    var ts = $("tabSet");
    if (ts && !ts._frustWired) { ts._frustWired = true; ts.addEventListener("click", function () { ensureSettingRow(); }); }
    var lb = $("langBtn");
    if (lb && !lb._frustWired) { lb._frustWired = true; lb.addEventListener("click", function () { applyLangRow(); if (card && card.classList.contains("show")) { /* el mensaje se repinta en el próximo disparo */ } }); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { try { init(); } catch (e) {} });
  else { try { init(); } catch (e) {} }

  /* ---------- API pública (integración / tests; no expone estado sensible) ---------- */
  window.__frustration = {
    isOn: isOn,
    isAlertVisible: function () { return !!(card && card.classList.contains("show")); },
    dismiss: hideCard,
    getStreak: function () { return streak; },
    getHiTimeStreak: function () { return hiTimeStreak; },
    hasUnseen: function () { return !!cfg().unseen; },
    lastReasonKey: function () { return card && card.classList.contains("show") ? ($("frustMsg") || {}).textContent : null; },
    /* fuerza un disparo saltándose el cooldown (uso en tests) */
    forceTrigger: function (reasonKey) { lastAlertAt = 0; trigger(reasonKey || "frustMsgStreak"); },
    /* alimenta manualmente una ronda cerrada, sin esperar tiempos reales (uso en tests) */
    simulateRound: function (opts) {
      opts = opts || {};
      evaluateRoundEnd(opts.attempts || 0, opts.ms || 0, !!opts.assisted, opts.game || (S && S.game) || "math");
    },
    simulateAbandon: function () { lastAlertAt = 0; trigger("frustMsgAbandon"); },
    simulateIdle: function () { lastAlertAt = 0; trigger("frustMsgIdle"); },
    reset: function () { streak = 0; hiTimeStreak = 0; lastAlertAt = 0; idleFlagged = false; }
  };
})();
