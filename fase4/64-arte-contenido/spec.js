"use strict";
/* ===== Fase 4 #64 · Arte de Grok en lugar de emoji del sistema =====
   Auditoría de coherencia (oct-2026): todo el arte de la app es papercraft
   de Grok, pero el CONTENIDO de varios juegos seguía siendo emoji del
   teléfono (y cambia de dibujo según la marca): los objetos a contar y los
   animales de "Dónde vive" del juego clásico, los animales y casas de "Cada
   uno a su casa", los instrumentos y botones de Música y las situaciones de
   Emociones. Con #58 quedó claro el costo: el niño compara dos dibujos de
   estilos distintos y el juego "no hace sentido".

   Aditivo, como el resto de fase4: no toca los motores de juego. Observa
   las zonas de juego y cambia cada emoji conocido por un <span class="pa64">
   con su dibujo (las 44 piezas nuevas de img/, más las que ya existían en
   #49 y #34 para que un mismo animal se vea igual en todos los juegos). Los
   motores no leen el texto de las fichas (usan referencias, ids o data-*),
   así que la lógica no cambia. Solo se tocan las zonas de juego y el
   marcador de estrellas de cada juego. */
(function () {
  if (window.__pa64) return; window.__pa64 = true;

  function v(n) { return "var(--pa64-" + n + ")"; }
  var P49 = function (n) { return "var(--pa49-" + n + ")"; };
  var P34 = function (n) { return "var(--pa34-" + n + ")"; };

  /* emoji (sin selector de variación) → dibujo. */
  var ARTE = {
    "\u{1F98B}": v("butterfly"), "\u{1F422}": v("turtle"), "\u{1F42C}": v("dolphin"),
    "\u{1F433}": v("whale"), "\u{1F981}": v("lion"), "\u{1F41D}": v("bee"),
    "\u{1F985}": v("eagle"), "\u{1F426}": v("bird"), "\u{1F980}": v("crab"),
    "\u{1F989}": v("owl"), "\u{1F986}": v("duck"), "\u{1F41F}": P49("fish"),
    "\u{1F420}": v("clownfish"), "\u{1F34E}": v("apple"), "\u{1F34C}": v("banana"),
    "⭐": v("star"), "\u{1F338}": v("blossom"), "\u{1F33B}": v("sunflower"),
    "\u{1F344}": v("mushroom"), "\u{1F33F}": v("sprig"), "\u{1F4A7}": v("drop"),
    "☁": v("cloud"), "\u{1F30A}": v("wave"), "\u{1F308}": v("rainbow"),
    "⛈": v("storm"), "\u{1F941}": v("drum"), "\u{1F514}": v("bell"),
    "\u{1FA87}": v("maracas"), "\u{1F3B9}": v("xylophone"), "\u{1F382}": v("cake"),
    "\u{1F9F8}": v("teddy"), "\u{1F9F1}": v("blocks"), "\u{1F381}": v("gift"),
    "\u{1F366}": v("icecream"), "\u{1F4D6}": v("book"), "\u{1F6B2}": v("bike"),
    "\u{1F3AF}": v("boardgame"), "\u{1F6CC}": v("hammock"), "\u{1F311}": v("night"),
    "\u{1F917}": v("hug"), "\u{1FAA9}": v("table"),
    // los que ya tenían dibujo en otro módulo: mismo animal, mismo dibujo
    "\u{1F333}": P49("tree"), "\u{1F43B}": P49("bear"), "\u{1F419}": P49("octopus"),
    "\u{1F418}": P34("sz-elephant"), "\u{1F436}": P34("sz-dog"), "\u{1F415}": P34("sz-dog"),
    "\u{1F431}": P34("sz-cat"), "\u{1F408}": P34("sz-cat"), "\u{1F430}": P34("sz-rabbit"),
    "\u{1F407}": P34("sz-rabbit"), "\u{1F425}": P34("an-chick"), "⚽": P49("ball"),
    "☀": P49("sun"), "\u{1F319}": P49("moon")
  };
  /* Algunos emoji significan otra cosa según el juego. */
  var POR_ZONA = [
    // Música: 🎶 era la "flauta"; los altavoces de Fuerte/Suave pasan a
    // león rugiendo y ratón dormido, la misma lógica de imagen que oso/pájaro
    // en Agudo o grave.
    { sel: ".pa55-play", map: { "\u{1F3B6}": v("flute"), "\u{1F50A}": v("roar"), "\u{1F508}": v("sleep") } },
    // Emociones: 🌿 es "regar el huerto", no una ramita
    { sel: ".pa58-play", map: { "\u{1F33F}": v("garden") } }
  ];
  /* emoji que sobran (el dibujo ya está al lado o el texto se basta) */
  var QUITAR = { "\u{1F330}": true }; // 🌰 en "Arrastra 3 bellotas 🌰 a la canasta"

  // [class*=pstar]: la ⭐ del marcador de cada juego pasa a la estrella de
  // Grok, la misma que el contador de la barra de inicio (#46).
  var ZONAS = "#stage,#promptText,.pa34-mplay .pa34-mcols,.pa34-splay,.pa34-cplay,.pa34-ptop .pa34-prompt," +
    ".pa55-field,.pa55-pads,.pa58-field,[class*=pstar]";
  var FUERA = ".pa64,script,style";

  var claves = Object.keys(ARTE).concat(Object.keys(QUITAR));
  POR_ZONA.forEach(function (z) { claves = claves.concat(Object.keys(z.map)); });
  claves = claves.filter(function (k, i) { return claves.indexOf(k) === i; })
    .sort(function (a, b) { return b.length - a.length; });
  var RE = new RegExp("(" + claves.map(function (k) {
    return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("|") + ")️?", "gu");

  function arteDe(em, nodo) {
    for (var i = 0; i < POR_ZONA.length; i++) {
      if (POR_ZONA[i].map[em] && nodo.closest && nodo.closest(POR_ZONA[i].sel)) return POR_ZONA[i].map[em];
    }
    return ARTE[em] || null;
  }

  function cambiar(texto) {
    var s = texto.nodeValue;
    RE.lastIndex = 0;
    if (!RE.test(s)) return;
    RE.lastIndex = 0;
    var padre = texto.parentNode;
    var frag = document.createDocumentFragment(), ult = 0, m;
    while ((m = RE.exec(s))) {
      var em = m[1];
      var arte = QUITAR[em] ? "" : arteDe(em, padre);
      if (arte === null) continue;
      if (m.index > ult) frag.appendChild(document.createTextNode(s.slice(ult, m.index)));
      if (arte) {
        var sp = document.createElement("span");
        sp.className = "pa64";
        sp.setAttribute("role", "img");
        sp.setAttribute("aria-label", em);
        sp.style.backgroundImage = arte;
        frag.appendChild(sp);
      }
      ult = m.index + m[0].length;
    }
    if (ult === 0) return;
    if (ult < s.length) frag.appendChild(document.createTextNode(s.slice(ult)));
    padre.replaceChild(frag, texto);
  }

  function barrer() {
    var zonas = document.querySelectorAll(ZONAS);
    var letras = !!document.querySelector("#stage .lettertile");
    for (var z = 0; z < zonas.length; z++) {
      var w = document.createTreeWalker(zonas[z], NodeFilter.SHOW_TEXT, null);
      var lista = [], n;
      while ((n = w.nextNode())) {
        if (n.parentNode && n.parentNode.closest && n.parentNode.closest(FUERA)) continue;
        // el quiz de letras ya tiene su arte (#49), que se elige leyendo el emoji
        if (letras && n.parentNode.closest && n.parentNode.closest("#stage .choice")) continue;
        lista.push(n);
      }
      for (var i = 0; i < lista.length; i++) cambiar(lista[i]);
    }
  }

  var pend = false;
  function programar() {
    if (pend) return; pend = true;
    (window.requestAnimationFrame || setTimeout)(function () { pend = false; barrer(); });
  }
  new MutationObserver(programar).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  barrer();

  window.PA64 = { barrer: barrer, arte: ARTE };
})();
