/* ===== Fase 4 #58 · Sección "Emociones y Convivencia" =====

   La séptima materia, y la primera que no enseña un contenido sino una
   competencia: reconocer lo que siente uno y lo que siente el otro. A los
   3-5 años eso todavía no está construido —el niño distingue "bien" de
   "mal" pero no tiene palabra para "frustrado" ni sabe que el de al lado
   puede sentir algo distinto a lo que siente él— y sin embargo es lo que
   más peso tiene en cómo le va a ir en el aula.

   Encaja con algo que la app ya hacía a ciegas: #05 detecta frustración
   por telemetría (errores seguidos, abandonos, ritmo) pero hasta ahora
   solo sabía bajar la dificultad. Con esta sección la app por fin tiene
   algo que OFRECER cuando detecta ese estado: "Respira con Rufo" es una
   herramienta de autorregulación real, no un minijuego, y por eso se puede
   abrir sola desde cualquier punto (window.pa58Breathe()).

   Cuatro juegos, cinco niveles cada uno:
   1. ¿Cómo se siente?  leer una cara y ponerle nombre a la emoción.
   2. ¿Qué pasó?        una situación → qué siente el protagonista.
   3. ¿Qué puedo hacer? una situación → cuál es la acción amable.
   4. Respira con Rufo  respiración guiada, la herramienta de calma.

   Decisión de arte: las CARAS no son imágenes, son SVG generado aquí.
   Es la misma razón que en #53 con las formas: el contenido jugable tiene
   que ser exacto y combinable —seis emociones × cinco niveles son muchas
   caras, y todas tienen que ser la MISMA cara cambiando solo cejas, ojos y
   boca, porque si cambia el animal el niño resuelve por el animal y no por
   la emoción. Grok pone las cinco ilustraciones de marco (tarjeta del home
   y las cuatro viñetas), que es donde la dirección de arte se juega.

   Sigue el patrón validado en #53/#54/#55:
   - overlay PROPIO (.pa58-ov): #40 hace querySelector(".pa34-ov").
   - por dentro reutiliza .pa34-sheet/.pa34-hd/.pa34-games y estampa
     data-pa34-game, así hereda gratis el papercraft de #52.
   - la tarjeta se inyecta después de que app.js enganche las .subject,
     así que se queda con su clic entero.

   Aditivo: no toca app.js, ni index.html, ni STORE_KEY. */
