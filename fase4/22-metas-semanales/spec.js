/* ==================== Fase 4 · Mejora #22 "metas-semanales" ====================
   Meta semanal AMABLE (p.ej. 3 sesiones de juego) con progreso visible,
   SIN presión: no hay rachas que se rompen, no hay avisos de "te faltó
   esta semana", la semana simplemente se reinicia sola y en silencio.
   El logro de la meta solo se muestra de forma RETROSPECTIVA, dentro del
   panel de Progreso ya gateado — nunca como HUD/notificación durante el
   juego. Mismo criterio de diseño que #19 "album-logros" para evitar el
   efecto de sobrejustificación (Lepper, Greene & Nisbett 1973): una meta
   de PROCESO (venir a jugar) no debe sentirse como una tarea vigilada
   mientras el niño juega.

   Qué cuenta como "una sesión": una materia completada (S.round llega a
   S.totalRounds, el mismo umbral que ya usa finishGame()). Es una métrica
   simple y ya observable con la granularidad que el juego registra hoy
   (rondas/materias), documentada en integration.md junto a su límite
   conocido (no es lo mismo que "una sentada" delimitada por el límite de
   sesión saludable — ver integration.md §5).

   Patrón 100% aditivo (igual que AudioBank / bilingüe / co-juego / álbum
   de logros / informe semanal ya integrados en ship/):
   - Envuelve window.afterCorrect por reasignación (chain-of-responsibility,
     _fn.apply(this,arguments), siempre delega primero a la versión
     anterior) para detectar el fin de una materia y contar la sesión.
     Mismo global que ya envuelve el bloque bilingüe.
   - Envuelve window.renderProgress2 por reasignación (mismo mecanismo que
     usa #21 "reporte-semanal" sobre el mismo global) para insertar/
     actualizar una tarjeta nueva (#weekGoalCard) como primer hijo de
     #progBody, sin reescribir su cuerpo.
   - Crea la fila de Ajustes (#setWeekGoal / #setWeekGoalTarget) igual que
     hace el modo co-juego con #setCoplay: insertBefore sobre un nodo ya
     existente, sin reescribir #setView.
   - i18n aditivo con Object.assign(UI.es,{...}) / Object.assign(UI.en,{...}).
   - addEventListener SIEMPRE (nunca reasigna .onclick) sobre #langBtn y
     #tabSet, para no romper sus cadenas ya existentes.
   - No toca init() ni applyLang(). No reescribe ningún cuerpo de función
     existente. Animaciones solo transform/opacity (spec.css), respeta
     prefers-reduced-motion. No abre red bajo file:// ni en ningún entorno:
     todo el cálculo es local sobre DB (localStorage con fallback en
     memoria, vía saveDB() ya existente).
   Evidencia: metas de PROCESO pequeñas y alcanzables sostienen la
   motivación autónoma sin generar ansiedad de desempeño (Deci & Ryan;
   Locke & Latham sobre metas específicas-pero-alcanzables; NAEYC 2022
   sobre evitar presión evaluativa en preescolares). */
