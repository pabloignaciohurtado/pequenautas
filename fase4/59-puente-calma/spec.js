"use strict";
/* ==================== FASE 4 · #59: Puente de calma (puente-calma) ====================
   #05 sabe DETECTAR frustración desde hace muchas olas: rachas de fallos,
   rondas lentas y asistidas, abandono a mitad de ronda, inactividad. Lo que
   nunca tuvo es algo que OFRECER: su tarjeta decía "tu peque parece
   frustrado" y las dos únicas salidas eran "sugerir pausa" (que corta el
   juego) o "seguir jugando" (que no cambia nada).

   #58 construyó la herramienta que faltaba —"Respira con Rufo"— y la dejó
   alcanzable desde fuera con window.pa58Breathe(ciclos). Este módulo es el
   puente entre las dos: una tercera opción en la tarjeta de #05 que abre la
   respiración guiada ahí mismo, sin salir de la app y sin castigar al niño.

   Por qué importa más de lo que parece: una alerta que no ofrece nada
   convierte al adulto en espectador de la frustración. Con la respiración,
   el mismo aviso pasa de diagnóstico a intervención, y de paso el juego
   enseña la competencia que estaba enseñando en #58 justo en el momento en
   que hace falta, que es cuando de verdad se aprende a regularse.

   Y como el módulo se sienta en medio de las dos, es el único punto donde se
   puede medir si la intervención sirve: cuenta cuántas veces se OFRECIÓ la
   calma y cuántas se USÓ, y lo resume en el panel de Progreso. Esa razón
   ofrecidas/usadas es el dato que dice si la tarjeta de #05 está llegando en
   buen momento o interrumpiendo.

   100% ADITIVO:
   - No edita #05 ni #58: espera a que exista #frustCard, le añade un botón
     propio (#pa59Btn) y llama a las APIs públicas que ambos ya exponen
     (window.__frustration.dismiss / window.pa58Breathe).
   - Si #58 aún no ha cargado cuando el adulto pulsa, lo fuerza con
     window.PA_loadModule("58-emociones") y reintenta unos instantes.
   - Persiste sólo dos contadores en el perfil (calmOffered / calmTaken)
     sobre el saveDB ya existente. No toca STORE_KEY.
   - El resumen de Progreso se inyecta con MutationObserver sobre #progBody,
     el mismo patrón que ya usan #01 y #05.
   - i18n aditivo con Object.assign(UI.es,{...}) / Object.assign(UI.en,{...}).
   ============================================================================ */