(function () {
  "use strict";
  if (window.__pa58) return;
  window.__pa58 = true;

  // Progreso por perfil (auditoría #7): PKEY() lleva el id del niño activo
  // y migra() copia+borra una única vez la llave vieja de dispositivo.
  var PKEY_BASE = "pequenautas.f4.emociones.v1";
  // pid() da null si aún no hay perfil activo (p.ej. #home .cards existe en
  // el HTML estático desde antes de elegir perfil): PKEY() cae entonces a la
  // llave plana de siempre, y migrar() NO se marca hecho hasta que haya un
  // perfil de verdad al que migrar.
  function pid() { var p = (typeof currentProfile === "function") ? currentProfile() : null; return (p && p.id) ? p.id : null; }
  function PKEY() { var id = pid(); return id ? (PKEY_BASE + "." + id) : PKEY_BASE; }
  var migrado = false;
  function migrar() {
    if (migrado) return;
    var id = pid();
    if (!id) return;
    migrado = true;
    try {
      var k = PKEY_BASE + "." + id;
      if (localStorage.getItem(k) != null) return;
      var viejo = localStorage.getItem(PKEY_BASE);
      if (viejo != null) { localStorage.setItem(k, viejo); localStorage.removeItem(PKEY_BASE); }
    } catch (e) {}
  }
  function loadP() { migrar(); try { return JSON.parse(localStorage.getItem(PKEY()) || "{}") || {}; } catch (e) { return {}; } }
  function saveP(o) { try { localStorage.setItem(PKEY(), JSON.stringify(o)); } catch (e) {} }
  function unlocked(gid) { var p = loadP(); return (typeof p[gid] === "number") ? p[gid] : 0; }
  function setUnlocked(gid, v) { var p = loadP(); if (!(p[gid] >= v)) { p[gid] = v; saveP(p); } }

  var d = document;
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) { var b = a.slice(), i, j, t; for (i = b.length - 1; i > 0; i--) { j = rnd(i + 1); t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
  function sample(a, n) { return shuffle(a).slice(0, n); }
  function without(a, x) { return a.filter(function (o) { return o !== x && o.id !== (x && x.id); }); }

  var lang = "es";
  function detectLang() {
    var n = d.getElementById("lblRead");
    lang = (n && /letter/i.test(n.textContent || "")) ? "en" : "es";
    return lang;
  }
  function T(es, en) { return lang === "en" ? en : es; }
  function say(txt) { try { if (typeof window.speak === "function") window.speak(txt, { lang: lang }); } catch (e) {} }
  function star() { try { if (typeof window.addStar === "function") window.addStar(); } catch (e) {} }
  // "Pistas guiadas" vive en S.guide dentro de app.js, tan inalcanzable como
  // S.lang: se lee del mismo interruptor visible que el adulto manipula
  // (#tgGuide), calcado de appSoundOn() en #57.
  function guideOn() {
    var tg = d.getElementById("tgGuide");
    return tg ? tg.classList.contains("on") : true;
  }

  /* ---------- las seis emociones ----------
     Seis y no más: son las que la literatura de preescolar da por
     nombrables a los 3-5 años. Cada una lleva su color propio porque a esta
     edad el color es la primera pista y la palabra la segunda; el color se
     mantiene idéntico en los cuatro juegos para que sirva de ancla.
     Ninguno morado/lila/rosa: paleta del bosque. */
  var EMO = [
    { id: "happy",  es: "Alegre",      en: "Happy",     emo: "😊", c: "#E8B33A" },
    { id: "sad",    es: "Triste",      en: "Sad",       emo: "😢", c: "#4EA8DE" },
    { id: "angry",  es: "Enojado",     en: "Angry",     emo: "😠", c: "#D9563F" },
    { id: "scared", es: "Asustado",    en: "Scared",    emo: "😨", c: "#8A7A5C" },
    { id: "surp",   es: "Sorprendido", en: "Surprised", emo: "😮", c: "#E8843A" },
    { id: "calm",   es: "Tranquilo",   en: "Calm",      emo: "😌", c: "#57C596" }
  ];
  function eName(e) { return lang === "en" ? e.en : e.es; }
  function byId(id) { for (var i = 0; i < EMO.length; i++) if (EMO[i].id === id) return EMO[i]; return EMO[0]; }

  /* ---------- la cara ----------
     Un solo zorro de papel al que solo le cambian cejas, ojos y boca. Que
     el animal NO cambie es todo el diseño del juego: si cambiara, el niño
     aprendería "el erizo está triste" en vez de "las cejas caídas y la boca
     hacia abajo son tristeza", que es lo transferible.
     Geometría en un viewBox 100x100 para que escale sin pensar. */
  var FACE = {
    happy:  { brow: "M26 33 Q33 28 40 32 M60 32 Q67 28 74 33", eye: "open", mouth: "M34 62 Q50 76 66 62", blush: true },
    sad:    { brow: "M26 28 Q33 33 40 35 M60 35 Q67 33 74 28", eye: "open", mouth: "M34 70 Q50 58 66 70", tear: true },
    angry:  { brow: "M26 26 Q33 33 40 36 M60 36 Q67 33 74 26", eye: "open", mouth: "M34 70 Q50 62 66 70", steam: true },
    scared: { brow: "M26 30 Q33 24 40 30 M60 30 Q67 24 74 30", eye: "wide", mouth: "M50 68 m-9 0 a9 11 0 1 0 18 0 a9 11 0 1 0 -18 0" },
    surp:   { brow: "M25 26 Q33 21 41 26 M59 26 Q67 21 75 26", eye: "wide", mouth: "M50 67 m-8 0 a8 9 0 1 0 16 0 a8 9 0 1 0 -16 0" },
    calm:   { brow: "M27 31 Q33 29 39 31 M61 31 Q67 29 73 31", eye: "closed", mouth: "M40 64 Q50 71 60 64", blush: true }
  };
  function faceSvg(id) {
    var f = FACE[id] || FACE.happy, s = "";
    s += '<svg viewBox="0 0 100 100" class="pa58-fsvg" aria-hidden="true">';
    /* orejas */
    s += '<path class="ear" d="M18 34 L14 8 L38 20 Z"/><path class="ear" d="M82 34 L86 8 L62 20 Z"/>';
    s += '<path class="earin" d="M22 31 L20 15 L34 22 Z"/><path class="earin" d="M78 31 L80 15 L66 22 Z"/>';
    /* cabeza */
    s += '<ellipse class="head" cx="50" cy="55" rx="36" ry="34"/>';
    s += '<ellipse class="snout" cx="50" cy="64" rx="21" ry="17"/>';
    /* ojos */
    if (f.eye === "closed") {
      s += '<path class="lid" d="M31 45 Q38 51 45 45"/><path class="lid" d="M55 45 Q62 51 69 45"/>';
    } else {
      var r = f.eye === "wide" ? 8 : 6;
      s += '<circle class="eye" cx="38" cy="45" r="' + r + '"/><circle class="eye" cx="62" cy="45" r="' + r + '"/>';
      s += '<circle class="glint" cx="40" cy="43" r="2.1"/><circle class="glint" cx="64" cy="43" r="2.1"/>';
    }
    /* cejas */
    s += '<path class="brow" d="' + f.brow + '"/>';
    /* nariz + boca */
    s += '<ellipse class="nose" cx="50" cy="56" rx="5" ry="4"/>';
    s += '<path class="mouth" d="' + f.mouth + '"/>';
    if (f.blush) s += '<ellipse class="blush" cx="27" cy="60" rx="6" ry="4"/><ellipse class="blush" cx="73" cy="60" rx="6" ry="4"/>';
    if (f.tear) s += '<path class="tear" d="M38 53 q-3 6 0 9 q3 -3 0 -9 Z"/>';
    if (f.steam) s += '<path class="steam" d="M20 22 q4 -6 0 -11 M80 22 q-4 -6 0 -11"/>';
    s += "</svg>";
    return s;
  }

  /* ---------- 20 situaciones ----------
     Escenas de patio y de casa, no de cuento: el niño tiene que reconocerlas
     como suyas. Cada una lleva la emoción que se espera y la acción amable,
     porque los juegos 2 y 3 se alimentan de la misma tabla: la misma escena
     se le presenta dos veces con dos preguntas distintas ("qué siente" /
     "qué hago"), que es exactamente el salto que queremos que dé. */
  var SIT = [
    { ic: "🎂", es: "Es su cumpleaños y le cantan.",              en: "It's their birthday and everyone sings.",   f: "happy",
      hes: "Cantar con ellos",        hen: "Sing along",              wes: "Irme sin decir nada",     wen: "Walk away quietly" },
    { ic: "🧸", es: "Se le rompió su peluche favorito.",           en: "Their favourite plush toy tore.",           f: "sad",
      hes: "Darle un abrazo",         hen: "Give them a hug",         wes: "Reírme del peluche",      wen: "Laugh at the toy" },
    { ic: "🧱", es: "Alguien tiró su torre de bloques.",           en: "Someone knocked their block tower down.",   f: "angry",
      hes: "Ayudar a construirla otra vez", hen: "Help build it again", wes: "Tirar más bloques",     wen: "Knock more blocks over" },
    { ic: "⛈️", es: "Hay una tormenta muy fuerte.",                en: "There is a very loud storm.",               f: "scared",
      hes: "Quedarme a su lado",      hen: "Stay by their side",      wes: "Gritar para asustarle",   wen: "Shout to scare them" },
    { ic: "🎁", es: "Le llegó un regalo que no esperaba.",         en: "An unexpected gift arrived.",               f: "surp",
      hes: "Alegrarme con ella",      hen: "Be glad with them",       wes: "Pedirle el regalo",       wen: "Ask for the gift" },
    { ic: "🛌", es: "Está descansando en la hamaca.",              en: "They are resting in the hammock.",          f: "calm",
      hes: "Hablar bajito",           hen: "Talk quietly",            wes: "Despertarle de un salto", wen: "Wake them with a jump" },
    { ic: "⚽",       es: "Metió un gol con su equipo.",                 en: "They scored a goal with their team.",       f: "happy",
      hes: "Celebrar con ella",       hen: "Celebrate with them",     wes: "Decir que fue suerte",    wen: "Say it was just luck" },
    { ic: "🍦", es: "Se le cayó el helado al suelo.",              en: "Their ice cream fell on the floor.",        f: "sad",
      hes: "Compartir el mío",        hen: "Share mine",              wes: "Comerme el mío rápido",   wen: "Eat mine quickly" },
    { ic: "🧸", es: "Le quitaron el juguete de las manos.",        en: "Someone grabbed the toy from their hands.", f: "angry",
      hes: "Devolverle el juguete",   hen: "Give the toy back",       wes: "Esconder el juguete",     wen: "Hide the toy" },
    { ic: "🐕", es: "Un perro muy grande le ladró.",               en: "A very big dog barked at them.",            f: "scared",
      hes: "Darle la mano",           hen: "Hold their hand",         wes: "Empujarle hacia el perro", wen: "Push them toward the dog" },
    { ic: "🦋", es: "Una mariposa se posó en su nariz.",           en: "A butterfly landed on their nose.",         f: "surp",
      hes: "Mirar sin moverme",       hen: "Watch without moving",    wes: "Espantarla de un manotazo", wen: "Swat it away" },
    { ic: "📖", es: "Le están leyendo un cuento en la cama.",      en: "Someone is reading them a bedtime story.",  f: "calm",
      hes: "Escuchar en silencio",    hen: "Listen quietly",          wes: "Cambiar de página",       wen: "Flip the pages" },
    { ic: "🌈", es: "Salió el arcoíris después de la lluvia.",     en: "A rainbow came out after the rain.",        f: "happy",
      hes: "Enseñárselo a los demás", hen: "Show it to the others",   wes: "Taparle los ojos",        wen: "Cover their eyes" },
    { ic: "🚲", es: "Se cayó de la bicicleta y le duele.",         en: "They fell off the bike and it hurts.",      f: "sad",
      hes: "Buscar a un adulto",      hen: "Go find a grown-up",      wes: "Seguir jugando sin más",  wen: "Keep playing anyway" },
    { ic: "🎯", es: "Perdió el juego después de esforzarse.",      en: "They lost the game after trying hard.",     f: "angry",
      hes: "Decirle que lo hizo bien", hen: "Tell them they did well", wes: "Repetir que perdió",     wen: "Remind them they lost" },
    { ic: "🌑", es: "Se apagó la luz y está todo oscuro.",         en: "The light went out and it is all dark.",    f: "scared",
      hes: "Encender la linterna",    hen: "Turn on the flashlight",  wes: "Esconderme para asustar", wen: "Hide to scare them" },
    { ic: "🦆", es: "Un pato entró en el aula.",                   en: "A duck walked into the classroom.",         f: "surp",
      hes: "Avisar con calma",        hen: "Tell someone calmly",     wes: "Correr detrás gritando",  wen: "Run after it shouting" },
    { ic: "🌿", es: "Está regando las plantas del huerto.",        en: "They are watering the garden plants.",      f: "calm",
      hes: "Ayudar a regar",          hen: "Help with the watering",  wes: "Pisar las plantas",       wen: "Step on the plants" },
    { ic: "🤗", es: "Su amiga volvió de un viaje largo.",          en: "Their friend came back from a long trip.",  f: "happy",
      hes: "Salir a recibirla",       hen: "Go out to greet them",    wes: "Quedarme jugando solo",   wen: "Keep playing alone" },
    { ic: "🪩", es: "Nadie le dejó sitio en la mesa.",             en: "Nobody made room for them at the table.",   f: "sad",
      hes: "Hacerle un hueco",        hen: "Make room for them",      wes: "Poner mi mochila ahí",    wen: "Put my backpack there" }
  ];
  function sText(s) { return lang === "en" ? s.en : s.es; }
  function sHelp(s) { return lang === "en" ? s.hen : s.hes; }
  function sWrong(s) { return lang === "en" ? s.wen : s.wes; }

  var GAMES = [
    { id: "emo:face", kind: "face", mech: "tap",
      es: "¿Cómo se siente?", en: "How do they feel?",
      des: "Mira la cara y dime la emoción", den: "Look at the face and name the feeling" },
    { id: "emo:what", kind: "what", mech: "match",
      es: "¿Qué pasó?", en: "What happened?",
      des: "Qué siente en esta situación", den: "What they feel in this situation" },
    { id: "emo:help", kind: "help", mech: "tap",
      es: "¿Qué puedo hacer?", en: "What can I do?",
      des: "Elige la manera amable", den: "Pick the kind thing to do" },
    { id: "emo:breathe", kind: "breathe", mech: "drag",
      es: "Respira con Rufo", en: "Breathe with Rufo",
      des: "Un momento de calma", den: "A calm moment" }
  ];
  function gName(g) { return lang === "en" ? g.en : g.es; }
  function mechEmoji(m) {
    if (m === "tap") return String.fromCodePoint(0x1F446);
    if (m === "drag") return String.fromCodePoint(0x270B);
    if (m === "sort") return String.fromCodePoint(0x2195, 0xFE0F);
    if (m === "match") return String.fromCodePoint(0x1F517);
    return "";
  }

  /* ---------- tarjeta del home ----------
     Séptima casa. #54 puso tres columnas y #55 las confirmó con 3+3; con
     siete quedaría 3+3+1 y esa huérfana se lee como un error de maquetación.
     En vez de subir a cuatro columnas (que rompe el ancho de la ilustración
     en tablet) esta tarjeta ocupa la fila entera a propósito, como banda
     ancha. Además es la decisión de producto correcta: es la sección que
     queremos que el adulto vea primero. */
  function ensureCard() {
    var cards = d.querySelector("#home .cards");
    if (!cards || d.getElementById("pa58Card")) return;
    var b = el("button", "subject pa58-card");
    b.id = "pa58Card";
    b.setAttribute("data-game", "emotions");
    b.innerHTML = '<span class="blob"></span><span class="lv" id="pa58Lv"></span>' +
      '<span class="emoji">💚</span><span class="label" id="pa58Label"></span>';
    b.addEventListener("click", function () { detectLang(); openGames(); });
    cards.appendChild(b);
    paintCard();
  }
  function paintCard() {
    var lb = d.getElementById("pa58Label"), lv = d.getElementById("pa58Lv");
    if (lb) lb.textContent = T("Emociones", "Feelings");
    if (lv) {
      var tot = 0, i;
      for (i = 0; i < GAMES.length; i++) tot += unlocked(GAMES[i].id);
      lv.textContent = T("Nivel ", "Level ") + (Math.floor(tot / GAMES.length) + 1);
    }
  }

  /* ---------- overlay propio ---------- */
  var ov = null, hdT = null, body = null, backBtn = null;
  function ensureOv() {
    if (ov) return;
    ov = el("div", "pa58-ov");
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    var sheet = el("div", "pa34-sheet pa58-sheet");
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
    hdT.innerHTML = T("Emociones y Convivencia", "Feelings &amp; Friendship") +
      "<small>" + T("Elige un juego", "Choose a game") + "</small>";
    body.innerHTML = "";
    var grid = el("div", "pa34-games pa58-games");
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
    play = el("div", "pa58-play");
    play.innerHTML =
      '<div class="pa58-ptop"><button class="pa34-x" id="pa58pX" aria-label="Salir">&times;</button>' +
      '<div class="pa58-prompt" id="pa58prompt"></div>' +
      '<div class="pa58-pstar">' + String.fromCodePoint(0x2B50) + ' <span id="pa58score">0</span></div></div>' +
      '<div class="pa58-field" id="pa58field"></div>' +
      '<div class="pa58-pbot"><div class="pa58-prog" id="pa58prog"></div>' +
      '<button class="pa58-cta" id="pa58replay" aria-label="Repetir">🔁</button></div>' +
      '<div class="pa58-win" id="pa58win"><div class="pa58-wc">' +
      '<div class="rf">💚</div>' +
      '<h2 id="pa58wt"></h2><p id="pa58wp"></p>' +
      '<div class="row"><button class="pa58-cta ghost" id="pa58wmap"></button>' +
      '<button class="pa58-cta" id="pa58wnext"></button></div></div></div>';
    d.body.appendChild(play);
    P = {
      field: d.getElementById("pa58field"), prompt: d.getElementById("pa58prompt"),
      prog: d.getElementById("pa58prog"), score: d.getElementById("pa58score"),
      win: d.getElementById("pa58win"), wt: d.getElementById("pa58wt"),
      wp: d.getElementById("pa58wp"), wnext: d.getElementById("pa58wnext"),
      wmap: d.getElementById("pa58wmap"), replay: d.getElementById("pa58replay")
    };
    d.getElementById("pa58pX").addEventListener("click", exitPlay);
    P.replay.addEventListener("click", function () {
      if (!G) return;
      if (typeof G.replay === "function") G.replay();
      else if (G.prompt) say(G.prompt);
    });
    P.wmap.addEventListener("click", function () { exitPlay(); if (G && G.g) openLevels(G.g); });
    P.wnext.addEventListener("click", function () {
      var nx = G.level + 1;
      if (nx < 5) { launch(G.g, nx); } else { exitPlay(); openLevels(G.g); }
    });
  }
  function exitPlay() {
    if (play) play.classList.remove("show");
    if (P.win) P.win.classList.remove("show");
    stopBreath();
  }
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
    if (node) { node.classList.remove("pa58-reveal"); node.classList.add("pa58-ok"); }
    G.score++; P.score.textContent = G.score;
    // Economía de premios unificada con el modelo base (auditoría #8): cada
    // acierto suena, brilla en confeti y suma estrella, igual que un acierto
    // en matemáticas/letras/animales. chime()/confetti() son globales de
    // app.js (funciones de nivel superior en un script clásico), así que se
    // llaman directo sin reimplementarlas aquí.
    try { if (typeof window.chime === "function") window.chime("ok"); } catch (e) {}
    try { if (typeof window.confetti === "function") window.confetti(); } catch (e) {}
    star();
  }
  /* ---------- pista progresiva ----------
     Mismo contrato de dos pasos que onWrong() en app.js (1a falla: pista
     suave; 2a falla: brillo + narración de la respuesta), reimplementado
     localmente porque S/onWrong de app.js no son alcanzables desde aquí.
     La frase de emoción calca EXACTO la que ya usa #11 para su propia
     ronda de emociones ("Se siente <x>. Toca el que brilla."), así que
     tiene la mejor chance de coincidir con un clip ya horneado. */
  function resetHint(node) {
    if (G && G.hintNode) G.hintNode.classList.remove("pa58-reveal");
    G.attempts = 0; G.revealed = false; G.hintNode = node || null;
  }
  function bad(node, hintFn) {
    if (!node) return;
    node.classList.add("pa58-no");
    setTimeout(function () { node.classList.remove("pa58-no"); }, 480);
    if (!guideOn()) return;
    G.attempts = (G.attempts || 0) + 1;
    if (G.attempts === 1) { if (hintFn) hintFn(1); }
    else if (G.attempts >= 2 && G.hintNode && !G.revealed) {
      G.revealed = true;
      G.hintNode.classList.add("pa58-reveal");
      if (hintFn) hintFn(3);
    }
  }
  function emoHint(target) {
    return function (lvl) {
      if (lvl === 1) say(eName(target));
      else if (lvl === 3) say(T("Se siente " + eName(target).toLowerCase() + ". Toca el que brilla.", "It feels " + eName(target).toLowerCase() + ". Tap the glowing one."));
    };
  }
  function helpHint(rightText) {
    return function (lvl) {
      if (lvl === 1) say(T("Piensa en algo amable", "Think of something kind"));
      else if (lvl === 3) say(T(rightText + ". Toca el que brilla.", rightText + ". Tap the glowing one."));
    };
  }
  function stepDone() {
    G.done++; setProg();
    if (G.done >= G.total) setTimeout(winLevel, 640);
  }
  function winLevel() {
    setUnlocked(G.g.id, Math.min(4, G.level + 1));
    // La estrella ya se da por acierto en good() (economía unificada, #8):
    // el nivel solo desbloquea el siguiente, no regala una estrella extra,
    // igual que finishGame() en app.js no premia dos veces.
    P.wt.textContent = T("¡Muy bien!", "Great job!");
    P.wp.textContent = G.level < 4
      ? T("Completaste el nivel " + (G.level + 1), "You finished level " + (G.level + 1))
      : T("¡Terminaste todos los niveles!", "You finished every level!");
    P.wmap.textContent = T("Mapa", "Map");
    P.wnext.textContent = G.level < 4 ? T("Siguiente", "Next") : T("Mapa", "Map");
    P.win.classList.add("show");
    say(T("¡Muy bien!", "Great job!"));
  }

  function launch(g, level) {
    detectLang();
    closeOv();
    stopBreath();
    openPlay();
    G = { g: g, level: level, score: 0, done: 0, total: 0, prompt: "", replay: null, busy: false };
    P.score.textContent = "0";
    P.field.innerHTML = "";
    P.replay.style.display = "";
    if (g.kind === "face") roundFace();
    else if (g.kind === "what") roundWhat();
    else if (g.kind === "help") roundHelp();
    else roundBreathe();
  }

  /* Fichas de emoción: color + emoji + palabra. Las tres pistas a la vez
     porque el niño de 3 años todavía no lee: el color y el emoji sostienen,
     la palabra se aprende de tanto verla al lado. */
  function emoTiles(opts, onPick) {
    var wrap = el("div", "pa58-tiles");
    opts.forEach(function (o) {
      var b = el("button", "pa58-tile");
      b.setAttribute("data-emo", o.id);
      b.style.setProperty("--tc", o.c);
      b.innerHTML = '<span class="ic">' + o.emo + '</span><span class="nm">' + eName(o) + '</span>';
      b.addEventListener("click", function () { onPick(o, b); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  /* 1 · ¿Cómo se siente? — leer la cara.
     Sube el número de opciones antes que el de rondas: lo difícil no es
     mirar más caras, es descartar entre emociones parecidas (triste y
     enojado se confunden, y esa confusión es justo la que hay que romper). */
  var FACE_OPTS = [2, 3, 3, 4, 5];
  function roundFace() {
    G.total = 4 + Math.floor(G.level / 2);
    setProg();
    var stage = el("div", "pa58-stage");
    var tiles = el("div", "pa58-tilewrap");
    P.field.appendChild(stage); P.field.appendChild(tiles);
    next();
    function next() {
      var opts = sample(EMO, FACE_OPTS[G.level]);
      var target = opts[rnd(opts.length)];
      stage.innerHTML = faceSvg(target.id);
      stage.style.setProperty("--tc", target.c);
      stage.setAttribute("data-face", target.id);
      void stage.offsetWidth;
      stage.classList.add("in");
      setTimeout(function () { stage.classList.remove("in"); }, 620);
      G.replay = function () { setPrompt(G.prompt); };
      setPrompt(T("¿Cómo se siente?", "How do they feel?"));
      tiles.innerHTML = "";
      var hint = emoHint(target);
      tiles.appendChild(emoTiles(shuffle(opts), function (o, b) {
        if (G.busy) return;
        if (o.id === target.id) {
          G.busy = true; good(b); say(eName(target));
          stepDone();
          setTimeout(function () { G.busy = false; if (G.done < G.total) next(); }, 900);
        } else { bad(b, hint); }
      }));
      resetHint(tiles.querySelector('[data-emo="' + target.id + '"]'));
    }
  }

  /* 2 · ¿Qué pasó? — de la situación a la emoción.
     Es el salto de la cara al contexto: aquí ya no hay pista visual de la
     emoción, solo la escena. Por eso la cara aparece DESPUÉS de acertar,
     como confirmación: cierra el círculo con el juego 1. */
  function roundWhat() {
    G.total = 4 + Math.floor(G.level / 2);
    setProg();
    var card = el("div", "pa58-sit");
    var tiles = el("div", "pa58-tilewrap");
    P.field.appendChild(card); P.field.appendChild(tiles);
    var pool = shuffle(SIT), k = 0;
    next();
    function next() {
      var s = pool[k % pool.length]; k++;
      var right = byId(s.f);
      var wrong = sample(without(EMO, right), FACE_OPTS[G.level] - 1);
      var opts = shuffle(wrong.concat([right]));
      card.innerHTML = '<div class="ic">' + s.ic + '</div><div class="tx">' + sText(s) + "</div>" +
        '<div class="face"></div>';
      card.classList.remove("reveal");
      G.replay = function () { say(sText(s)); };
      setPrompt(T("¿Cómo se siente?", "How do they feel?"), false);
      say(sText(s));
      tiles.innerHTML = "";
      var hint = emoHint(right);
      tiles.appendChild(emoTiles(opts, function (o, b) {
        if (G.busy) return;
        if (o.id === right.id) {
          G.busy = true; good(b);
          var fw = card.querySelector(".face");
          if (fw) { fw.innerHTML = faceSvg(right.id); fw.style.setProperty("--tc", right.c); }
          card.classList.add("reveal");
          say(eName(right));
          stepDone();
          setTimeout(function () { G.busy = false; if (G.done < G.total) next(); }, 1100);
        } else { bad(b, hint); }
      }));
      resetHint(tiles.querySelector('[data-emo="' + right.id + '"]'));
    }
  }

  /* 3 · ¿Qué puedo hacer? — de la emoción a la conducta.
     Dos opciones siempre (amable / no amable) más rellenos de otras escenas
     en los niveles altos. El distractor nunca es cruel de verdad: es lo que
     un niño haría sin pensar, que es lo que estamos corrigiendo. */
  var HELP_OPTS = [2, 2, 3, 3, 4];
  function roundHelp() {
    G.total = 4 + Math.floor(G.level / 2);
    setProg();
    var card = el("div", "pa58-sit");
    var tiles = el("div", "pa58-acts");
    P.field.appendChild(card); P.field.appendChild(tiles);
    var pool = shuffle(SIT), k = 0;
    next();
    function next() {
      var s = pool[k % pool.length]; k++;
      var right = { t: sHelp(s), ok: true };
      var others = [{ t: sWrong(s), ok: false }];
      var extra = sample(SIT.filter(function (x) { return x !== s; }), Math.max(0, HELP_OPTS[G.level] - 2));
      extra.forEach(function (x) { others.push({ t: sWrong(x), ok: false }); });
      var opts = shuffle(others.concat([right]));
      var e = byId(s.f);
      card.innerHTML = '<div class="ic">' + s.ic + '</div><div class="tx">' + sText(s) + "</div>" +
        '<div class="face static"></div>';
      var fw = card.querySelector(".face");
      fw.innerHTML = faceSvg(e.id); fw.style.setProperty("--tc", e.c);
      card.classList.add("reveal");
      G.replay = function () { say(sText(s)); };
      setPrompt(T("¿Qué puedo hacer?", "What can I do?"), false);
      say(sText(s));
      tiles.innerHTML = "";
      var hint = helpHint(right.t);
      var targetNode = null;
      opts.forEach(function (o) {
        var b = el("button", "pa58-act", o.t);
        b.setAttribute("data-ok", o.ok ? "1" : "0");
        if (o.ok) targetNode = b;
        b.addEventListener("click", function () {
          if (G.busy) return;
          if (o.ok) {
            G.busy = true; good(b); say(T("¡Qué amable!", "So kind!"));
            stepDone();
            setTimeout(function () { G.busy = false; if (G.done < G.total) next(); }, 1000);
          } else { bad(b, hint); }
        });
        tiles.appendChild(b);
      });
      resetHint(targetNode);
    }
  }

  /* 4 · Respira con Rufo — la herramienta, no el juego.
     Aquí no se puede fallar: no hay acierto ni error, solo ciclos. Es
     deliberado. Un niño enfadado no necesita otro reto, necesita algo que
     le baje el pulso, y la respiración lenta es lo único con evidencia a
     esta edad. El círculo crece 4 s, sostiene 1 s y decrece 4 s; el peque
     solo tiene que seguirlo con la mano o mirarlo.
     El nivel no sube la dificultad —no la hay— sino el número de ciclos:
     2, 3, 4, 5, 6. Y el botón 🔁 se esconde porque no hay nada que repetir. */
  var BR_CYCLES = [2, 3, 4, 5, 6];
  var brTimer = null;
  function stopBreath() { if (brTimer) { clearTimeout(brTimer); brTimer = null; } }
  function roundBreathe(cycles, onEnd) {
    var n = cycles || BR_CYCLES[G.level];
    G.total = n;
    setProg();
    P.replay.style.display = "none";
    var stage = el("div", "pa58-breathe");
    stage.innerHTML = '<div class="ring r3"></div><div class="ring r2"></div>' +
      '<div class="ring r1"></div><div class="core" id="pa58core">' + faceSvg("calm") + "</div>";
    P.field.appendChild(stage);
    stage.style.setProperty("--tc", "#57C596");
    var skip = el("button", "pa58-cta ghost pa58-skip", T("Ya estoy bien", "I'm okay now"));
    skip.addEventListener("click", function () { stopBreath(); if (onEnd) { onEnd(); } else { exitPlay(); } });
    P.field.appendChild(skip);
    var i = 0;
    step();
    function step() {
      if (i >= n) {
        stopBreath();
        if (onEnd) { onEnd(); return; }
        setTimeout(winLevel, 400);
        return;
      }
      stage.className = "pa58-breathe in";
      setPrompt(T("Toma aire...", "Breathe in..."), true);
      brTimer = setTimeout(function () {
        stage.className = "pa58-breathe hold";
        setPrompt(T("Aguanta", "Hold"), true);
        brTimer = setTimeout(function () {
          stage.className = "pa58-breathe out";
          setPrompt(T("Suelta el aire...", "Breathe out..."), true);
          brTimer = setTimeout(function () {
            i++; G.done = i; setProg();
            step();
          }, 4000);
        }, 1000);
      }, 4000);
    }
  }

  /* Puerta pública para #05: cuando la telemetría detecta frustración, la
     app puede ofrecer la calma sin obligar a navegar hasta aquí. Tres
     ciclos, y al terminar vuelve exactamente a donde estaba. */
  window.pa58Breathe = function (cycles) {
    detectLang();
    ensurePlay();
    openPlay();
    G = { g: GAMES[3], level: 0, score: 0, done: 0, total: 0, prompt: "", replay: null, busy: false };
    P.score.textContent = "0";
    P.field.innerHTML = "";
    roundBreathe(cycles || 3, function () { exitPlay(); });
  };

  /* ---------- arranque ---------- */
  function boot() {
    detectLang();
    ensureCard();
    var lb = d.getElementById("langBtn");
    if (lb && !lb.__pa58) {
      lb.__pa58 = true;
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
    if (d.getElementById("pa58Card") || tries > 60) { paintCard(); clearInterval(iv); }
  }, 400);
  try {
    new MutationObserver(function () { ensureCard(); }).observe(d.body, { childList: true, subtree: true });
  } catch (e) {}
})();
