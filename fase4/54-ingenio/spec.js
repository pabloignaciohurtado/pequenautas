/* ===== Fase 4 #54 · Sección "Juegos de Ingenio" =====

   Las cuatro mecánicas que quedaban pendientes en el plan —rompecabezas,
   silueta-sombra, sendero de un trazo y balanza— no encajaban en Números,
   Letras ni Animales: no enseñan un contenido curricular, entrenan la
   cabeza. Por eso viven juntas en su propia sección, con los protagonistas
   de selva que Ignacio pidió (búho, halcón, ardilla y oso) presidiendo
   cada juego desde su viñeta.

   Sigue punto por punto el patrón validado en #53, que ya está probado
   contra el resto de la app:
   - #34 encierra su registro en una IIFE y su listener de captura solo
     intercepta las claves que conoce; data-game="brain" le es ajeno.
   - app.js engancha las .subject UNA vez al cargar, así que una tarjeta
     inyectada después se queda con su clic entero.
   - Overlay PROPIO (.pa54-ov): #40 hace querySelector(".pa34-ov") y con
     varios overlays le pondría el fondo al equivocado.
   - Por dentro sí reutiliza .pa34-sheet/.pa34-hd/.pa34-games y estampa
     data-pa34-game, de modo que hereda gratis el papercraft de #52.

   Todo el contenido jugable se dibuja como SVG en línea. Aquí no es solo
   por nitidez: las piezas del rompecabezas son ventanas (viewBox) sobre
   una MISMA escena, así que encajan perfecto por construcción, sin cortar
   ni alinear imágenes; y la silueta es literalmente el mismo trazo que la
   figura, relleno de tinta, así que nunca puede "no corresponder".

   Aditivo: no toca app.js, ni index.html, ni STORE_KEY. Progreso propio en
   clave separada. Si no carga, la app se ve como antes. */
