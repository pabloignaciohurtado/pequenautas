"use strict";
/* ============================================================================
   Fase 4 · Mejora #4 "indice-dominio"
   Índice de dominio (0–100 por materia) + curva de aprendizaje (sparkline
   temporal) por niño, dentro del Panel del educador (#eduView / #eduBody)
   ya existente en ship/app.js.

   100% ADITIVO:
   - No redefine ninguna función existente. Envuelve window.renderEducator
     por REASIGNACIÓN (mismo mecanismo ya usado en ship/app.js para
     speak/speakSeq y afterCorrect/nextRound): guarda la referencia previa,
     la llama SIEMPRE primero, y luego añade el bloque de índice de dominio
     al DOM que esa llamada ya construyó.
   - No toca init() ni applyLang().
   - No añade listeners con .onclick= sobre #langBtn/#tabSet (no los toca
     en absoluto; se apoya en que renderEducator() ya se re-invoca desde el
     código existente al abrir la pestaña Educador o cambiar de idioma).
   - Lee únicamente profile.ev[] (ya logueado por logRound/afterCorrect);
     no agrega campos a los eventos ni cambia su forma.
   - Bajo file:// no abre red: solo DOM/localStorage (vía funciones ya
     existentes como saveDB, que este script ni siquiera necesita llamar,
     pues el índice es derivado/computado, no persistido).
   - Animación limitada a transform/opacity (ver spec.css), con
     prefers-reduced-motion respetado por la propia hoja de estilos.

   Fórmula del índice de dominio (0–100), documentada y determinista:
     Por cada ronda registrada e={g,k,ft,at,ms,as} de una materia:
       calidad(e) = clamp( 1 - (e.at-1)*0.22 - (e.as?0.15:0), 0, 1 )
       · e.ft=1 (acierto al primer intento)      -> calidad = 1.0
       · e.at=2 sin asistencia revelada           -> calidad = 0.78
       · e.at=3 sin asistencia revelada           -> calidad = 0.56
       · con pista revelada (e.as=1)              -> resta 0.15 adicional
     El índice pondera más las rondas RECIENTES (mide dominio actual) sin
     descartar el historial (evita que un mal día borre el progreso):
       recientes  = últimas min(12, n) rondas de esa materia
       anteriores = el resto (si existen)
       índice = round( 100 * ( 0.7*avg(calidad recientes)
                              + 0.3*avg(calidad anteriores) ) )
       (si no hay "anteriores", índice = round(100*avg(calidad recientes)))
     Con menos de 1 ronda registrada de la materia: índice = null ("–").

   La "curva de aprendizaje" (sparkline) reutiliza la misma calidad(e) pero
   la agrupa en hasta 6 buckets secuenciales (igual patrón que eduSpark() ya
   existente en ship/app.js para la tendencia global), coloreando cada barra
   como hi/mid/lo (mismas clases de color que .sparkbar).
   ============================================================================ */
