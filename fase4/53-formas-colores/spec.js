/* ===== Fase 4 #53 · Sección "Formas y Colores" =====

   La app tenía tres secciones (Números, Letras, Animales) y doce juegos.
   Este módulo añade una CUARTA sección completa —formas, colores y
   patrones— con cuatro juegos de cinco niveles cada uno, sin tocar una
   sola línea de #34.

   Por qué puede hacerlo sin extender #34: #34 encierra su registro de
   secciones en una IIFE y no expone nada, pero su listener de captura
   sobre .subject solo intercepta cuando SECTIONS[key] existe. Una tarjeta
   con data-game="shapes" le resulta desconocida y la deja pasar intacta.
   app.js, por su parte, engancha las .subject UNA vez al cargar, así que
   una tarjeta inyectada después tampoco recibe su handler. El hueco es
   limpio: esta sección es nuestra por completo.

   Overlay propio (.pa53-ov, no .pa34-ov): #40 hace
   document.querySelector(".pa34-ov") y se quedaría con el primero de los
   dos. Por dentro sí reutilizamos las clases .pa34-sheet/.pa34-hd/
   .pa34-games/.pa34-game y estampamos data-pa34-game, de modo que el
   rediseño papercraft de #52 se aplica gratis a estos cuatro juegos.

   Las formas y los colores se dibujan como SVG en línea, no como imagen:
   un círculo tiene que verse nítido a cualquier densidad de pantalla, y
   además el color es el CONTENIDO del juego —tiene que ser exacto y
   nombrable, no una aproximación de un WebP recomprimido.

   Aditivo: no toca app.js, ni index.html, ni STORE_KEY. Progreso propio en
   clave separada. Si este módulo no carga, la app se ve como antes: la
   cuarta tarjeta simplemente no existe. */
