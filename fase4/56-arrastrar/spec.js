/* ===== Fase 4 #56 · Arrastrar y soltar en todas las elecciones =====

   Ignacio pidió que los juegos de "elegir tocando" se jueguen arrastrando o
   desplazando la ficha. Hasta ahora la app tenía tres gestos distintos según
   el juego: toque simple (la mayoría), tocar-origen-y-luego-destino (#34
   clasificar, #53 sombras y colores, #54 rompecabezas y siluetas) y un
   arrastre propio sólo en las bellotas de #34. Esto unifica el gesto.

   DECISIÓN DE ARQUITECTURA: esta capa NO reescribe ningún juego. Sería
   insostenible —hay más de cuarenta rondas repartidas en app.js y once
   módulos, cada una con su estado en una closure— y además app.js es
   intocable por contrato del proyecto. En vez de eso intercepta el gesto en
   `document` y, al soltar, SINTETIZA los toques que el juego ya sabe atender:
     · en los juegos que ya eran de dos toques, dispara click() en el origen
       y luego click() en el destino, que es exactamente la secuencia que el
       módulo espera;
     · en los de elección múltiple sin destino, dispara sólo click() en la
       ficha soltada.
   Así la validación, el progreso, las estrellas y los sonidos siguen
   viviendo donde ya vivían. Ningún juego se puede desincronizar porque
   ninguno cambia.

   DÓNDE SE SUELTA. Cuando el juego ya tiene un destino natural (la canasta,
   la sombra, el hueco del rompecabezas, la casilla "?" del patrón) se usa
   ese. Cuando es elección múltiple pura no se inventa un cajón nuevo dentro
   de la rejilla —eso movería el layout de todas las pantallas y rompería
   tests ajenos—: el destino es EL PROPIO ENUNCIADO, que ya está arriba en
   todas las superficies. "Lleva la respuesta a la pregunta" se entiende sin
   explicación y no cuesta ni un píxel de maquetación.

   EL TOQUE SIGUE FUNCIONANDO. El arrastre no arranca hasta que el dedo se
   mueve más de 10 px; por debajo de eso no tocamos el evento y el click
   nativo ocurre como siempre. Esto no es una concesión técnica: a los tres
   años el arrastre falla a menudo (se pierde el contacto, se sale del
   objetivo) y un fallo motor el niño lo lee como un fallo del juego. El
   arrastre es ahora el gesto principal; el toque queda como red de
   seguridad, y también es lo que mantiene la app usable con teclado o lector
   de pantalla.

   Aditivo: no toca app.js, ni index.html, ni STORE_KEY. */