(function(){
  var SUBJECTS = ['math', 'reading', 'science'];
  var SUBJECT_EMOJI = { math: '🔢', reading: '🔤', science: '🐢' };

  /* ---------- i18n aditivo (Object.assign, nunca sobreescribe claves previas) ---------- */
  if (typeof UI === 'object' && UI && UI.es && UI.en) {
    Object.assign(UI.es, {
      eduDomTitle: '🎯 Índice de dominio',
      eduDomNoData: 'Sin datos aún'
    });
    Object.assign(UI.en, {
      eduDomTitle: '🎯 Mastery index',
      eduDomNoData: 'No data yet'
    });
  }

  /* ---------- cálculo ---------- */
  function domiQuality(e) {
    var at = (e && e.at) ? e.at : 1;
    var q = 1 - (at - 1) * 0.22 - (e && e.as ? 0.15 : 0);
    if (q < 0) q = 0;
    if (q > 1) q = 1;
    return q;
  }

  function domiAvg(list) {
    if (!list || !list.length) return null;
    var s = 0;
    for (var i = 0; i < list.length; i++) s += domiQuality(list[i]);
    return s / list.length;
  }

  /* índice 0-100 (entero) o null si no hay rondas de esa materia */
  function domiIndex(ev) {
    if (!ev || !ev.length) return null;
    var n = ev.length;
    var recentN = Math.min(12, n);
    var recent = ev.slice(n - recentN);
    var older = ev.slice(0, n - recentN);
    var qRecent = domiAvg(recent);
    var qOlder = domiAvg(older);
    var q = (qOlder === null) ? qRecent : (qRecent * 0.7 + qOlder * 0.3);
    var v = Math.round(q * 100);
    if (v < 0) v = 0; if (v > 100) v = 100;
    return v;
  }

  /* sparkline temporal: hasta 6 barras, altura/color = calidad media del bucket */
  function domiSparkHTML(ev) {
    if (!ev || !ev.length) return '<div class="dSpark" aria-hidden="true"></div>';
    var n = ev.length, B = Math.min(6, n), per = n / B, out = [];
    for (var i = 0; i < B; i++) {
      var s = Math.floor(i * per), e = Math.floor((i + 1) * per);
      if (e <= s) e = s + 1;
      var slice = ev.slice(s, e);
      var q = domiAvg(slice) || 0;
      var cls = q >= 0.7 ? 'hi' : (q >= 0.4 ? 'mid' : 'lo');
      var hgt = 4 + Math.round(q * 14);
      out.push('<span class="dbar ' + cls + '" style="height:' + hgt + 'px"></span>');
    }
    return '<div class="dSpark" aria-hidden="true">' + out.join('') + '</div>';
  }

  /* ---------- construcción de un chip por materia ---------- */
  function domiChip(g, ev, t) {
    var chip = document.createElement('div');
    chip.className = 'eduDomChip' + (ev.length ? '' : ' empty');
    chip.setAttribute('data-domi-subject', g);
    var color = g === 'math' ? 'var(--math)' : (g === 'reading' ? 'var(--read)' : 'var(--sci)');
    chip.style.borderLeftColor = color;
    var label = g === 'math' ? t.math : (g === 'reading' ? t.read : t.sci);
    var idx = domiIndex(ev);
    var numTxt = (idx === null) ? '–' : String(idx);
    chip.innerHTML =
      '<div class="dTop"><span class="dLabel">' + SUBJECT_EMOJI[g] + ' ' + eduEsc(label) + '</span>' +
      '<span class="dNum">' + numTxt + '</span></div>' +
      domiSparkHTML(ev);
    var ariaVal = (idx === null) ? t.eduDomNoData : (idx + '/100');
    chip.setAttribute('aria-label', label + ': ' + ariaVal);
    return chip;
  }

  /* ---------- inserción bajo cada fila .eduChild ya renderizada ---------- */
  function domiEnhanceEducator() {
    var host = (typeof $ === 'function') ? $('eduBody') : document.getElementById('eduBody');
    if (!host) return;
    var kids = host.querySelectorAll('.eduChild');
    if (!kids.length) return;
    var t = (typeof UI === 'object' && typeof S === 'object' && UI[S.lang]) ? UI[S.lang] : (UI && UI.es);
    if (!t) return;

    var heading = document.createElement('div');
    heading.className = 'eduHead eduDomHeading';
    heading.id = 'eduDomHeading';
    heading.textContent = t.eduDomTitle;
    kids[0].parentNode.insertBefore(heading, kids[0]);

    var profs = (typeof DB === 'object' && DB && DB.profiles) ? DB.profiles : [];
    kids.forEach(function (node, i) {
      var p = profs[i];
      if (!p) return;
      var row = document.createElement('div');
      row.className = 'eduDomRow';
      row.setAttribute('data-domi-child', p.id || String(i));
      SUBJECTS.forEach(function (g) {
        var ev = (p.ev || []).filter(function (e) { return e && e.g === g; });
        row.appendChild(domiChip(g, ev, t));
      });
      node.parentNode.insertBefore(row, node.nextSibling);
    });
  }

  /* ---------- envoltura aditiva de renderEducator (por reasignación) ---------- */
  function wire() {
    if (window.__domiWrapped) return;
    if (typeof window.renderEducator !== 'function') return; // se reintenta más abajo
    window.__domiWrapped = true;
    var _renderEducator = window.renderEducator;
    window.renderEducator = function () {
      _renderEducator();
      try { domiEnhanceEducator(); } catch (e) { /* nunca rompe el panel educador */ }
    };
  }

  wire();
  // Salvaguarda: si este script se cargara antes de que app.js definiera
  // renderEducator (no debería ocurrir siguiendo integration.md), reintenta
  // tras DOMContentLoaded sin tocar red ni bloquear la carga.
  if (!window.__domiWrapped) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { try { wire(); } catch (e) {} });
    } else {
      try { wire(); } catch (e) {}
    }
  }

  /* ---------- API pública para tests/tooling (no expone estado sensible) ---------- */
  window.__domi = {
    quality: domiQuality,
    index: domiIndex,
    sparkHTML: domiSparkHTML,
    enhance: domiEnhanceEducator,
    subjects: SUBJECTS.slice()
  };
})();
