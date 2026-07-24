/* Fase 4 #43 - Portón de carga (blocking gate) de recursos.
   Por pedido explícito del product owner: TODOS los recursos deben
   descargarse bloqueando el acceso al juego antes de poder usar la app.
   Se reemplazó la píldora no-bloqueante original por un overlay de
   pantalla completa (papercraft, tonos bosque) que cubre TODO —incluida
   la pantalla "¿Quién juega?" y las tarjetas de materia— hasta que el
   precache real del Service Worker (ver runPrecache en sw.js) llega a
   100% (mensaje 'precache-complete').

   Primera visita vs. visitas repetidas:
   - Solo se muestra el portón si no existe la marca persistida en
     localStorage (PA_DONE_KEY). Esa marca solo se escribe cuando el SW
     confirma 'precache-complete' de verdad (o al consultar el estado
     actual vía PA_QUERY_PRECACHE y recibir que ya está listo).
   - En visitas siguientes, con la marca puesta, el portón NUNCA se
     construye: el peque entra directo a la app (offline-first).

   Fail-open (nunca debe atrapar al peque en un 0% eterno):
   - Si el navegador no soporta Service Worker, o el contexto no es
     "seguro" (mismo criterio que registerPWA en app.js: https o
     localhost/127.0.0.1 — en file:// o http normal el SW ni se registra),
     directamente no se muestra portón: nunca habría precache que esperar.
   - Si ya hay un controller pero pasan CONTROLLER_TIMEOUT_MS sin obtener
     ningún mensaje del SW, se retira igual (fail-open, sin marcar como
     completo, para reintentar en la próxima visita).
   - Si luego de recibir progreso el SW se queda callado más de
     STALL_TIMEOUT_MS, también se retira (fail-open).
   - Tope absoluto HARD_CAP_MS por si el progreso avanza a cuentagotas
     para siempre.
   - Si el total de recursos reportado es 0, se retira de inmediato. */
(function () {
  "use strict";
  if (window.__pa43) return; window.__pa43 = true;

  var PA_DONE_KEY = 'pa_precache_done_v3'; // v3 = coincide con CACHE de sw.js

  var elWrap, elBar, elPct, elTxt;
  var watchdogTimer = null;
  var hardCapTimer = null;
  var dismissed = false;
  var gotAnyMessage = false;

  var CONTROLLER_TIMEOUT_MS = 8000;  // sin ni un solo mensaje del SW -> fail-open
  var STALL_TIMEOUT_MS = 20000;      // progreso empezó pero se detuvo -> fail-open
  var HARD_CAP_MS = 90000;           // tope absoluto de seguridad

  function isSecureRegistrableContext() {
    // Mismo criterio que registerPWA() en app.js: si el SW ni se va a
    // registrar ahí, esperar su progreso aquí sería atrapar al peque
    // sin motivo (p.ej. tests/QA cargando index.html vía file://).
    try {
      return location.protocol === 'https:' ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1';
    } catch (e) { return false; }
  }

  function alreadyDone() {
    try { return localStorage.getItem(PA_DONE_KEY) === '1'; } catch (e) { return false; }
  }

  function markDone() {
    try { localStorage.setItem(PA_DONE_KEY, '1'); } catch (e) {}
  }

  function build() {
    if (elWrap || document.getElementById('pa43gate')) return;
    elWrap = document.createElement('div');
    elWrap.id = 'pa43gate';
    elWrap.className = 'pa43gate';
    elWrap.setAttribute('role', 'alertdialog');
    elWrap.setAttribute('aria-modal', 'true');
    elWrap.setAttribute('aria-label', 'Preparando tu bosque');
    elWrap.innerHTML =
      '<div class="pa43card">' +
        '<div class="pa43mascota">🦉</div>' +
        '<div class="pa43title" id="pa43title">Preparando tu bosque…</div>' +
        '<div class="pa43track"><div class="pa43fill" id="pa43fill"></div></div>' +
        '<div class="pa43pct" id="pa43pct">Descargando recursos… 0%</div>' +
        '<div class="pa43hint">Un momento, casi listo para jugar 🌲</div>' +
      '</div>';
    (document.body || document.documentElement).appendChild(elWrap);
    elBar = document.getElementById('pa43fill');
    elPct = document.getElementById('pa43pct');
    elTxt = document.getElementById('pa43title');
    // bloquea scroll de fondo mientras el portón está activo
    if (document.documentElement) document.documentElement.classList.add('pa43lock');
  }

  function clearTimers() {
    if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
    if (hardCapTimer) { clearTimeout(hardCapTimer); hardCapTimer = null; }
  }

  function armControllerTimeout() {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(function () {
      dismiss(false); // nunca llegó ni un mensaje del SW -> fail-open
    }, CONTROLLER_TIMEOUT_MS);
  }

  function armStallTimeout() {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(function () {
      dismiss(false); // hubo progreso y se detuvo -> fail-open
    }, STALL_TIMEOUT_MS);
  }

  function armHardCap() {
    if (hardCapTimer) return;
    hardCapTimer = setTimeout(function () {
      dismiss(false); // tope absoluto de seguridad -> fail-open
    }, HARD_CAP_MS);
  }

  function update(pct) {
    build();
    armStallTimeout();
    armHardCap();
    var p = Math.max(0, Math.min(100, pct));
    if (elBar) elBar.style.width = p + '%';
    if (elPct) elPct.textContent = 'Descargando recursos… ' + p + '%';
  }

  function dismiss(complete) {
    if (dismissed) return;
    dismissed = true;
    clearTimers();
    if (complete) markDone();
    if (document.documentElement) document.documentElement.classList.remove('pa43lock');
    if (!elWrap) return;
    elWrap.classList.add('pa43out');
    setTimeout(function () {
      if (elWrap && elWrap.parentNode) elWrap.parentNode.removeChild(elWrap);
      elWrap = null;
    }, 420);
  }

  function onMessage(e) {
    var d = e && e.data;
    if (!d || !d.type) return;
    gotAnyMessage = true;
    if (d.type === 'precache-progress') {
      if (!d.total) { dismiss(false); return; } // total 0: nada que esperar
      var pct = Math.round((d.done / d.total) * 100);
      update(pct);
    } else if (d.type === 'precache-complete') {
      update(100);
      dismiss(true);
    }
  }

  if (alreadyDone()) {
    // visita repetida con precache ya confirmado: entra directo, sin portón.
    return;
  }

  try {
    if (!('serviceWorker' in navigator)) return;      // sin soporte: sin portón
    if (!isSecureRegistrableContext()) return;         // el SW ni se registrará: sin portón

    build();
    armControllerTimeout();
    armHardCap();

    navigator.serviceWorker.addEventListener('message', onMessage);

    function queryStatus() {
      try {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'PA_QUERY_PRECACHE' });
        }
        // si no hay controller todavía, seguimos esperando controllerchange/
        // ready más abajo; el timeout de arriba libera si nunca llega.
      } catch (e) { dismiss(false); }
    }

    if (navigator.serviceWorker.controller) {
      queryStatus();
    } else {
      navigator.serviceWorker.addEventListener('controllerchange', queryStatus);
      navigator.serviceWorker.ready.then(queryStatus).catch(function () { dismiss(false); });
    }
  } catch (e) {
    dismiss(false); // SW bloqueado/no disponible: nunca atrapar al peque
  }
})();