(function () {
  "use strict";

  var d = document;
  var POLL_MS = 700;      // cada cuánto buscamos la tarjeta de #05
  var POLL_MAX = 90;      // ~1 min: si no aparece, no hay nada que puentear
  var CYCLES = 3;         // ciclos de respiración: suficiente para bajar, corto para no aburrir

  function $id(x) { return d.getElementById(x); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- i18n aditivo ---------- */
  if (typeof UI === "object" && UI && UI.es && UI.en) {
    Object.assign(UI.es, {
      calmBtn: "Respirar con Rufo",
      calmInsightTitle: "🌬️ Momentos de calma",
      calmInsightNone: "Aún no se ha ofrecido ninguna respiración.",
      calmInsightRow: "Ofrecidas: {o} · Usadas: {u}",
      calmInsightAll: "Se usó la respiración cada vez que se ofreció. 💚"
    });
    Object.assign(UI.en, {
      calmBtn: "Breathe with Rufo",
      calmInsightTitle: "🌬️ Calm moments",
      calmInsightNone: "No breathing break offered yet.",
      calmInsightRow: "Offered: {o} · Used: {u}",
      calmInsightAll: "The breathing break was used every time it was offered. 💚"
    });
  }
  function L() {
    var l = (typeof S === "object" && S) ? S.lang : "es";
    return (typeof UI === "object" && UI && UI[l]) ? UI[l] : (typeof UI === "object" && UI ? UI.es : null);
  }

  /* ---------- contadores (perfil, sobre el saveDB existente) ---------- */
  function prof() { try { return (typeof currentProfile === "function") ? currentProfile() : null; } catch (e) { return null; } }
  function bump(field) {
    var p = prof();
    if (!p) return;
    p[field] = (p[field] || 0) + 1;
    if (p[field] > 9999) p[field] = 9999;
    try { if (typeof saveDB === "function") saveDB(); } catch (e) {}
  }
  function stats() {
    var p = prof();
    return { offered: p ? (p.calmOffered || 0) : 0, taken: p ? (p.calmTaken || 0) : 0 };
  }

  /* ---------- abrir la respiración de #58 ---------- */
  function breathe(cycles) {
    if (typeof window.pa58Breathe === "function") { window.pa58Breathe(cycles || CYCLES); return true; }
    // #58 es diferido y podría no haber llegado todavía: se fuerza y se
    // reintenta un momento. Si aun así no está, no pasa nada visible: la
    // tarjeta ya se cerró y el juego sigue como siempre.
    try { if (typeof window.PA_loadModule === "function") window.PA_loadModule("58-emociones"); } catch (e) {}
    var n = 0;
    var iv = setInterval(function () {
      n++;
      if (typeof window.pa58Breathe === "function") { clearInterval(iv); window.pa58Breathe(cycles || CYCLES); }
      else if (n > 20) clearInterval(iv);
    }, 150);
    return false;
  }

  function takeCalm() {
    bump("calmTaken");
    try { if (window.__frustration && typeof window.__frustration.dismiss === "function") window.__frustration.dismiss(); } catch (e) {}
    breathe(CYCLES);
  }

  /* ---------- el botón dentro de la tarjeta de #05 ---------- */
  var btn = null;
  function paintBtn() {
    var t = L();
    if (btn && t && t.calmBtn) btn.textContent = t.calmBtn;
  }
  function injectBtn(card) {
    if (btn && d.body.contains(btn)) return btn;
    var row = card.querySelector(".frustBtns");
    if (!row) return null;
    btn = d.createElement("button");
    btn.type = "button";
    btn.id = "pa59Btn";
    btn.className = "btn ghost small pa59-btn";
    paintBtn();
    btn.addEventListener("click", takeCalm);
    // Primero en la fila: es la opción que queremos que el adulto vea antes
    // que "sugerir pausa", porque no corta el juego.
    row.insertBefore(btn, row.firstChild);
    return btn;
  }

  /* ---------- contar cada vez que la tarjeta se muestra ---------- */
  function watchCard(card) {
    var wasShown = card.classList.contains("show");
    if (wasShown) bump("calmOffered");
    var obs = new MutationObserver(function () {
      var now = card.classList.contains("show");
      if (now && !wasShown) bump("calmOffered");
      wasShown = now;
    });
    obs.observe(card, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------- resumen en el panel de Progreso ---------- */
  function insightHTML(t, s) {
    var txt;
    if (s.offered === 0) txt = t.calmInsightNone;
    else if (s.taken >= s.offered) txt = t.calmInsightAll;
    else txt = t.calmInsightRow.replace("{o}", s.offered).replace("{u}", s.taken);
    return '<div class="pa59-insight" id="pa59Insight">' +
      '<div class="pa59-lab">' + esc(t.calmInsightTitle) + "</div>" +
      '<div class="pa59-row">' + esc(txt) + "</div></div>";
  }
  function paintInsight() {
    var host = $id("progBody");
    if (!host || host.querySelector("#pa59Insight")) return;
    var t = L(); if (!t || !t.calmInsightTitle) return;
    var s = stats();
    // Sin ninguna oferta el resumen no aporta nada y sólo alarga el panel.
    if (s.offered === 0 && s.taken === 0) return;
    host.insertAdjacentHTML("beforeend", insightHTML(t, s));
  }
  var obsBound = false;
  function bindProgressObserver() {
    var host = $id("progBody");
    if (!host || obsBound) return;
    obsBound = true;
    new MutationObserver(function () { paintInsight(); }).observe(host, { childList: true });
  }

  /* ---------- arranque: esperar a que #05 construya su tarjeta ---------- */
  function wireCard(card) {
    injectBtn(card);
    watchCard(card);
  }
  function boot() {
    bindProgressObserver();
    var lb = $id("langBtn");
    if (lb && !lb.__pa59) { lb.__pa59 = true; lb.addEventListener("click", function () { setTimeout(paintBtn, 60); }); }

    var card = $id("frustCard");
    if (card) { wireCard(card); return; }
    var n = 0;
    var iv = setInterval(function () {
      n++;
      var c = $id("frustCard");
      if (c) { clearInterval(iv); wireCard(c); }
      else if (n > POLL_MAX) clearInterval(iv);
    }, POLL_MS);
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* ---------- API pública (tests e integración) ---------- */
  window.pa59 = {
    /* fuerza el puente completo sin esperar a una frustración real */
    offer: function () {
      try { if (window.__frustration && typeof window.__frustration.forceTrigger === "function") window.__frustration.forceTrigger("frustMsgStreak"); } catch (e) {}
      var c = $id("frustCard");
      if (c) wireCard(c);
      return !!$id("pa59Btn");
    },
    take: takeCalm,
    stats: stats,
    hasButton: function () { return !!$id("pa59Btn"); }
  };
})();
