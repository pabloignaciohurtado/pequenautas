/* Fase 4 #51 - Hero limpio: título de portada, Rufo suelto y globo de cómic.

   Este módulo es casi todo CSS (ver spec.css). El spec.js hace solo tres
   cosas, y ninguna toca app.js, index.html ni STORE_KEY:

   1. Inyecta la webfont Baloo 2 (600/800). Es la tipografía de portada:
      más redonda y con más peso que la Fredoka de la interfaz, para que el
      título "Aventuras en el Bosque" lea como título de cuento y no como
      una etiqueta más. sw.js ya cachea fonts.googleapis/fonts.gstatic con
      estrategia cache-first, así que en la segunda visita entra offline.

   2. Marca <html class="pa51">. TODA la hoja de estilos cuelga de esa
      clase: si el módulo no llega a cargar (red, error, orden), el hero de
      #33 sigue viéndose exactamente como antes en vez de quedar a medias.

   3. Espera a que #33 haya construido .pa33-hero. #33 inyecta su hero en
      cuanto encuentra #home .hero, pero puede hacerlo después que nosotros
      (el orden dentro de la fase crítica no garantiza que su DOM ya exista
      cuando corre este script). En vez de asumirlo, se observa el DOM y se
      pone la clase apenas aparece — con un tope de tiempo para no dejar un
      observer vivo para siempre. */
(function () {
  "use strict";
  if (window.__pa51) return; window.__pa51 = true;

  var FONT_HREF = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&display=swap';

  function injectFont() {
    try {
      if (document.querySelector('link[data-pa51font]')) return;
      var pre = document.createElement('link');
      pre.rel = 'preconnect'; pre.href = 'https://fonts.gstatic.com';
      pre.crossOrigin = 'anonymous';
      (document.head || document.documentElement).appendChild(pre);
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = FONT_HREF;
      l.setAttribute('data-pa51font', '1');
      // Si la fuente no carga (offline en primera visita, red caída), el
      // stack de respaldo de spec.css es 'Fredoka', system-ui: el hero se
      // ve bien igual, solo con menos personalidad.
      (document.head || document.documentElement).appendChild(l);
    } catch (e) {}
  }

  function activate() {
    if (document.documentElement) document.documentElement.classList.add('pa51');
  }

  function ready() {
    injectFont();
    // Si el hero de #33 ya está, activamos de inmediato.
    if (document.querySelector('.pa33-hero')) { activate(); return; }

    var done = false;
    var obs = null;
    var cap = null;
    function finish() {
      if (done) return; done = true;
      if (obs) { try { obs.disconnect(); } catch (e) {} }
      if (cap) clearTimeout(cap);
      activate();
    }
    if (window.MutationObserver) {
      obs = new MutationObserver(function () {
        if (document.querySelector('.pa33-hero')) finish();
      });
      try {
        obs.observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) { finish(); return; }
      // Tope: si a los 6s no apareció el hero de #33, activamos igual. Las
      // reglas del título y del globo son útiles por sí solas y las del
      // zorro simplemente no encuentran a quién aplicarse.
      cap = setTimeout(finish, 6000);
    } else {
      finish();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