(function () {
  "use strict";
  if (window.__pa53) return;
  window.__pa53 = true;

  var PKEY = "pequenautas.f4.formas.v1";
  function loadP() { try { return JSON.parse(localStorage.getItem(PKEY) || "{}") || {}; } catch (e) { return {}; } }
  function saveP(o) { try { localStorage.setItem(PKEY, JSON.stringify(o)); } catch (e) {} }
  function unlocked(gid) { var p = loadP(); return (typeof p[gid] === "number") ? p[gid] : 0; }
  function setUnlocked(gid, v) { var p = loadP(); if (!(p[gid] >= v)) { p[gid] = v; saveP(p); } }

  var d = document;
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) { var b = a.slice(), i, j, t; for (i = b.length - 1; i > 0; i--) { j = rnd(i + 1); t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
  function sample(a, n) { return shuffle(a).slice(0, n); }

  /* ---------- idioma ----------
     S.lang vive en un const de módulo de app.js, inalcanzable desde aquí.
     Se deduce del texto de la etiqueta que app.js sí traduce, y se
     re-sincroniza cuando el peque toca el botón de idioma. */
  var lang = "es";
  function detectLang() {
    var n = d.getElementById("lblRead");
    lang = (n && /letter/i.test(n.textContent || "")) ? "en" : "es";
    return lang;
  }
  function T(es, en) { return lang === "en" ? en : es; }
  function say(txt) {
    try { if (typeof window.speak === "function") window.speak(txt, { lang: lang }); } catch (e) {}
  }
  function star() { try { if (typeof window.addStar === "function") window.addStar(); } catch (e) {} }

  /* ---------- vocabulario ---------- */
  var SHAPES = {
    circle: { es: "círculo", en: "circle" },
    square: { es: "cuadrado", en: "square" },
    triangle: { es: "triángulo", en: "triangle" },
    star: { es: "estrella", en: "star" },
    heart: { es: "corazón", en: "heart" },
    rect: { es: "rectángulo", en: "rectangle" },
    oval: { es: "óvalo", en: "oval" },
    diamond: { es: "rombo", en: "diamond" },
    hexagon: { es: "hexágono", en: "hexagon" }
  };
  // Por nivel: cuántas formas entran en juego. Empieza por las tres que
  // un peque de 3 años ya distingue y va sumando de a poco.
  var SHAPE_STEPS = [
    ["circle", "square", "triangle"],
    ["circle", "square", "triangle", "star"],
    ["circle", "square", "triangle", "star", "heart"],
    ["circle", "square", "triangle", "star", "heart", "rect", "oval"],
    ["circle", "square", "triangle", "star", "heart", "rect", "oval", "diamond", "hexagon"]
  ];

  var COLORS = {
    red: { es: "rojo", en: "red", hex: "#D8452F" },
    blue: { es: "azul", en: "blue", hex: "#2F76C4" },
    yellow: { es: "amarillo", en: "yellow", hex: "#E8B22C" },
    green: { es: "verde", en: "green", hex: "#4FA05C" },
    orange: { es: "naranja", en: "orange", hex: "#E07A2C" },
    purple: { es: "morado", en: "purple", hex: "#8A5BB0" }
  };
  var COLOR_STEPS = [
    ["red", "blue"],
    ["red", "blue", "yellow"],
    ["red", "blue", "yellow", "green"],
    ["red", "blue", "yellow", "green", "orange"],
    ["red", "blue", "yellow", "green", "orange", "purple"]
  ];

  var PAPER = "#FFFCF2";
  var INK = "#2E3B2C";

  /* ---------- dibujo ----------
     Un solo generador para todo el módulo: la misma figura se usa como
     ficha de juego, como sombra gris y como icono dentro de la canasta,
     cambiando solo el relleno. */
  function shapePath(kind, fill, stroke) {
    var s = stroke || "rgba(46,59,44,.28)";
    var common = 'fill="' + fill + '" stroke="' + s + '" stroke-width="3" stroke-linejoin="round"';
    switch (kind) {
      case "circle": return '<circle cx="50" cy="50" r="38" ' + common + '/>';
      case "square": return '<rect x="14" y="14" width="72" height="72" rx="7" ' + common + '/>';
      case "triangle": return '<polygon points="50,12 88,84 12,84" ' + common + '/>';
      case "star": return '<polygon points="50,8 61,38 93,38 67,57 77,88 50,69 23,88 33,57 7,38 39,38" ' + common + '/>';
      case "heart": return '<path d="M50 88 C14 62 10 38 26 26 C38 17 50 26 50 36 C50 26 62 17 74 26 C90 38 86 62 50 88 Z" ' + common + '/>';
      case "rect": return '<rect x="8" y="28" width="84" height="44" rx="7" ' + common + '/>';
      case "oval": return '<ellipse cx="50" cy="50" rx="42" ry="28" ' + common + '/>';
      case "diamond": return '<polygon points="50,8 90,50 50,92 10,50" ' + common + '/>';
      case "hexagon": return '<polygon points="50,8 88,29 88,71 50,92 12,71 12,29" ' + common + '/>';
    }
    return "";
  }
  function shapeSVG(kind, fill, stroke) {
    return '<svg viewBox="0 0 100 100" class="pa53-svg" aria-hidden="true">' + shapePath(kind, fill, stroke) + "</svg>";
  }
  function shadowSVG(kind) {
    return '<svg viewBox="0 0 100 100" class="pa53-svg pa53-shadow" aria-hidden="true">' + shapePath(kind, "#9AA39B", "rgba(46,59,44,.22)") + "</svg>";
  }
  // Canasta de papel teñida del color del bin (reutiliza el lenguaje del
  // resto de la app: las cosas se guardan en canastas).
  function basketSVG(hex) {
    return '<svg viewBox="0 0 200 170" class="pa53-basket-svg" aria-hidden="true">' +
      '<ellipse cx="100" cy="52" rx="84" ry="26" fill="' + hex + '" opacity=".85"/>' +
      '<path d="M20 54 L37 152 Q100 172 163 152 L180 54 Q100 86 20 54 Z" fill="' + hex + '"/>' +
      '<g stroke="rgba(0,0,0,.22)" stroke-width="4" fill="none">' +
      '<path d="M40 68 L54 150"/><path d="M70 76 L78 158"/><path d="M100 80 L100 162"/>' +
      '<path d="M130 76 L122 158"/><path d="M160 68 L146 150"/>' +
      '<path d="M27 94 Q100 110 173 94"/><path d="M31 122 Q100 140 169 122"/></g></svg>';
  }

  /* ---------- registro de juegos ---------- */
  var GAMES = [
    { id: "shape:tap", kind: "pick", es: "¿Cuál es esta forma?", en: "Which shape is it?",
      des: "Escucha y toca la forma", den: "Listen and tap the shape", mech: "tap" },
    { id: "shape:match", kind: "match", es: "Cada forma a su sombra", en: "Match shape and shadow",
      des: "Une la forma con su sombra", den: "Match each shape to its shadow", mech: "match" },
    { id: "color:classify", kind: "bins", es: "Cada cosa a su color", en: "Sort by colour",
      des: "Guarda cada figura en su canasta", den: "Put each piece in its basket", mech: "drag" },
    { id: "pattern:tap", kind: "pattern", es: "¿Qué sigue?", en: "What comes next?",
      des: "Mira el patrón y elige", den: "Look at the pattern and choose", mech: "sort" }
  ];
  function gName(g) { return lang === "en" ? g.en : g.es; }
  function gDesc(g) { return lang === "en" ? g.den : g.des; }
  function mechEmoji(m) {
    if (m === "tap") return String.fromCodePoint(0x1F446);
    if (m === "drag") return String.fromCodePoint(0x270B);
    if (m === "sort") return String.fromCodePoint(0x2195, 0xFE0F);
    if (m === "match") return String.fromCodePoint(0x1F517);
    return "";
  }

  /* ---------- tarjeta del home ---------- */
  function ensureCard() {
    var cards = d.querySelector("#home .cards");
    if (!cards || d.getElementById("pa53Card")) return;
    var b = el("button", "subject pa53-card");
    b.id = "pa53Card";
    b.setAttribute("data-game", "shapes");
    b.innerHTML = '<span class="blob"></span><span class="lv" id="pa53Lv"></span>' +
      '<span class="emoji">🔷</span><span class="label" id="pa53Label"></span>';
    b.addEventListener("click", function () { detectLang(); openGames(); });
    cards.appendChild(b);
    paintCard();
  }
  function paintCard() {
    var lb = d.getElementById("pa53Label"), lv = d.getElementById("pa53Lv");
    if (lb) lb.textContent = T("Formas", "Shapes");
    if (lv) {
      var tot = 0, i;
      for (i = 0; i < GAMES.length; i++) tot += unlocked(GAMES[i].id);
      lv.textContent = T("Nivel ", "Level ") + (Math.floor(tot / GAMES.length) + 1);
    }
  }

  /* ---------- overlay ---------- */
  var ov = null, hdT = null, body = null, backBtn = null;
  function ensureOv() {
    if (ov) return;
    ov = el("div", "pa53-ov");
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    var sheet = el("div", "pa34-sheet pa53-sheet");
    var hd = el("div", "pa34-hd");
    backBtn = el("button", "pa34-back", "&lsaquo;");
    backBtn.setAttribute("aria-label", T("Volver", "Back"));
    backBtn.style.display = "none";
    hdT = el("div", "t", "");
    var x = el("button", "pa34-x", "&times;");
    x.setAttribute("aria-label", T("Cerrar", "Close"));
    hd.appendChild(backBtn); hd.appendChild(hdT); hd.appendChild(x);
    body = el("div", "pa34-body");
    sheet.appendChild(hd); sheet.appendChild(body); ov.appendChild(sheet);
    d.body.appendChild(ov);
    x.addEventListener("click", closeOv);
    ov.addEventListener("click", function (e) { if (e.target === ov) closeOv(); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { if (play && play.classList.contains("show")) exitPlay(); else if (ov.classList.contains("show")) closeOv(); }
    });
  }
  function closeOv() { if (ov) ov.classList.remove("show"); paintCard(); }
  function openOv() { ensureOv(); ov.classList.add("show"); }

  function openGames() {
    openOv();
    backBtn.style.display = "none";
    hdT.innerHTML = T("Formas y Colores", "Shapes &amp; Colours") +
      "<small>" + T("Elige un juego", "Choose a game") + "</small>";
    body.innerHTML = "";
    var grid = el("div", "pa34-games pa53-games");
    GAMES.forEach(function (g) {
      var b = el("button", "pa34-game");
      b.setAttribute("data-pa34-game", g.id);
      b.appendChild(el("div", "pa34-m-" + g.mech + " mech", mechEmoji(g.mech)));
      b.appendChild(el("div", "gn", gName(g)));
      b.appendChild(el("div", "gp", T("Nivel ", "Level ") + (unlocked(g.id) + 1) + T(" de 5", " of 5")));
      b.addEventListener("click", function () { openLevels(g); });
      grid.appendChild(b);
    });
    body.appendChild(grid);
  }

  function openLevels(g) {
    openOv();
    backBtn.style.display = "";
    backBtn.onclick = function () { openGames(); };
    hdT.innerHTML = gName(g) + "<small>" + T("Elige un nivel", "Choose a level") + "</small>";
    body.innerHTML = "";
    var u = unlocked(g.id);
    var wrap = el("div", "pa34-levels");
    var caps = lang === "en"
      ? ["Very easy", "Easy", "Normal", "A challenge", "Expert"]
      : ["Muy fácil", "Fácil", "Normal", "Un reto", "Experto"];
    for (var i = 0; i < 5; i++) {
      (function (i) {
        if (i > 0) wrap.appendChild(el("div", "pa34-link"));
        var row = el("div", "pa34-lvlwrap");
        var state = i < u ? "done" : (i === u ? "cur" : "lock");
        var b = el("button", "pa34-lvl " + state, String(i + 1));
        if (state === "lock") { b.innerHTML = String.fromCodePoint(0x1F512); b.disabled = true; }
        else { b.addEventListener("click", function () { launch(g, i); }); }
        if (state === "done") b.appendChild(el("span", "st", String.fromCodePoint(0x2B50)));
        var cap = el("div", "cap", caps[i]);
        if (i % 2 === 0) { row.appendChild(b); row.appendChild(cap); }
        else { row.appendChild(cap); row.appendChild(b); }
        wrap.appendChild(row);
      })(i);
    }
    body.appendChild(wrap);
  }

  /* ---------- superficie de juego ----------
     Una sola superficie para las cuatro mecánicas: cabecera con salir y
     estrellas, un enunciado, el campo, y la pantalla de victoria. Cambia
     lo que se pinta dentro del campo, no el marco. */
  var play = null, P = {}, G = null;
  function ensurePlay() {
    if (play) return;
    play = el("div", "pa53-play");
    play.innerHTML =
      '<div class="pa53-ptop"><button class="pa34-x" id="pa53pX" aria-label="Salir">&times;</button>' +
      '<div class="pa53-prompt" id="pa53prompt"></div>' +
      '<div class="pa53-pstar">' + String.fromCodePoint(0x2B50) + ' <span id="pa53score">0</span></div></div>' +
      '<div class="pa53-field" id="pa53field"></div>' +
      '<div class="pa53-pbot"><div class="pa53-prog" id="pa53prog"></div>' +
      '<button class="pa53-cta" id="pa53replay">🔊</button></div>' +
      '<div class="pa53-win" id="pa53win"><div class="pa53-wc">' +
      '<div class="rf">' + shapeSVG("star", "#E8B22C") + '</div>' +
      '<h2 id="pa53wt"></h2><p id="pa53wp"></p>' +
      '<div class="row"><button class="pa53-cta ghost" id="pa53wmap"></button>' +
      '<button class="pa53-cta" id="pa53wnext"></button></div></div></div>';
    d.body.appendChild(play);
    P = {
      field: d.getElementById("pa53field"), prompt: d.getElementById("pa53prompt"),
      prog: d.getElementById("pa53prog"), score: d.getElementById("pa53score"),
      win: d.getElementById("pa53win"), wt: d.getElementById("pa53wt"),
      wp: d.getElementById("pa53wp"), wnext: d.getElementById("pa53wnext"),
      wmap: d.getElementById("pa53wmap"), replay: d.getElementById("pa53replay")
    };
    d.getElementById("pa53pX").addEventListener("click", exitPlay);
    P.replay.addEventListener("click", function () { if (G && G.prompt) say(G.prompt); });
    P.wmap.addEventListener("click", function () { exitPlay(); openLevels(G.g); });
    P.wnext.addEventListener("click", function () {
      var nx = G.level + 1;
      if (nx < 5) { launch(G.g, nx); } else { exitPlay(); openLevels(G.g); }
    });
  }
  function exitPlay() { if (play) play.classList.remove("show"); P.win.classList.remove("show"); }
  function openPlay() { ensurePlay(); play.classList.add("show"); P.win.classList.remove("show"); }

  function setPrompt(txt, speakIt) {
    G.prompt = txt;
    P.prompt.textContent = txt;
    if (speakIt !== false) say(txt);
  }
  function setProg() {
    P.prog.innerHTML = "";
    for (var i = 0; i < G.total; i++) {
      P.prog.appendChild(el("i", i < G.done ? "on" : null));
    }
  }
  function good(node) {
    if (node) node.classList.add("pa53-ok");
    G.score++; P.score.textContent = G.score;
  }
  function bad(node) {
    if (!node) return;
    node.classList.add("pa53-no");
    setTimeout(function () { node.classList.remove("pa53-no"); }, 480);
  }
  function stepDone() {
    G.done++; setProg();
    if (G.done >= G.total) setTimeout(winLevel, 520);
  }
  function winLevel() {
    setUnlocked(G.g.id, Math.min(4, G.level + 1));
    star();
    P.wt.textContent = T("¡Muy bien!", "Great job!");
    P.wp.textContent = G.level < 4
      ? T("Completaste el nivel " + (G.level + 1), "You finished level " + (G.level + 1))
      : T("¡Terminaste todos los niveles!", "You finished every level!");
    P.wmap.textContent = T("Mapa", "Map");
    P.wnext.textContent = G.level < 4 ? T("Siguiente", "Next") : T("Mapa", "Map");
    P.win.classList.add("show");
    say(T("¡Muy bien!", "Great job!"));
  }

  /* ---------- las cuatro mecánicas ---------- */
  function launch(g, level) {
    detectLang();
    closeOv();
    openPlay();
    G = { g: g, level: level, score: 0, done: 0, total: 0, prompt: "" };
    P.score.textContent = "0";
    P.field.innerHTML = "";
    if (g.kind === "pick") roundPick();
    else if (g.kind === "match") roundMatch();
    else if (g.kind === "bins") roundBins();
    else roundPattern();
  }

  // 1 · "¿Cuál es esta forma?" — enunciado hablado + rejilla de opciones.
  function roundPick() {
    G.total = 4; setProg();
    var pool = SHAPE_STEPS[G.level];
    var opts = 3 + Math.min(3, G.level);
    nextPick();
    function nextPick() {
      P.field.innerHTML = "";
      var picks = sample(pool, Math.min(opts, pool.length));
      var target = picks[rnd(picks.length)];
      var colors = shuffle(Object.keys(COLORS));
      setPrompt(T("¿Cuál es el " + SHAPES[target].es + "?", "Which one is the " + SHAPES[target].en + "?"));
      var grid = el("div", "pa53-grid");
      picks.forEach(function (k, i) {
        var t = el("button", "pa53-tile", shapeSVG(k, COLORS[colors[i % colors.length]].hex));
        t.setAttribute("aria-label", lang === "en" ? SHAPES[k].en : SHAPES[k].es);
        t.addEventListener("click", function () {
          if (t.classList.contains("pa53-ok")) return;
          if (k === target) { good(t); say(lang === "en" ? SHAPES[k].en : SHAPES[k].es); stepDone(); if (G.done < G.total) setTimeout(nextPick, 700); }
          else { bad(t); }
        });
        grid.appendChild(t);
      });
      P.field.appendChild(grid);
    }
  }

  // 2 · Forma y sombra — toca una figura, luego su silueta gris.
  function roundMatch() {
    var n = 2 + Math.min(3, G.level);
    var pool = sample(SHAPE_STEPS[G.level], Math.min(n, SHAPE_STEPS[G.level].length));
    G.total = pool.length; setProg();
    setPrompt(T("Une cada forma con su sombra", "Match each shape to its shadow"));
    var colors = shuffle(Object.keys(COLORS));
    var wrap = el("div", "pa53-two");
    var colA = el("div", "pa53-col"), colB = el("div", "pa53-col");
    var sel = null;
    shuffle(pool).forEach(function (k, i) {
      var a = el("button", "pa53-tile", shapeSVG(k, COLORS[colors[i % colors.length]].hex));
      a.setAttribute("aria-label", lang === "en" ? SHAPES[k].en : SHAPES[k].es);
      a.dataset.k = k;
      a.addEventListener("click", function () {
        if (a.classList.contains("pa53-ok")) return;
        if (sel) sel.classList.remove("pa53-sel");
        sel = a; a.classList.add("pa53-sel");
        say(lang === "en" ? SHAPES[k].en : SHAPES[k].es);
      });
      colA.appendChild(a);
    });
    shuffle(pool).forEach(function (k) {
      var b = el("button", "pa53-tile pa53-sh", shadowSVG(k));
      b.setAttribute("aria-label", T("sombra", "shadow"));
      b.addEventListener("click", function () {
        if (b.classList.contains("pa53-ok")) return;
        if (!sel) { say(T("Toca primero una forma", "Tap a shape first")); return; }
        if (sel.dataset.k === k) {
          sel.classList.remove("pa53-sel");
          sel.classList.add("pa53-ok"); good(b);
          sel = null; stepDone();
        } else { bad(b); }
      });
      colB.appendChild(b);
    });
    wrap.appendChild(colA); wrap.appendChild(colB);
    P.field.appendChild(wrap);
  }

  // 3 · Cada cosa a su color — toca una figura, luego la canasta del color.
  function roundBins() {
    var cols = COLOR_STEPS[G.level];
    var items = [], i;
    var count = 4 + G.level;
    for (i = 0; i < count; i++) {
      items.push({ c: cols[i % cols.length], s: SHAPE_STEPS[Math.min(4, G.level + 1)][rnd(SHAPE_STEPS[Math.min(4, G.level + 1)].length)] });
    }
    items = shuffle(items);
    G.total = items.length; setProg();
    setPrompt(T("Guarda cada figura en su canasta", "Put each piece in its basket"));
    var tray = el("div", "pa53-tray");
    var bins = el("div", "pa53-bins");
    var sel = null;
    items.forEach(function (it) {
      var t = el("button", "pa53-tile pa53-sm", shapeSVG(it.s, COLORS[it.c].hex));
      t.setAttribute("aria-label", lang === "en" ? (COLORS[it.c].en + " " + SHAPES[it.s].en) : (SHAPES[it.s].es + " " + COLORS[it.c].es));
      t.dataset.c = it.c;
      t.addEventListener("click", function () {
        if (t.classList.contains("pa53-gone")) return;
        if (sel) sel.classList.remove("pa53-sel");
        sel = t; t.classList.add("pa53-sel");
        say(lang === "en" ? COLORS[it.c].en : COLORS[it.c].es);
      });
      tray.appendChild(t);
    });
    cols.forEach(function (c) {
      var b = el("button", "pa53-bin", basketSVG(COLORS[c].hex));
      b.setAttribute("aria-label", lang === "en" ? COLORS[c].en : COLORS[c].es);
      b.appendChild(el("span", "bl", lang === "en" ? COLORS[c].en : COLORS[c].es));
      b.addEventListener("click", function () {
        if (!sel) { say(T("Toca primero una figura", "Tap a piece first")); return; }
        if (sel.dataset.c === c) {
          sel.classList.remove("pa53-sel");
          sel.classList.add("pa53-gone");
          good(b);
          setTimeout(function () { b.classList.remove("pa53-ok"); }, 420);
          sel = null; stepDone();
        } else { bad(b); }
      });
      bins.appendChild(b);
    });
    P.field.appendChild(tray);
    P.field.appendChild(bins);
  }

  // 4 · ¿Qué sigue? — patrón AB / ABC / AABB según el nivel.
  function roundPattern() {
    G.total = 4; setProg();
    var pool = SHAPE_STEPS[Math.min(3, G.level + 1)];
    var UNITS = [[0, 1], [0, 1], [0, 1, 2], [0, 0, 1, 1], [0, 1, 2, 1]];
    var unit = UNITS[G.level];
    var reps = G.level < 2 ? 3 : 2;
    nextPat();
    function nextPat() {
      P.field.innerHTML = "";
      var kinds = sample(pool, Math.max.apply(null, unit) + 1);
      var colors = shuffle(Object.keys(COLORS)).slice(0, kinds.length);
      // La tira NO termina en unidad completa: si terminara, la respuesta
      // sería siempre el primer elemento del patrón y el peque acertaría
      // por memoria posicional en vez de por leer la secuencia.
      var len = reps * unit.length + rnd(unit.length);
      var seq = [], j;
      for (j = 0; j < len; j++) seq.push(unit[j % unit.length]);
      var answer = unit[len % unit.length];
      setPrompt(T("Mira el patrón. ¿Qué sigue?", "Look at the pattern. What comes next?"));
      var strip = el("div", "pa53-strip");
      seq.forEach(function (ix) {
        strip.appendChild(el("div", "pa53-tile pa53-sm pa53-fix", shapeSVG(kinds[ix], COLORS[colors[ix]].hex)));
      });
      strip.appendChild(el("div", "pa53-tile pa53-sm pa53-hole", "?"));
      P.field.appendChild(strip);

      var choices = shuffle(kinds.map(function (k, i) { return { k: k, i: i }; }));
      if (choices.length < 3) {
        var extra = pool.filter(function (k) { return kinds.indexOf(k) < 0; });
        if (extra.length) choices.push({ k: extra[rnd(extra.length)], i: -1 });
        choices = shuffle(choices);
      }
      var grid = el("div", "pa53-grid");
      choices.forEach(function (c) {
        var hex = c.i >= 0 ? COLORS[colors[c.i]].hex : COLORS[shuffle(Object.keys(COLORS))[0]].hex;
        var t = el("button", "pa53-tile", shapeSVG(c.k, hex));
        t.setAttribute("aria-label", lang === "en" ? SHAPES[c.k].en : SHAPES[c.k].es);
        t.addEventListener("click", function () {
          if (t.classList.contains("pa53-ok")) return;
          if (c.i === answer) {
            good(t);
            var hole = strip.querySelector(".pa53-hole");
            if (hole) { hole.classList.remove("pa53-hole"); hole.innerHTML = shapeSVG(c.k, hex); }
            say(lang === "en" ? SHAPES[c.k].en : SHAPES[c.k].es);
            stepDone();
            if (G.done < G.total) setTimeout(nextPat, 900);
          } else { bad(t); }
        });
        grid.appendChild(t);
      });
      P.field.appendChild(grid);
    }
  }

  /* ---------- arranque ----------
     La tarjeta se inyecta en cuanto exista .cards. app.js puede repintar
     Home (refreshHome) sin borrarla, pero si algún módulo posterior
     reconstruyera la rejilla, el observer la vuelve a poner. */
  function boot() {
    detectLang();
    ensureCard();
    var lb = d.getElementById("langBtn");
    if (lb && !lb.__pa53) {
      lb.__pa53 = true;
      lb.addEventListener("click", function () { setTimeout(function () { detectLang(); paintCard(); if (ov && ov.classList.contains("show")) openGames(); }, 60); });
    }
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot);
  else boot();
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    ensureCard();
    if (d.getElementById("pa53Card") || tries > 60) { paintCard(); clearInterval(iv); }
  }, 400);
  try {
    new MutationObserver(function () { ensureCard(); }).observe(d.body, { childList: true, subtree: true });
  } catch (e) {}
})();