(function(){
  "use strict";

  var TARGETS = [3, 5, 7];
  var DAY_MS = 86400000;

  /* ---------- i18n aditivo (no toca literales UI.es/UI.en existentes) ---------- */
  if (typeof UI === 'object' && UI.es && UI.en) {
    Object.assign(UI.es, {
      goalToggleN: 'Meta semanal',
      goalToggleD: 'Un objetivo amable de sesiones de juego esta semana',
      goalTargetN: 'Sesiones por semana',
      goalTargetD: 'Cuántas veces te gustaría jugar',
      goalCardTitle: '🌈 Meta semanal',
      goalOfWord: 'de',
      goalThisWeek: 'sesiones esta semana',
      goalStart: '¡Cuando quieras, sin apuro!',
      goalCheer: '¡Vas muy bien!',
      goalReachedMsg: '¡Meta de la semana lograda! Qué lindo que jugaron juntos.'
    });
    Object.assign(UI.en, {
      goalToggleN: 'Weekly goal',
      goalToggleD: 'A gentle weekly play-session goal',
      goalTargetN: 'Sessions per week',
      goalTargetD: 'How many times you’d like to play',
      goalCardTitle: '🌈 Weekly goal',
      goalOfWord: 'of',
      goalThisWeek: 'sessions this week',
      goalStart: 'Whenever you like, no rush!',
      goalCheer: 'You’re doing great!',
      goalReachedMsg: 'This week’s goal is met! Lovely that you played together.'
    });
  }

  function L() { var lang = (typeof S === 'object' && S) ? S.lang : 'es'; return (typeof UI === 'object') ? (UI[lang] || UI.es) : null; }
  function P() { return (typeof currentProfile === 'function') ? currentProfile() : null; }

  /* ---------- semana ISO (lunes→domingo), fecha LOCAL del dispositivo, sin red ---------- */
  function weekKeyFor(d) {
    d = new Date(d.getTime());
    d.setHours(0, 0, 0, 0);
    var day = d.getDay() || 7; // 1..7, lunes=1
    d.setDate(d.getDate() + 4 - day); // jueves de esa semana ISO
    var yearStart = new Date(d.getFullYear(), 0, 1);
    var weekNo = Math.ceil((((d - yearStart) / DAY_MS) + 1) / 7);
    return d.getFullYear() + '-W' + (weekNo < 10 ? '0' : '') + weekNo;
  }

  /* ---------- estado por perfil, inicializado perezosamente (aditivo sobre profile) ---------- */
  function goalState(p) {
    if (!p) return null;
    if (!p.weekGoal || typeof p.weekGoal !== 'object') {
      p.weekGoal = { on: true, target: 3, key: weekKeyFor(new Date()), count: 0, celebratedSeen: false };
    }
    var g = p.weekGoal;
    if (typeof g.on !== 'boolean') g.on = true;
    if (TARGETS.indexOf(g.target) < 0) g.target = 3;
    if (typeof g.count !== 'number' || g.count < 0) g.count = 0;
    if (typeof g.celebratedSeen !== 'boolean') g.celebratedSeen = false;
    var curKey = weekKeyFor(new Date());
    if (g.key !== curKey) { g.key = curKey; g.count = 0; g.celebratedSeen = false; } // semana nueva: reinicio silencioso, sin castigo ni aviso
    return g;
  }

  /* ---------- registra "una sesión de juego" = una materia completada ---------- */
  function registerSession() {
    var p = P(); if (!p) return;
    var g = goalState(p); if (!g.on) return;
    g.count++;
    if (typeof saveDB === 'function') saveDB();
  }

  /* ---------- tarjeta dentro de #progBody (pestaña Progreso, ya gateada) ---------- */
  function pipsHTML(g) {
    var out = '';
    for (var i = 0; i < g.target; i++) {
      out += '<span class="goalPip' + (i < g.count ? ' on' : '') + '" aria-hidden="true">' + (i < g.count ? '🌟' : '⚪') + '</span>';
    }
    return out;
  }
  function renderCard() {
    var host = (typeof $ === 'function') ? $('progBody') : null; if (!host) return;
    var t = L(); if (!t) return;
    var p = P(); if (!p) return;
    var g = goalState(p);
    var reached = g.count >= g.target;

    /* Reusa el nodo si ya existe (p.ej. cuando renderCard() se llama desde
       el listener de #langBtn, fuera del wrap de renderProgress2, con
       #progBody sin repintar) — crear uno nuevo en ese caso duplicaría el
       id #weekGoalCard. Si no existe (renderProgress2 acaba de reescribir
       host.innerHTML por completo), se crea y se antepone. */
    var card = host.querySelector('#weekGoalCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'weekGoalCard';
      host.insertBefore(card, host.firstChild);
    } else if (host.firstElementChild !== card) {
      host.insertBefore(card, host.firstChild); // por si algo más lo desplazó
    }
    card.className = 'goalCard' + (reached ? ' reached' : '') + (g.on ? '' : ' off');
    var msg = reached ? t.goalReachedMsg : (g.count > 0 ? t.goalCheer : t.goalStart);
    card.innerHTML =
      '<div class="goalHead"><span class="goalTitle">' + t.goalCardTitle + '</span>'
      + '<span class="goalCount">' + g.count + ' ' + t.goalOfWord + ' ' + g.target + ' ' + t.goalThisWeek + '</span></div>'
      + '<div class="goalPips">' + pipsHTML(g) + '</div>'
      + '<div class="goalMsg">' + msg + '</div>';

    if (reached && !g.celebratedSeen) {
      g.celebratedSeen = true;
      if (typeof saveDB === 'function') saveDB();
      try { if (typeof S === 'object' && S.anim && typeof confetti === 'function') confetti(); } catch (e) {}
    }
  }

  /* ---------- fila de Ajustes: on/off + selector de objetivo (3/5/7) ---------- */
  function ensureSettingRows() {
    var set = (typeof $ === 'function') ? $('setView') : null; if (!set) return;
    if (!$('setWeekGoal')) {
      var row = document.createElement('div'); row.className = 'setting'; row.id = 'setWeekGoal';
      row.innerHTML =
        '<div class="txt"><div class="name" id="goalToggleN"></div><div class="desc" id="goalToggleD"></div></div>'
        + '<button class="toggle" id="tgGoalOn" role="switch"><span class="knob"></span></button>';
      var anchor = $('setBilMode') || $('setSessLimit');
      if (anchor && anchor.parentNode === set) set.insertBefore(row, anchor); else set.appendChild(row);
    }
    if (!$('setWeekGoalTarget')) {
      var row2 = document.createElement('div'); row2.className = 'setting'; row2.id = 'setWeekGoalTarget';
      var opts = TARGETS.map(function (n) { return '<button class="btn ghost" data-target="' + n + '" aria-pressed="false">' + n + '</button>'; }).join('');
      row2.innerHTML =
        '<div class="txt"><div class="name" id="goalTargetN"></div><div class="desc" id="goalTargetD"></div></div>'
        + '<div class="choices goalTarget" id="goalTargetChoices">' + opts + '</div>';
      var afterRow = $('setWeekGoal');
      if (afterRow && afterRow.parentNode === set) set.insertBefore(row2, afterRow.nextSibling); else set.appendChild(row2);
    }
    var tg = $('tgGoalOn');
    if (tg && !tg._goalWired) {
      tg._goalWired = true;
      tg.addEventListener('click', function () {
        var p = P(); if (!p) return; var g = goalState(p); g.on = !g.on;
        if (typeof saveDB === 'function') saveDB();
        syncSettingRows();
      });
    }
    var box = $('goalTargetChoices');
    if (box && !box._goalWired) {
      box._goalWired = true;
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-target]'); if (!b) return;
        var p = P(); if (!p) return; var g = goalState(p); g.target = Number(b.dataset.target);
        if (typeof saveDB === 'function') saveDB();
        syncSettingRows();
      });
    }
    applyLangRows(); syncSettingRows();
  }
  function syncSettingRows() {
    var p = P(); if (!p) return; var g = goalState(p);
    var tg = $('tgGoalOn'); if (tg) { tg.classList.toggle('on', g.on); tg.setAttribute('aria-checked', String(g.on)); }
    var box = $('goalTargetChoices');
    if (box) {
      box.querySelectorAll('button[data-target]').forEach(function (b) {
        var sel = Number(b.dataset.target) === g.target;
        b.classList.toggle('ghost', !sel); b.setAttribute('aria-pressed', String(sel));
      });
      box.classList.toggle('disabled', !g.on);
    }
  }
  function applyLangRows() {
    var t = L(); if (!t) return;
    var set = function (id, txt) { var el = $(id); if (el && txt != null) el.textContent = txt; };
    set('goalToggleN', t.goalToggleN); set('goalToggleD', t.goalToggleD);
    set('goalTargetN', t.goalTargetN); set('goalTargetD', t.goalTargetD);
  }

  /* ---------- wrap de window.afterCorrect (chain-of-responsibility) ---------- */
  if (!window.__weekGoalAfterWrapped) {
    window.__weekGoalAfterWrapped = true;
    var _afterCorrect = window.afterCorrect;
    if (typeof _afterCorrect === 'function') {
      window.afterCorrect = function () {
        var r = _afterCorrect.apply(this, arguments);
        try { if (typeof S === 'object' && S.round >= S.totalRounds) registerSession(); } catch (e) {}
        return r;
      };
    }
  }

  /* ---------- wrap de window.renderProgress2 (mismo mecanismo que #21 "reporte-semanal") ---------- */
  if (!window.__weekGoalProgWrapped) {
    window.__weekGoalProgWrapped = true;
    var _renderProgress2 = window.renderProgress2;
    if (typeof _renderProgress2 === 'function') {
      window.renderProgress2 = function () {
        var r = _renderProgress2.apply(this, arguments);
        try { renderCard(); } catch (e) {}
        return r;
      };
    }
  }

  /* ---------- addEventListener SIEMPRE (nunca .onclick=) sobre #langBtn/#tabSet ---------- */
  function wireChrome() {
    var ts = $('tabSet');
    if (ts && !ts._goalWired) { ts._goalWired = true; ts.addEventListener('click', function () { ensureSettingRows(); }); }
    var lb = $('langBtn');
    if (lb && !lb._goalWired) {
      lb._goalWired = true;
      lb.addEventListener('click', function () {
        applyLangRows();
        var pv = $('progView'); if (pv && pv.style.display !== 'none') renderCard();
      });
    }
  }

  function init() {
    try { ensureSettingRows(); wireChrome(); } catch (e) {}
  }

  /* ---------- API pública para tests/tooling (no expone datos sensibles) ---------- */
  window.__weeklyGoal = {
    weekKeyFor: weekKeyFor,
    registerSession: registerSession,
    state: function () { var p = P(); return p ? goalState(p) : null; },
    render: renderCard,
    setTarget: function (n) { var p = P(); if (!p) return false; if (TARGETS.indexOf(n) < 0) return false; var g = goalState(p); g.target = n; if (typeof saveDB === 'function') saveDB(); return true; },
    setOn: function (on) { var p = P(); if (!p) return false; var g = goalState(p); g.on = !!on; if (typeof saveDB === 'function') saveDB(); return true; },
    targets: TARGETS.slice()
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { try { init(); } catch (e) {} });
  else { try { init(); } catch (e) {} }
})();
