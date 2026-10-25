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

  /* ---- Un solo marco de juego (ver §11 en spec.css) ----
     Los juegos de #34 no tenían banda inferior: se agrega con la barra de
     progreso (calculada del propio tablero: fichas .done / .placed). El de
     las bellotas ya tenía barra. (El botón "repetir" se retiró con las
     voces, ver §13.) */
  var SUPERFICIES = ".pa34-play,.pa34-mplay,.pa34-splay,.pa34-cplay,.pa34-tplay";
  function marco(s) {
    if (!s.__pa63) {
      s.__pa63 = true;
      var bot = s.querySelector(".pa34-pbot");
      if (!bot) {
        bot = document.createElement("div");
        bot.className = "pa63-pbot";
        bot.innerHTML = '<div class="pa63-prog"></div>';
        s.insertBefore(bot, s.querySelector(".pa34-win"));
      }
    }
    var pr = s.querySelector(".pa63-prog");
    if (!pr) return;
    var tot = s.querySelectorAll(".pa34-mcard,.pa34-scard,.pa34-citem").length;
    var hechas = s.querySelectorAll(".pa34-mcard.done,.pa34-scard.done,.pa34-citem.placed").length;
    if (s.classList.contains("pa34-mplay")) { tot = tot / 2; hechas = hechas / 2; }
    if (!tot) { tot = 1; hechas = 0; }
    var clave = hechas + "/" + tot;
    if (pr.getAttribute("data-k") === clave) return;
    pr.setAttribute("data-k", clave);
    pr.innerHTML = "";
    for (var i = 0; i < tot; i++) { var d = document.createElement("i"); if (i < hechas) d.className = "on"; pr.appendChild(d); }
  }
  function marcos() {
    var ss = document.querySelectorAll(SUPERFICIES);
    for (var i = 0; i < ss.length; i++) marco(ss[i]);
  }

  var pendiente = false;
  new MutationObserver(function () {
    if (pendiente) return;
    pendiente = true;
    setTimeout(function () { pendiente = false; sincronizar(); marcos(); }, 80);
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });

  /* ---- Fondo de bosque también en los juegos de las materias nuevas ----
     Los juegos de #34 (Números, Letras, Animales) se juegan sobre el claro
     del bosque de #34/img/bg.css; los 20 juegos de #53–#60 tenían un crema
     liso, y el niño pasaba de un mundo a otro según la materia. En lugar de
     duplicar la imagen embebida, se toma la que ya pintó #34 (mismo archivo,
     ya en caché) y se aplica a las cinco superficies. */
  function fondoBosque() {
    try {
      var sonda = document.createElement("div");
      sonda.className = "pa34-play";
      sonda.style.display = "none";
      document.body.appendChild(sonda);
      var img = getComputedStyle(sonda).backgroundImage;
      sonda.remove();
      if (!img || img === "none") return false;
      var st = document.createElement("style");
      st.id = "pa63bosque";
      st.textContent =
        ".pa53-play,.pa54-play,.pa55-play,.pa58-play,.pa60-play{" +
        "background:" + img + " center/cover no-repeat,#DDEFD6 !important;}";
      document.head.appendChild(st);
      return true;
    } catch (e) { return false; }
  }
  if (!fondoBosque()) {
    var intentos = 0;
    var t = setInterval(function () { if (fondoBosque() || ++intentos > 20) clearInterval(t); }, 500);
  }

  /* ---- El idioma se recuerda ----
     app.js arranca siempre en español (S.lang no se guarda): una familia que
     eligió inglés lo perdía en cada apertura. Se guarda cada cambio (se
     observa el atributo lang de <html>, que applyLang() mantiene al día, así
     vale venga del botón que venga) y al abrir se repone pulsando el mismo
     #langBtn, para que todos los módulos que escuchan ese botón se repinten,
     con la voz silenciada para que no diga "English" al arrancar. */
  var CLAVE_IDIOMA = "pa63_lang";
  try {
    var guardado = localStorage.getItem(CLAVE_IDIOMA);
    var actual = document.documentElement.lang;
    var lb = document.getElementById("langBtn");
    if ((guardado === "en" || guardado === "es") && guardado !== actual && lb) {
      var sonido = (typeof S !== "undefined") ? S.sound : null;
      if (sonido !== null) S.sound = false;
      lb.click();
      if (sonido !== null) S.sound = sonido;
    }
  } catch (e) {}
  new MutationObserver(function () {
    try { localStorage.setItem(CLAVE_IDIOMA, document.documentElement.lang); } catch (e) {}
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  /* ---- §13 · App sin voces (decisión de producto, oct-2026) ----
     Se retiraron los clips de #61/#62 y app.js ya no habla (VOCES=false).
     Este módulo carga el último, así que además deja mudas las dos puertas
     por las que cualquier capa podría hablar: window.speak/speakSeq (que
     AudioBank y otros envuelven) y speechSynthesis.speak. Los sonidos de
     acierto, el ambiente del bosque y la sección Música no son voz y siguen. */
  function mudo() {}
  window.speak = mudo;
  window.speakSeq = mudo;
  try { if (window.speechSynthesis) { window.speechSynthesis.cancel(); window.speechSynthesis.speak = mudo; } } catch (e) {}

  window.PA63 = { capaArriba: capaArriba, sincronizar: sincronizar, marcos: marcos };
})();
