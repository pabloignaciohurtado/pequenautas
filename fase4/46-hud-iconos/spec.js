/* Fase 4 #46 - Iconos del HUD.
   Todo el arte se aplica desde spec.css. Lo unico que necesita JS es el
   boton de sonido: app.js le cambia el textContent entre altavoz y mute,
   y CSS no puede seleccionar por texto. Observamos el nodo y marcamos
   una clase. Aditivo: no se modifica app.js ni index.html. */
(function () {
  "use strict";

  function wire() {
    var b = document.getElementById("soundBtn");
    if (!b) return false;

    function sync() {
      var t = b.textContent || "";
      b.classList.toggle("pa46-mute", t.indexOf("🔇") >= 0);
    }

    try {
      new MutationObserver(sync).observe(b, {
        childList: true,
        characterData: true,
        subtree: true
      });
    } catch (e) {}

    sync();
    return true;
  }

  if (!wire()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", wire, { once: true });
    } else {
      setTimeout(wire, 0);
    }
  }
})();
