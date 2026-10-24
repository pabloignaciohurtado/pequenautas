"use strict";
/* ===== Fase 4 #63 · Ajustes de coherencia (parte JS): botón atrás =====
   La app no usaba el historial del navegador: history.length valía 1–2 en
   cualquier pantalla, así que el botón atrás de Android (o el del
   navegador) SACABA de la app en medio de un juego. Para un niño de 3 años
   eso es "se cerró el juego".

   Ahora, mientras haya una capa abierta (hoja de sección, mapa de niveles,
   juego, Mapa/Mochila o el juego clásico), se mantiene UNA entrada de
   guarda en el historial. Atrás la consume y cierra la capa de más arriba
   pulsando su propio botón de cerrar o volver, el mismo que tocaría el
   niño, así cada módulo hace su limpieza como siempre. Si después sigue
   habiendo una capa abierta, se vuelve a poner la guarda. En Inicio no hay
   guarda: atrás se comporta como en cualquier app de Android.

   Aditivo: no toca app.js ni los módulos de juego. Solo observa clases y
   pulsa botones que ya existen. */
(function () {
  if (window.__pa63) return; window.__pa63 = true;

  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  }

  /* Capas, de la más alta a la más baja, con el botón que las cierra. */
  var CAPAS = [
    // superficies de juego de las materias nuevas
    { sel: ".pa53-play.show,.pa54-play.show,.pa55-play.show,.pa58-play.show,.pa60-play.show", btn: ".pa34-x" },
    // juegos propios de #34 (se abren a pantalla completa dentro de su overlay)
    { sel: ".pa34-play.show,.pa34-splay.show,.pa34-mplay.show,.pa34-cplay.show,.pa34-tplay.show", btn: ".pa34-x" },
    // Mapa y Mochila (#32)
    { sel: ".pa32-ov", btn: ".pa32-close" },
    // hojas de sección: si está el mapa de niveles, "volver" lleva a la lista
    // de juegos; si no, la × cierra la hoja
    { sel: ".pa34-ov.show,.pa53-ov.show,.pa54-ov.show,.pa55-ov.show,.pa58-ov.show,.pa60-ov.show", btn: ".pa34-back", alt: ".pa34-x" },
    // juego clásico de app.js
    { sel: "#game.active", btn: "#homeBtn", global: true }
  ];

  function capaArriba() {
    for (var i = 0; i < CAPAS.length; i++) {
      var capas = document.querySelectorAll(CAPAS[i].sel);
      for (var j = capas.length - 1; j >= 0; j--) {
        var c = capas[j];
        if (!CAPAS[i].global && !visible(c)) continue;
        var raiz = CAPAS[i].global ? document : c;
        var b = raiz.querySelector(CAPAS[i].btn);
        if (!visible(b) && CAPAS[i].alt) b = raiz.querySelector(CAPAS[i].alt);
        if (b && (CAPAS[i].global || visible(b))) return b;
      }
    }
    return null;
  }

  var guarda = false;      // ¿hay ya una entrada nuestra en el historial?
  var ignorar = 0;         // popstates provocados por nosotros mismos

  function sincronizar() {
    var abierta = !!capaArriba();
    if (abierta && !guarda) {
      try { history.pushState({ pa63: 1 }, ""); guarda = true; } catch (e) {}
    } else if (!abierta && guarda) {
      // se cerró todo con los botones de la app: retirar la guarda para que
      // el siguiente atrás en Inicio no tenga que pulsarse dos veces
      guarda = false;
      ignorar++;
      try { history.back(); } catch (e) { ignorar--; }
    }
  }

  window.addEventListener("popstate", function () {
    if (ignorar > 0) { ignorar--; return; }
    guarda = false;
    var b = capaArriba();
    if (b) b.click();
    setTimeout(sincronizar, 120);
  });

  var pendiente = false;
  new MutationObserver(function () {
    if (pendiente) return;
    pendiente = true;
    setTimeout(function () { pendiente = false; sincronizar(); }, 80);
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });

  window.PA63 = { capaArriba: capaArriba, sincronizar: sincronizar };
})();