(function () {
  "use strict";
  if (window.__pa56) return;
  window.__pa56 = true;

  var d = document;

  /* ---------- 1 · Qué se puede arrastrar ---------- */

  /* Fichas de elección de todas las superficies. Se listan por selector y no
     por módulo porque las fichas se recrean en cada ronda: engancharse a los
     nodos no serviría de nada, así que todo va por delegación en document. */
  var ORIGINS = [
    "#stage .choice",
    "#stage .animalBig",
    ".pa34-mcard[data-side='L']",
    ".pa34-scard",
    ".pa34-citem",
    ".pa53-tile",
    ".pa54-piece",
    ".pa54-tile",
    ".pa54-foot",
    ".pa55-tile",
    ".pa55-note",
    ".pa58-tile",
    ".pa58-act"
  ].join(",");

  /* Lo que NUNCA es origen, aunque encaje en la lista de arriba:
     · los destinos (sombras, canastas, huecos) — se sueltan, no se arrastran;
     · la bellota de #34, que ya tiene su propio arrastre a la cesta;
     · el trazo de letras y el sendero SVG, que escuchan el movimiento del
       dedo y se romperían si les robáramos el puntero. */
  var NEVER = [
    ".pa53-tile.pa53-sh",
    ".pa53-tile.pa53-hole",
    ".pa53-bin",
    ".pa54-tile.pa54-sh",
    ".pa54-slot",
    ".pa34-cbin",
    ".pa34-acorn",
    ".pa34-tplay svg *",
    ".pa54-trail svg *"
  ].join(",");

  /* Pares origen → destino que el juego YA tenía. El orden importa: se toma
     la primera regla cuyo origen encaje. */
  var PAIRS = [
    { o: ".pa34-mcard[data-side='L']", t: ".pa34-mcard[data-side='R']" },
    { o: ".pa34-citem", t: ".pa34-cbin" },
    { o: ".pa53-tile.pa53-sm", t: ".pa53-bin" },
    { o: ".pa53-tile[data-k]", t: ".pa53-tile.pa53-sh" },
    { o: ".pa53-tile", t: ".pa53-tile.pa53-hole" },
    { o: ".pa54-piece", t: ".pa54-slot" },
    { o: ".pa54-tile[data-k]", t: ".pa54-tile.pa54-sh" },
    { o: "#stage .animalBig", t: "#stage .choice.habitat,#stage .choice.diet" }
  ];

  /* Raíz de cada superficie de juego y su enunciado. Sirve para dos cosas:
     acotar la búsqueda de destinos a la pantalla activa (hay overlays
     apilados) y saber cuál es el enunciado que hace de buzón. */
  var SURFACES = [
    { root: ".pa34-play", p: "#pa34prompt" },
    { root: ".pa34-mplay", p: "#pa34mprompt" },
    { root: ".pa34-splay", p: "#pa34sprompt" },
    { root: ".pa34-cplay", p: "#pa34cprompt" },
    { root: ".pa53-play", p: "#pa53prompt" },
    { root: ".pa54-play", p: "#pa54prompt" },
    { root: ".pa55-play", p: "#pa55prompt" },
    { root: ".pa58-play", p: "#pa58prompt" },
    { root: "#game", p: "#promptText" }
  ];

  function matches(n, sel) {
    if (!n || n.nodeType !== 1) return false;
    var f = n.matches || n.msMatchesSelector || n.webkitMatchesSelector;
    try { return f ? f.call(n, sel) : false; } catch (e) { return false; }
  }
  function closestSel(n, sel) {
    while (n && n.nodeType === 1) {
      if (matches(n, sel)) return n;
      n = n.parentNode;
    }
    return null;
  }
  function surfaceOf(n) {
    for (var i = 0; i < SURFACES.length; i++) {
      var r = closestSel(n, SURFACES[i].root);
      if (r) return { root: r, prompt: d.querySelector(SURFACES[i].p) };
    }
    return null;
  }
  function pairFor(n) {
    for (var i = 0; i < PAIRS.length; i++) if (matches(n, PAIRS[i].o)) return PAIRS[i];
    return null;
  }
  function visible(n) {
    if (!n) return false;
    var r = n.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  }

  /* ---------- 2 · Estado del arrastre ---------- */

  var S = null;      // arrastre en curso
  var MOVED = 10;    // px antes de considerar que es arrastre y no toque
  var suppress = 0;  // marca de tiempo para tragarse el click posterior

  function targetsFor(origin, surf) {
    var pair = pairFor(origin);
    var list = [];
    if (pair) {
      var scope = surf ? surf.root : d;
      var found = scope.querySelectorAll(pair.t);
      for (var i = 0; i < found.length; i++) {
        if (found[i] !== origin && visible(found[i])) list.push(found[i]);
      }
    }
    /* Sin destino propio (o con los destinos ya llenos): el enunciado hace de
       buzón. Es el mismo nodo en todas las superficies, así que no hay nada
       que maquetar. */
    if (!list.length && surf && surf.prompt && visible(surf.prompt)) {
      list.push(surf.prompt);
      return { list: list, mail: true };
    }
    return { list: list, mail: false };
  }

  function start(origin, ev) {
    var surf = surfaceOf(origin);
    var t = targetsFor(origin, surf);
    if (!t.list.length) return false;

    var r = origin.getBoundingClientRect();
    var ghost = origin.cloneNode(true);
    ghost.className = (origin.className || "") + " pa56-ghost";
    ghost.removeAttribute("id");
    ghost.style.width = r.width + "px";
    ghost.style.height = r.height + "px";
    ghost.style.left = r.left + "px";
    ghost.style.top = r.top + "px";
    d.body.appendChild(ghost);

    S = {
      origin: origin, ghost: ghost, targets: t.list, mail: t.mail,
      dx: ev.clientX - r.left, dy: ev.clientY - r.top, over: null
    };
    origin.classList.add("pa56-lift");
    for (var i = 0; i < t.list.length; i++) {
      t.list[i].classList.add(t.mail ? "pa56-mail" : "pa56-target");
    }
    d.documentElement.classList.add("pa56-dragging");
    return true;
  }

  function hit(x, y) {
    /* elementFromPoint ignora el fantasma porque lleva pointer-events:none.
       Se sube por los padres para que valga soltar sobre el hijo de una
       canasta (el hueco .bslot, la barra de una nota, un emoji dentro). */
    var el = d.elementFromPoint(x, y);
    while (el && el.nodeType === 1) {
      for (var i = 0; i < S.targets.length; i++) if (S.targets[i] === el) return el;
      el = el.parentNode;
    }
    return null;
  }

  function move(ev) {
    if (!S) return;
    S.ghost.style.transform =
      "translate(" + (ev.clientX - S.dx - parseFloat(S.ghost.style.left)) + "px," +
      (ev.clientY - S.dy - parseFloat(S.ghost.style.top)) + "px)";
    var over = hit(ev.clientX, ev.clientY);
    if (over !== S.over) {
      if (S.over) S.over.classList.remove("pa56-over");
      if (over) over.classList.add("pa56-over");
      S.over = over;
    }
  }

  function cleanup() {
    if (!S) return null;
    var s = S;
    S = null;
    if (s.ghost && s.ghost.parentNode) s.ghost.parentNode.removeChild(s.ghost);
    s.origin.classList.remove("pa56-lift");
    for (var i = 0; i < s.targets.length; i++) {
      s.targets[i].classList.remove("pa56-target", "pa56-mail", "pa56-over");
    }
    d.documentElement.classList.remove("pa56-dragging");
    return s;
  }

  function drop(ev) {
    if (!S) return;
    var over = hit(ev.clientX, ev.clientY);
    var s = cleanup();
    suppress = Date.now();
    if (!over) return; // soltado en el aire: no cuenta como respuesta
    /* Los juegos de dos toques necesitan la selección antes del destino;
       los de buzón sólo necesitan la ficha. Si el destino ES la ficha (puede
       pasar en el patrón), un solo click basta. */
    try {
      if (s.mail || over === s.origin) {
        s.origin.click();
      } else {
        s.origin.click();
        over.click();
      }
    } catch (e) {}
  }

  /* ---------- 3 · Enganche por delegación ---------- */

  var press = null;

  function onDown(ev) {
    if (S || ev.button > 0) return;
    var n = ev.target;
    if (closestSel(n, NEVER)) return;
    var origin = closestSel(n, ORIGINS);
    if (!origin || matches(origin, NEVER)) return;
    if (origin.disabled) return;
    press = { origin: origin, x: ev.clientX, y: ev.clientY, id: ev.pointerId };
  }

  function onMove(ev) {
    if (S) { ev.preventDefault(); move(ev); return; }
    if (!press) return;
    var dx = ev.clientX - press.x, dy = ev.clientY - press.y;
    if (dx * dx + dy * dy < MOVED * MOVED) return;
    if (start(press.origin, ev)) {
      ev.preventDefault();
      move(ev);
    } else {
      press = null; // sin destino posible: que siga siendo un toque normal
    }
  }

  function onUp(ev) {
    press = null;
    if (!S) return;
    ev.preventDefault();
    drop(ev);
  }

  function onCancel() {
    press = null;
    cleanup();
  }

  /* El click sintético que disparamos nosotros pasa por aquí también, pero
     lleva menos de un tick de diferencia con el drop y el guard lo distingue
     del click "de verdad" del navegador tras el pointerup, que es el que hay
     que tragarse para no responder dos veces. */
  function onClick(ev) {
    if (!suppress) return;
    if (Date.now() - suppress > 400) { suppress = 0; return; }
    if (ev.isTrusted) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }

  if (window.PointerEvent) {
    d.addEventListener("pointerdown", onDown, true);
    d.addEventListener("pointermove", onMove, { passive: false, capture: true });
    d.addEventListener("pointerup", onUp, true);
    d.addEventListener("pointercancel", onCancel, true);
    d.addEventListener("click", onClick, true);
    d.documentElement.classList.add("pa56");
  }

  /* Nada más: no hay pantallas propias, no hay almacenamiento, no hay
     temporizadores. Si este módulo no carga, la app se queda exactamente
     como estaba —todo se sigue jugando a toques— que es la degradación
     elegante que queremos en una capa de gesto. */
})();
