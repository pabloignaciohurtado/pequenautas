/* Fase 4 #43 - Barra de progreso de descarga/instalación de recursos.
   100% aditivo. Escucha los mensajes postMessage del Service Worker (sw.js)
   que reporta el avance real del precache en segundo plano de todos los
   módulos de fase4/ (ver runPrecache en sw.js) y muestra una píldora
   pequeña y amistosa, no bloqueante, cerca del borde inferior de la
   pantalla. No interfiere con la interacción: el peque puede elegir perfil
   y jugar mientras la descarga sigue en background. Si el navegador no
   soporta Service Worker (o falla el registro), simplemente no se muestra
   nada: la app sigue funcionando igual que hoy vía carga on-demand. */
(function () {
  "use strict";
  if (window.__pa43) return; window.__pa43 = true;

  var elWrap, elBar, elTxt;

  function build() {
    if (document.getElementById('pa43wrap')) return;
    elWrap = document.createElement('div');
    elWrap.id = 'pa43wrap';
    elWrap.className = 'pa43wrap';
    elWrap.setAttribute('aria-hidden', 'true');
    elWrap.innerHTML =
      '<div class="pa43pill">' +
        '<span class="pa43ico">🌲</span>' +
        '<span class="pa43txt" id="pa43txt">Preparando tu bosque…</span>' +
        '<div class="pa43track"><div class="pa43fill" id="pa43fill"></div></div>' +
      '</div>';
    (document.body || document.documentElement).appendChild(elWrap);
    elBar = document.getElementById('pa43fill');
    elTxt = document.getElementById('pa43txt');
  }

  function show(pct) {
    build();
    requestAnimationFrame(function () { elWrap.classList.add('show'); });
    var p = Math.max(0, Math.min(100, pct));
    if (elBar) elBar.style.width = p + '%';
    if (elTxt) elTxt.textContent = 'Descargando recursos… ' + p + '%';
  }

  function hide() {
    if (!elWrap) return;
    elWrap.classList.add('done');
    setTimeout(function () {
      if (!elWrap) return;
      elWrap.classList.remove('show');
      setTimeout(function () {
        if (elWrap && elWrap.parentNode) elWrap.parentNode.removeChild(elWrap);
      }, 500);
    }, 500);
  }

  function onMessage(e) {
    var d = e && e.data;
    if (!d || !d.type) return;
    if (d.type === 'precache-progress') {
      var pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
      show(pct);
    } else if (d.type === 'precache-complete') {
      hide();
    }
  }

  try {
    if (!('serviceWorker' in navigator)) return; // sin soporte: fallback silencioso
    navigator.serviceWorker.addEventListener('message', onMessage);
    function queryStatus() {
      try {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'PA_QUERY_PRECACHE' });
        }
      } catch (e) {}
    }
    if (navigator.serviceWorker.controller) {
      queryStatus();
    } else {
      navigator.serviceWorker.addEventListener('controllerchange', queryStatus);
      navigator.serviceWorker.ready.then(queryStatus).catch(function () {});
    }
  } catch (e) { /* SW no soportado / bloqueado: sin barra, la app funciona igual */ }
})();