(function () {
  "use strict";
  if (window.__pa54) return;
  window.__pa54 = true;

  var PKEY = "pequenautas.f4.ingenio.v1";
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
     Se deduce del texto de la etiqueta que app.js sí traduce. */
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

  var INK = "#3A4438";

  /* ---------- objetos del bosque ----------
     Cosas que un peque de 3 años reconoce de un vistazo y que además son
     dibujables con trazos limpios: nada de animales, que a este tamaño se
     vuelven manchas ambiguas. Los animales de selva viven en las viñetas
     ilustradas de la pantalla de selección, que es donde lucen. */
  var OBJS = {
    leaf:      { es: "hoja",     en: "leaf",      hex: "#4FA05C" },
    acorn:     { es: "bellota",  en: "acorn",     hex: "#B4783C" },
    mushroom:  { es: "hongo",    en: "mushroom",  hex: "#D8452F" },
    pinecone:  { es: "piña",     en: "pinecone",  hex: "#8A6034" },
    flower:    { es: "flor",     en: "flower",    hex: "#E0669A" },
    butterfly: { es: "mariposa", en: "butterfly", hex: "#E8843A" },
    snail:     { es: "caracol",  en: "snail",     hex: "#C79A4E" },
    feather:   { es: "pluma",    en: "feather",   hex: "#4EA8DE" }
  };
  var OBJ_STEPS = [
    ["leaf", "acorn", "mushroom"],
    ["leaf", "acorn", "mushroom", "flower"],
    ["leaf", "acorn", "mushroom", "flower", "butterfly"],
    ["leaf", "acorn", "mushroom", "flower", "butterfly", "pinecone"],
    ["leaf", "acorn", "mushroom", "flower", "butterfly", "pinecone", "snail", "feather"]
  ];

  /* Un solo generador de trazo por objeto. La ficha de color y la silueta
     de tinta salen de AQUÍ las dos, así que emparejan por construcción. */
  function objPath(kind, fill, silhouette) {
    var st = silhouette ? "none" : "rgba(46,59,44,.30)";
    var w = silhouette ? 0 : 3;
    function a(extra) { return 'fill="' + fill + '" stroke="' + st + '" stroke-width="' + w + '" stroke-linejoin="round"' + (extra || ""); }
    var det = silhouette ? "none" : "rgba(46,59,44,.30)";
    switch (kind) {
      case "leaf":
        return '<path d="M50 8 C20 30 16 70 50 93 C84 70 80 30 50 8 Z" ' + a() + '/>' +
          '<path d="M50 20 L50 88" stroke="' + det + '" stroke-width="3" fill="none"/>' +
          '<path d="M50 40 L30 52 M50 40 L70 52 M50 60 L34 70 M50 60 L66 70" stroke="' + det + '" stroke-width="2.4" fill="none"/>';
      case "acorn":
        return '<path d="M26 44 C26 76 40 92 50 92 C60 92 74 76 74 44 Z" ' + a() + '/>' +
          '<path d="M20 40 Q50 22 80 40 Q50 54 20 40 Z" fill="' + (silhouette ? fill : "#7A5127") + '" stroke="' + st + '" stroke-width="' + w + '"/>' +
          '<path d="M50 24 L50 10" stroke="' + (silhouette ? fill : "#7A5127") + '" stroke-width="6" stroke-linecap="round" fill="none"/>';
      case "mushroom":
        return '<path d="M40 60 L40 84 Q50 92 60 84 L60 60 Z" fill="' + (silhouette ? fill : "#F1E4C8") + '" stroke="' + st + '" stroke-width="' + w + '"/>' +
          '<path d="M10 62 Q14 20 50 20 Q86 20 90 62 Z" ' + a() + '/>' +
          '<circle cx="34" cy="42" r="7" fill="' + (silhouette ? fill : "#FFFCF2") + '"/>' +
          '<circle cx="60" cy="36" r="6" fill="' + (silhouette ? fill : "#FFFCF2") + '"/>' +
          '<circle cx="70" cy="52" r="5" fill="' + (silhouette ? fill : "#FFFCF2") + '"/>';
      case "pinecone":
        return '<ellipse cx="50" cy="56" rx="26" ry="36" ' + a() + '/>' +
          '<path d="M50 26 L34 40 M50 26 L66 40 M50 44 L30 56 M50 44 L70 56 M50 62 L32 72 M50 62 L68 72 M50 78 L38 86 M50 78 L62 86" stroke="' + det + '" stroke-width="2.6" fill="none"/>' +
          '<path d="M50 20 L44 8 M50 20 L58 9" stroke="' + (silhouette ? fill : "#4FA05C") + '" stroke-width="5" stroke-linecap="round" fill="none"/>';
      case "flower":
        return '<circle cx="50" cy="24" r="15" ' + a() + '/><circle cx="74" cy="42" r="15" ' + a() + '/>' +
          '<circle cx="65" cy="70" r="15" ' + a() + '/><circle cx="35" cy="70" r="15" ' + a() + '/>' +
          '<circle cx="26" cy="42" r="15" ' + a() + '/>' +
          '<circle cx="50" cy="49" r="12" fill="' + (silhouette ? fill : "#E8B22C") + '" stroke="' + st + '" stroke-width="' + w + '"/>';
      case "butterfly":
        return '<path d="M48 50 C24 18 6 26 10 46 C13 62 32 62 48 50 Z" ' + a() + '/>' +
          '<path d="M52 50 C76 18 94 26 90 46 C87 62 68 62 52 50 Z" ' + a() + '/>' +
          '<path d="M48 50 C28 68 16 84 28 92 C40 98 48 76 48 50 Z" ' + a() + '/>' +
          '<path d="M52 50 C72 68 84 84 72 92 C60 98 52 76 52 50 Z" ' + a() + '/>' +
          '<ellipse cx="50" cy="54" rx="5" ry="22" fill="' + (silhouette ? fill : "#5A4028") + '" stroke="' + st + '" stroke-width="' + w + '"/>' +
          '<path d="M47 34 L38 18 M53 34 L62 18" stroke="' + (silhouette ? fill : "#5A4028") + '" stroke-width="3.4" stroke-linecap="round" fill="none"/>';
      case "snail":
        return '<path d="M14 82 Q14 66 34 64 L70 64 Q84 64 84 74 Q84 84 70 84 L16 84 Z" fill="' + (silhouette ? fill : "#E4C89A") + '" stroke="' + st + '" stroke-width="' + w + '"/>' +
          '<path d="M72 62 L68 42 M80 62 L84 44" stroke="' + (silhouette ? fill : "#E4C89A") + '" stroke-width="4" stroke-linecap="round" fill="none"/>' +
          '<circle cx="42" cy="48" r="30" ' + a() + '/>' +
          '<path d="M42 48 m0 -20 a20 20 0 1 1 -14 34 a13 13 0 1 1 16 -22 a7 7 0 1 1 -8 10" fill="none" stroke="' + det + '" stroke-width="3"/>';
      case "feather":
        return '<path d="M56 10 C22 34 22 68 40 90 C64 78 76 44 56 10 Z" ' + a() + '/>' +
          '<path d="M56 12 L38 90" stroke="' + det + '" stroke-width="3" fill="none"/>' +
          '<path d="M50 30 L34 40 M47 46 L31 55 M44 62 L30 70" stroke="' + det + '" stroke-width="2.4" fill="none"/>';
    }
    return "";
  }
  function objSVG(kind) {
    return '<svg viewBox="0 0 100 100" class="pa54-svg" aria-hidden="true">' + objPath(kind, OBJS[kind].hex, false) + "</svg>";
  }
  function objShadow(kind) {
    return '<svg viewBox="0 0 100 100" class="pa54-svg" aria-hidden="true">' + objPath(kind, INK, true) + "</svg>";
  }

  /* ---------- escenas del rompecabezas ----------
     Devuelven SOLO el interior del <svg>, sobre un lienzo 120×120. Cada
     pieza es un <svg> con la MISMA cadena y un viewBox recortado: por eso
     las piezas casan sin costura y no hay que trocear ninguna imagen. */
  function sceneInner(n) {
    if (n === 1) {
      return '<rect width="120" height="120" fill="#F4E9CE"/>' +
        '<circle cx="94" cy="24" r="15" fill="#F2C94C"/>' +
        '<path d="M0 82 Q30 62 62 82 Q92 100 120 84 L120 120 L0 120 Z" fill="#4FA05C"/>' +
        '<path d="M0 96 Q34 82 70 98 Q98 110 120 100 L120 120 L0 120 Z" fill="#3D7A4A"/>' +
        '<path d="M44 82 L30 82 L44 58 L34 58 L48 34 L62 58 L52 58 L66 82 Z" fill="#2F6B44"/>' +
        '<rect x="46" y="80" width="6" height="14" fill="#7A5127"/>' +
        '<path d="M92 96 Q92 84 100 84 Q108 84 108 96 Z" fill="#D8452F"/>' +
        '<rect x="98" y="94" width="5" height="10" fill="#F1E4C8"/>' +
        '<ellipse cx="22" cy="30" rx="16" ry="8" fill="#FFFCF2"/>' +
        '<ellipse cx="34" cy="28" rx="10" ry="6" fill="#FFFCF2"/>';
    }
    return '<rect width="120" height="120" fill="#E7F0F5"/>' +
      '<circle cx="26" cy="26" r="13" fill="#F2C94C"/>' +
      '<path d="M0 70 L34 40 L68 70 Z" fill="#8FA9A2"/>' +
      '<path d="M40 74 L74 38 L110 74 Z" fill="#6E8A85"/>' +
      '<path d="M0 76 Q60 66 120 78 L120 120 L0 120 Z" fill="#4FA05C"/>' +
      '<path d="M0 98 Q58 88 120 100 L120 120 L0 120 Z" fill="#3D7A4A"/>' +
      '<path d="M24 108 L14 108 L26 88 L18 88 L30 70 L42 88 L34 88 L46 108 Z" fill="#2F6B44"/>' +
      '<circle cx="86" cy="100" r="9" fill="#E8843A"/>' +
      '<path d="M78 96 L74 88 L82 92 Z" fill="#E8843A"/>' +
      '<path d="M94 96 L98 88 L90 92 Z" fill="#E8843A"/>';
  }
  function scenePiece(n, vx, vy, vw, vh) {
    return '<svg viewBox="' + vx + ' ' + vy + ' ' + vw + ' ' + vh + '" class="pa54-svg" preserveAspectRatio="none" aria-hidden="true">' + sceneInner(n) + "</svg>";
  }

  /* ---------- balanza ----------
     El brazo se inclina de verdad según la diferencia: el peque puede leer
     la respuesta en el dibujo si aún no sabe contar, y contando la confirma.
     Esa doble vía es justamente lo que hace que el juego enseñe. */
  function scaleSVG(tilt) {
    var t = Math.max(-12, Math.min(12, tilt));
    return '<svg viewBox="0 0 300 150" class="pa54-scale" aria-hidden="true">' +
      '<rect x="140" y="46" width="20" height="86" rx="6" fill="#8A6034"/>' +
      '<path d="M112 138 Q150 126 188 138 L188 146 L112 146 Z" fill="#7A5127"/>' +
      '<g transform="rotate(' + t + ' 150 46)">' +
      '<rect x="30" y="40" width="240" height="12" rx="6" fill="#B4783C"/>' +
      '<circle cx="150" cy="46" r="11" fill="#E8B22C" stroke="rgba(46,59,44,.3)" stroke-width="3"/>' +
      '<path d="M50 50 L50 74 M250 50 L250 74" stroke="rgba(46,59,44,.45)" stroke-width="3"/>' +
      '<path d="M18 74 L82 74 L70 100 L30 100 Z" fill="#F1E4C8" stroke="rgba(46,59,44,.3)" stroke-width="3"/>' +
      '<path d="M218 74 L282 74 L270 100 L230 100 Z" fill="#F1E4C8" stroke="rgba(46,59,44,.3)" stroke-width="3"/>' +
      "</g></svg>";
  }

  /* ---------- registro de juegos ---------- */
  var GAMES = [
    { id: "brain:puzzle", kind: "puzzle", mech: "drag",
      es: "Arma el paisaje", en: "Build the picture",
      des: "Pon cada pieza en su sitio", den: "Put each piece in its place" },
    { id: "brain:shadow", kind: "shadow", mech: "match",
      es: "¿De quién es la sombra?", en: "Whose shadow is it?",
      des: "Une cada cosa con su sombra", den: "Match each thing to its shadow" },
    { id: "brain:path", kind: "path", mech: "sort",
      es: "Sigue el sendero", en: "Follow the trail",
      des: "Toca las huellas en orden", den: "Tap the tracks in order" },
    { id: "brain:scale", kind: "scale", mech: "tap",
      es: "La balanza del oso", en: "The bear's scales",
      des: "Descubre qué lado pesa más", den: "Find out which side is heavier" }
  ];
  function gName(g) { return lang === "en" ? g.en : g.es; }
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
    if (!cards || d.getElementById("pa54Card")) return;
    var b = el("button", "subject pa54-card");
    b.id = "pa54Card";
    b.setAttribute("data-game", "brain");
    b.innerHTML = '<span class="blob"></span><span class="lv" id="pa54Lv"></span>' +
      '<span class="emoji">🧩</span><span class="label" id="pa54Label"></span>';
    b.addEventListener("click", function () { detectLang(); openGames(); });
    cards.appendChild(b);
    paintCard();
  }
  function paintCard() {
    var lb = d.getElementById("pa54Label"), lv = d.getElementById("pa54Lv");
    if (lb) lb.textContent = T("Ingenio", "Puzzles");
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
    ov = el("div", "pa54-ov");
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    var sheet = el("div", "pa34-sheet pa54-sheet");
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
    hdT.innerHTML = T("Juegos de Ingenio", "Puzzle Games") +
      "<small>" + T("Elige un juego", "Choose a game") + "</small>";
    body.innerHTML = "";
    var grid = el("div", "pa34-games pa54-games");
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

  /* ---------- superficie de juego ---------- */
  var play = null, P = {}, G = null;
  function ensurePlay() {
    if (play) return;
    play = el("div", "pa54-play");
    play.innerHTML =
      '<div class="pa54-ptop"><button class="pa34-x" id="pa54pX" aria-label="Salir">&times;</button>' +
      '<div class="pa54-prompt" id="pa54prompt"></div>' +
      '<div class="pa54-pstar">' + String.fromCodePoint(0x2B50) + ' <span id="pa54score">0</span></div></div>' +
      '<div class="pa54-field" id="pa54field"></div>' +
      '<div class="pa54-pbot"><div class="pa54-prog" id="pa54prog"></div>' +
      '<button class="pa54-cta" id="pa54replay">🔊</button></div>' +
      '<div class="pa54-win" id="pa54win"><div class="pa54-wc">' +
      '<div class="rf">' + objSVG("leaf") + '</div>' +
      '<h2 id="pa54wt"></h2><p id="pa54wp"></p>' +
      '<div class="row"><button class="pa54-cta ghost" id="pa54wmap"></button>' +
      '<button class="pa54-cta" id="pa54wnext"></button></div></div></div>';
    d.body.appendChild(play);
    P = {
      field: d.getElementById("pa54field"), prompt: d.getElementById("pa54prompt"),
      prog: d.getElementById("pa54prog"), score: d.getElementById("pa54score"),
      win: d.getElementById("pa54win"), wt: d.getElementById("pa54wt"),
      wp: d.getElementById("pa54wp"), wnext: d.getElementById("pa54wnext"),
      wmap: d.getElementById("pa54wmap"), replay: d.getElementById("pa54replay")
    };
    d.getElementById("pa54pX").addEventListener("click", exitPlay);
    P.replay.addEventListener("click", function () { if (G && G.prompt) say(G.prompt); });
    P.wmap.addEventListener("click", function () { exitPlay(); openLevels(G.g); });
    P.wnext.addEventListener("click", function () {
      var nx = G.level + 1;
      if (nx < 5) { launch(G.g, nx); } else { exitPlay(); openLevels(G.g); }
    });
  }
  function exitPlay() { if (play) play.classList.remove("show"); if (P.win) P.win.classList.remove("show"); }
  function openPlay() { ensurePlay(); play.classList.add("show"); P.win.classList.remove("show"); }

  function setPrompt(txt, speakIt) {
    G.prompt = txt;
    P.prompt.textContent = txt;
    if (speakIt !== false) say(txt);
  }
  function setProg() {
    P.prog.innerHTML = "";
    for (var i = 0; i < G.total; i++) P.prog.appendChild(el("i", i < G.done ? "on" : null));
  }
  function good(node) {
    if (node) node.classList.add("pa54-ok");
    G.score++; P.score.textContent = G.score;
  }
  function bad(node) {
    if (!node) return;
    node.classList.add("pa54-no");
    setTimeout(function () { node.classList.remove("pa54-no"); }, 480);
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
    if (g.kind === "puzzle") roundPuzzle();
    else if (g.kind === "shadow") roundShadow();
    else if (g.kind === "path") roundPath();
    else roundScale();
  }

  /* 1 · Rompecabezas — toca una pieza de la bandeja y luego su hueco.
     Se elige "tocar y colocar" en vez de arrastrar a propósito: a los 3
     años el arrastre con el dedo falla mucho, y un fallo de motricidad se
     vive como un fallo del juego. */
  var PUZZ = [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]];
  function roundPuzzle() {
    var cols = PUZZ[G.level][0], rows = PUZZ[G.level][1];
    var scene = G.level % 2 === 0 ? 1 : 2;
    var cw = 120 / cols, chh = 120 / rows;
    G.total = cols * rows; setProg();
    setPrompt(T("Pon cada pieza en su sitio", "Put each piece in its place"));

    var board = el("div", "pa54-board");
    board.style.gridTemplateColumns = "repeat(" + cols + ",1fr)";
    board.style.aspectRatio = cols + " / " + rows;
    var slots = [], i, r, c;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        var s = el("button", "pa54-slot");
        s.dataset.ix = String(r * cols + c);
        s.setAttribute("aria-label", T("hueco ", "slot ") + (r * cols + c + 1));
        board.appendChild(s);
        slots.push(s);
      }
    }
    var tray = el("div", "pa54-tray");
    var sel = null;
    var order = shuffle((function () { var a = []; for (i = 0; i < cols * rows; i++) a.push(i); return a; })());
    order.forEach(function (ix) {
      var pr = Math.floor(ix / cols), pc = ix % cols;
      var p = el("button", "pa54-piece", scenePiece(scene, pc * cw, pr * chh, cw, chh));
      p.style.aspectRatio = cw + " / " + chh;
      p.dataset.ix = String(ix);
      p.setAttribute("aria-label", T("pieza ", "piece ") + (ix + 1));
      p.addEventListener("click", function () {
        if (p.classList.contains("pa54-gone")) return;
        if (sel) sel.classList.remove("pa54-sel");
        sel = p; p.classList.add("pa54-sel");
      });
      tray.appendChild(p);
    });
    slots.forEach(function (s) {
      s.addEventListener("click", function () {
        if (s.classList.contains("pa54-filled")) return;
        if (!sel) { say(T("Toca primero una pieza", "Tap a piece first")); return; }
        if (sel.dataset.ix === s.dataset.ix) {
          s.innerHTML = sel.innerHTML;
          s.classList.add("pa54-filled");
          sel.classList.remove("pa54-sel");
          sel.classList.add("pa54-gone");
          good(s); sel = null; stepDone();
        } else { bad(s); }
      });
    });
    P.field.appendChild(board);
    P.field.appendChild(tray);
  }

  /* 2 · Silueta — la figura de color arriba, las siluetas de tinta abajo. */
  function roundShadow() {
    var n = 2 + Math.min(4, G.level);
    var pool = sample(OBJ_STEPS[G.level], Math.min(n, OBJ_STEPS[G.level].length));
    G.total = pool.length; setProg();
    setPrompt(T("Une cada cosa con su sombra", "Match each thing to its shadow"));
    var wrap = el("div", "pa54-two");
    var colA = el("div", "pa54-row"), colB = el("div", "pa54-row pa54-shadows");
    var sel = null;
    shuffle(pool).forEach(function (k) {
      var a = el("button", "pa54-tile", objSVG(k));
      a.setAttribute("aria-label", lang === "en" ? OBJS[k].en : OBJS[k].es);
      a.dataset.k = k;
      a.addEventListener("click", function () {
        if (a.classList.contains("pa54-ok")) return;
        if (sel) sel.classList.remove("pa54-sel");
        sel = a; a.classList.add("pa54-sel");
        say(lang === "en" ? OBJS[k].en : OBJS[k].es);
      });
      colA.appendChild(a);
    });
    shuffle(pool).forEach(function (k) {
      var b = el("button", "pa54-tile pa54-sh", objShadow(k));
      b.setAttribute("aria-label", T("sombra", "shadow"));
      b.addEventListener("click", function () {
        if (b.classList.contains("pa54-ok")) return;
        if (!sel) { say(T("Toca primero una figura", "Tap a picture first")); return; }
        if (sel.dataset.k === k) {
          sel.classList.remove("pa54-sel");
          sel.classList.add("pa54-ok"); good(b);
          sel = null; stepDone();
        } else { bad(b); }
      });
      colB.appendChild(b);
    });
    wrap.appendChild(colA); wrap.appendChild(colB);
    P.field.appendChild(wrap);
  }

  /* 3 · Sendero de un trazo — huellas repartidas por el claro; hay que
     tocarlas en orden y el rastro se va dibujando. El sendero se genera
     con una vuelta suave para que el orden NO coincida con leer de
     izquierda a derecha: si coincidiera, el juego no exigiría seguir nada. */
  function roundPath() {
    var trails = 3;
    G.total = trails; setProg();
    var dots = 4 + G.level;
    var done = 0;
    nextTrail();
    function nextTrail() {
      P.field.innerHTML = "";
      setPrompt(T("Toca las huellas en orden, de la 1 a la " + dots,
        "Tap the tracks in order, from 1 to " + dots));
      var W = 300, H = 210, pts = [], i;
      var phase = Math.random() * Math.PI * 2;
      var amp = 52 + rnd(18);
      for (i = 0; i < dots; i++) {
        var t = i / (dots - 1);
        pts.push({
          x: 34 + t * (W - 68),
          y: H / 2 + Math.sin(phase + t * Math.PI * 1.7) * amp
        });
      }
      // Recorrer en un orden que no sea el de la pantalla: se camina el
      // sendero de ida y vuelta alternando extremos.
      var walk = [];
      var lo = 0, hi = dots - 1, flip = rnd(2) === 1;
      while (lo <= hi) {
        if (flip) { walk.push(lo); lo++; } else { walk.push(hi); hi--; }
        flip = !flip;
      }
      var svgns = "http://www.w3.org/2000/svg";
      var box = el("div", "pa54-trail");
      var svg = d.createElementNS(svgns, "svg");
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("class", "pa54-trailsvg");
      var line = d.createElementNS(svgns, "polyline");
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "#57C596");
      line.setAttribute("stroke-width", "7");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-linejoin", "round");
      line.setAttribute("points", "");
      svg.appendChild(line);
      box.appendChild(svg);

      var step = 0, drawn = [];
      walk.forEach(function (pi, orderIx) {
        var p = pts[pi];
        var btn = el("button", "pa54-foot", String(orderIx + 1));
        btn.style.left = (p.x / W * 100) + "%";
        btn.style.top = (p.y / H * 100) + "%";
        btn.setAttribute("aria-label", T("huella ", "track ") + (orderIx + 1));
        btn.dataset.n = String(orderIx);
        btn.addEventListener("click", function () {
          if (btn.classList.contains("pa54-ok")) return;
          if (orderIx !== step) { bad(btn); return; }
          btn.classList.add("pa54-ok");
          drawn.push(p.x + "," + p.y);
          line.setAttribute("points", drawn.join(" "));
          step++;
          say(String(orderIx + 1));
          if (step >= dots) {
            good(btn);
            done++;
            stepDone();
            if (done < trails) setTimeout(nextTrail, 800);
          }
        });
        box.appendChild(btn);
      });
      P.field.appendChild(box);
    }
  }

  /* 4 · La balanza del oso — cuál pesa más, y en los últimos niveles
     cuántas bellotas faltan para equilibrar. */
  function roundScale() {
    G.total = 4; setProg();
    var maxN = 3 + G.level * 2;
    var balanceMode = G.level >= 3;
    nextScale();
    function nextScale() {
      P.field.innerHTML = "";
      var a = 1 + rnd(maxN), b = 1 + rnd(maxN);
      if (balanceMode) { if (b >= a) { var tmp = a; a = b + 1 + rnd(2); b = tmp; } }
      while (a === b) { b = 1 + rnd(maxN); }
      var diff = a - b;
      var wrap = el("div", "pa54-scalewrap");
      wrap.innerHTML = scaleSVG(diff > 0 ? 9 : -9);
      var pans = el("div", "pa54-pans");
      var left = el("div", "pa54-pan"), right = el("div", "pa54-pan");
      var i;
      for (i = 0; i < a; i++) left.appendChild(el("span", "pa54-w", objSVG("acorn")));
      for (i = 0; i < b; i++) right.appendChild(el("span", "pa54-w", objSVG("acorn")));
      pans.appendChild(left); pans.appendChild(right);
      wrap.appendChild(pans);
      P.field.appendChild(wrap);

      if (!balanceMode) {
        setPrompt(T("¿Qué lado pesa más?", "Which side is heavier?"));
        var row = el("div", "pa54-grid");
        [{ k: "L", n: a, t: T("Izquierda", "Left") }, { k: "R", n: b, t: T("Derecha", "Right") }].forEach(function (o) {
          var t = el("button", "pa54-cta ghost pa54-side", o.t);
          t.setAttribute("aria-label", o.t);
          t.addEventListener("click", function () {
            if (t.classList.contains("pa54-ok")) return;
            var win = (diff > 0) ? "L" : "R";
            if (o.k === win) { good(t); say(o.t); stepDone(); if (G.done < G.total) setTimeout(nextScale, 850); }
            else { bad(t); }
          });
          row.appendChild(t);
        });
        P.field.appendChild(row);
      } else {
        setPrompt(T("¿Cuántas bellotas faltan a la derecha?", "How many acorns does the right side need?"));
        var opts = [diff];
        while (opts.length < 3) {
          var o2 = 1 + rnd(Math.max(3, diff + 2));
          if (opts.indexOf(o2) < 0) opts.push(o2);
        }
        var grid = el("div", "pa54-grid");
        shuffle(opts).forEach(function (n) {
          var t = el("button", "pa54-tile pa54-num", String(n));
          t.setAttribute("aria-label", String(n));
          t.addEventListener("click", function () {
            if (t.classList.contains("pa54-ok")) return;
            if (n === diff) {
              good(t); say(String(n));
              for (var j = 0; j < diff; j++) right.appendChild(el("span", "pa54-w pa54-new", objSVG("acorn")));
              var sv = wrap.querySelector(".pa54-scale");
              if (sv) { var g2 = sv.querySelector("g"); if (g2) g2.setAttribute("transform", "rotate(0 150 46)"); }
              stepDone();
              if (G.done < G.total) setTimeout(nextScale, 950);
            } else { bad(t); }
          });
          grid.appendChild(t);
        });
        P.field.appendChild(grid);
      }
    }
  }

  /* ---------- arranque ---------- */
  function boot() {
    detectLang();
    ensureCard();
    var lb = d.getElementById("langBtn");
    if (lb && !lb.__pa54) {
      lb.__pa54 = true;
      lb.addEventListener("click", function () {
        setTimeout(function () { detectLang(); paintCard(); if (ov && ov.classList.contains("show")) openGames(); }, 60);
      });
    }
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot);
  else boot();
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    ensureCard();
    if (d.getElementById("pa54Card") || tries > 60) { paintCard(); clearInterval(iv); }
  }, 400);
  try {
    new MutationObserver(function () { ensureCard(); }).observe(d.body, { childList: true, subtree: true });
  } catch (e) {}
})();
