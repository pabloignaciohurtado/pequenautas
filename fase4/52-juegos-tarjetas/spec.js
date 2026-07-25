/* ===== Fase 4 #52 · Tarjetas de "Elige un juego" (activador) =====

   El rediseño entero vive en spec.css y se engancha al atributo
   data-pa34-game que #34 ya estampa en cada botón, así que aquí no hay
   ninguna manipulación del DOM de las tarjetas: este archivo solo enciende
   el módulo y garantiza la fuente de titulares.

   Por qué la clase: toda la hoja cuelga de html.pa52. Si este script no
   llega a cargar (o falla), la pantalla de juegos se ve exactamente como la
   dejaba #34 en vez de quedar a medio estilar.

   Aditivo: no toca app.js, ni index.html, ni STORE_KEY, ni #34. */
(function () {
  "use strict";
  if (window.__pa52) return;
  window.__pa52 = true;

  var d = document;
  var root = d.documentElement;

  // La fuente de titulares la trae #51, que es crítico y carga antes. Se
  // vuelve a pedir aquí solo por si #51 no estuviera presente: el navegador
  // deduplica la petición y el atributo evita inyectar el link dos veces.
  if (!d.querySelector("link[data-pa51font], link[data-pa52font]")) {
    var l = d.createElement("link");
    l.rel = "stylesheet";
    l.setAttribute("data-pa52font", "1");
    l.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&display=swap";
    (d.head || root).appendChild(l);
  }

  root.classList.add("pa52");
})();
