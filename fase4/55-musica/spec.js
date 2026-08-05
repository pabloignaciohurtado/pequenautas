/* ===== Fase 4 #55 · Sección "Música y Sonidos" =====

   La sexta materia. Las cinco anteriores entran por los ojos; esta entra
   por el oído, que a los 3-5 años es justo donde se juega la discriminación
   auditiva de la que luego cuelga la lectura (distinguir timbre, intensidad
   y altura es el mismo músculo que distingue /p/ de /b/).

   Corrección de rumbo (#57): esta sección nació sintetizando cada timbre
   con osciladores. Sonaba mal —un oscilador no suena a tambor, suena a
   electrodoméstico— así que todo el motor de síntesis se ha eliminado y el
   sonido de fondo lo pone ahora la cama de bosque de #57. Lo que queda
   aquí es la narración por voz, que se conserva porque a los 3-5 años el
   niño no lee y el enunciado hablado es su única instrucción.

   Eso obliga a algo que en realidad mejora los cuatro juegos: cada uno
   tiene que ser resoluble MIRANDO. Antes dos lo eran (la onda crece, las
   barras suben) y dos dependian del oído. Ahora los cuatro tienen pista
   visual honesta:
   - ¿Qué suena? pasa a ser onomatopeya: el enunciado escribe y dice el
     sonido ("PUM PUM") y el peque busca quién lo hace. Se sigue entrenando
     la asociación sonido-objeto, que era el objetivo, y encima se entrena
     vocabulario.
   - Agudo o grave dibuja la onda: apretada y con muchas crestas para el
     agudo, ancha y con pocas para el grave. Es la misma representación que
     verá en física dentro de diez años.
   Los tests tampoco dependen del audio.

   Sigue el patrón validado en #53 y #54:
   - overlay PROPIO (.pa55-ov): #40 hace querySelector(".pa34-ov").
   - por dentro reutiliza .pa34-sheet/.pa34-hd/.pa34-games y estampa
     data-pa34-game, así hereda gratis el papercraft de #52.
   - la tarjeta se inyecta después de que app.js enganche las .subject,
     así que se queda con su clic entero.

   Aditivo: no toca app.js, ni index.html, ni STORE_KEY. */
(function () {
  "use strict";
  if (window.__pa55) return;
  window.__pa55 = true;

  // Progreso por perfil (auditoría #7): PKEY() lleva el id del niño activo
  // y migra() copia+borra una única vez la llave vieja de dispositivo.
  var PKEY_BASE = "pequenautas.f4.musica.v1";
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

  /* ---------- ya no hay motor de sonido ----------
     Aquí vivían el AudioContext perezoso, el oscilador, el ruido filtrado y
     las cinco "voces" de instrumento. Se han borrado a conciencia: el eco
     visual que las acompañaba era en realidad lo único que sostenía el
     juego, así que ahora es lo único que hay. El fondo sonoro lo pone #57. */
  var INSTR = [
    { id: "drum", es: "Tambor", en: "Drum", emo: "🥁", ono: "PUM PUM", onoEn: "BOOM BOOM" },
    { id: "flute", es: "Flauta", en: "Flute", emo: "🎶", ono: "TU-TUUU", onoEn: "TOO-TOOO" },
    { id: "bell", es: "Campana", en: "Bell", emo: "🔔", ono: "TILÍN TILÍN", onoEn: "DING DONG" },
    { id: "maraca", es: "Maracas", en: "Maracas", emo: "🪇", ono: "CHIS CHIS", onoEn: "SHAKE SHAKE" },
    { id: "xylo", es: "Xilófono", en: "Xylophone", emo: "🎹", ono: "TIN TIN TIN", onoEn: "TING TING TING" }
  ];
  function iName(o) { return lang === "en" ? o.en : o.es; }
  function iOno(o) { return lang === "en" ? o.onoEn : o.ono; }

  /* Eco visual: cualquier cosa que suene, late. Es lo que sostiene el juego
     con el volumen apagado. */
  function pulse(node) {
    if (!node) return;
    node.classList.remove("pa55-ring");
    void node.offsetWidth;
    node.classList.add("pa55-ring");
    setTimeout(function () { node.classList.remove("pa55-ring"); }, 620);
  }

  var GAMES = [
    { id: "music:instr", kind: "instr", mech: "tap",
      es: "¿Qué suena?", en: "What's playing?",
      des: "Escucha y toca el instrumento", den: "Listen and tap the instrument" },
    { id: "music:echo", kind: "echo", mech: "match",
      es: "Repite la melodía", en: "Repeat the tune",
      des: "Toca las notas en el mismo orden", den: "Tap the notes in the same order" },
    { id: "music:loud", kind: "loud", mech: "tap",
      es: "Fuerte o suave", en: "Loud or soft",
      des: "Mira la onda y di si es fuerte o suave", den: "Watch the wave and tell if it is loud or soft" },
    { id: "music:pitch", kind: "pitch", mech: "sort",
      es: "Agudo o grave", en: "High or low",
      des: "Ordena los sonidos del grave al agudo", den: "Sort the sounds from low to high" }
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
    if (!cards || d.getElementById("pa55Card")) return;
    var b = el("button", "subject pa55-card");
    b.id = "pa55Card";
    b.setAttribute("data-game", "music");
    b.innerHTML = '<span class="blob"></span><span class="lv" id="pa55Lv"></span>' +
      '<span class="emoji">🎵</span><span class="label" id="pa55Label"></span>';
    b.addEventListener("click", function () { detectLang(); openGames(); });
    cards.appendChild(b);
    paintCard();
  }
  function paintCard() {
    var lb = d.getElementById("pa55Label"), lv = d.getElementById("pa55Lv");
    if (lb) lb.textContent = T("Música", "Music");
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
    ov = el("div", "pa55-ov");
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    var sheet = el("div", "pa34-sheet pa55-sheet");
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
    hdT.innerHTML = T("Música y Sonidos", "Music &amp; Sounds") +
      "<small>" + T("Elige un juego", "Choose a game") + "</small>";
    body.innerHTML = "";
    var grid = el("div", "pa34-games pa55-games");
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
    play = el("div", "pa55-play");
    play.innerHTML =
      '<div class="pa55-ptop"><button class="pa34-x" id="pa55pX" aria-label="Salir">&times;</button>' +
      '<div class="pa55-prompt" id="pa55prompt"></div>' +
      '<div class="pa55-pstar">' + String.fromCodePoint(0x2B50) + ' <span id="pa55score">0</span></div></div>' +
      '<div class="pa55-field" id="pa55field"></div>' +
      '<div class="pa55-pbot"><div class="pa55-prog" id="pa55prog"></div>' +
      '<button class="pa55-cta" id="pa55replay" aria-label="Repetir">🔁</button></div>' +
      '<div class="pa55-win" id="pa55win"><div class="pa55-wc">' +
      '<div class="rf">🎶</div>' +
      '<h2 id="pa55wt"></h2><p id="pa55wp"></p>' +
      '<div class="row"><button class="pa55-cta ghost" id="pa55wmap"></button>' +
      '<button class="pa55-cta" id="pa55wnext"></button></div></div></div>';
    d.body.appendChild(play);
    P = {
      field: d.getElementById("pa55field"), prompt: d.getElementById("pa55prompt"),
      prog: d.getElementById("pa55prog"), score: d.getElementById("pa55score"),
      win: d.getElementById("pa55win"), wt: d.getElementById("pa55wt"),
      wp: d.getElementById("pa55wp"), wnext: d.getElementById("pa55wnext"),
      wmap: d.getElementById("pa55wmap"), replay: d.getElementById("pa55replay")
    };
    d.getElementById("pa55pX").addEventListener("click", exitPlay);
    /* El botón 🔊 es el corazón de esta sección: aquí no repite el enunciado
       hablado sino el SONIDO del reto, que es lo que hay que descifrar.
       Sin él un despiste obligaría a fallar. */
    P.replay.addEventListener("click", function () {
      if (!G) return;
      if (typeof G.replay === "function") G.replay();
      else if (G.prompt) say(G.prompt);
    });
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
    if (node) { node.classList.remove("pa55-reveal"); node.classList.add("pa55-ok"); }
    G.score++; P.score.textContent = G.score;
  }
  /* ---------- pista progresiva ----------
     Mismo contrato de dos pasos que onWrong() en app.js (1a falla: pista
     suave; 2a falla: brillo + narración de la respuesta), reimplementado
     localmente porque S/onWrong de app.js no son alcanzables desde aquí.
     Las frases usan la misma yuxtaposición "<Etiqueta>. Toca el que
     brilla." que ya graba el catálogo de voz para números y formas, en vez
     de "Es X" — evita decidir género/artículo para nombres de instrumento
     que no lo tienen claro (Maracas, Xilófono). */
  function resetHint(node) {
    if (G && G.hintNode) G.hintNode.classList.remove("pa55-reveal");
    G.attempts = 0; G.revealed = false; G.hintNode = node || null;
  }
  function bad(node, hintFn) {
    if (!node) return;
    node.classList.add("pa55-no");
    setTimeout(function () { node.classList.remove("pa55-no"); }, 480);
    if (!guideOn()) return;
    G.attempts = (G.attempts || 0) + 1;
    if (G.attempts === 1) { if (hintFn) hintFn(1); }
    else if (G.attempts >= 2 && G.hintNode && !G.revealed) {
      G.revealed = true;
      G.hintNode.classList.add("pa55-reveal");
      if (hintFn) hintFn(3);
    }
  }
  function labelHint(labelEs, labelEn) {
    return function (lvl) {
      if (lvl === 1) say(T(labelEs, labelEn));
      else if (lvl === 3) say(T(labelEs + ". Toca el que brilla.", labelEn + ". Tap the glowing one."));
    };
  }
  function stepDone() {
    G.done++; setProg();
    if (G.done >= G.total) setTimeout(winLevel, 640);
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

  function launch(g, level) {
    detectLang();
    closeOv();
    openPlay();
    G = { g: g, level: level, score: 0, done: 0, total: 0, prompt: "", replay: null, busy: false };
    P.score.textContent = "0";
    P.field.innerHTML = "";
    if (g.kind === "instr") roundInstr();
    else if (g.kind === "echo") roundEcho();
    else if (g.kind === "loud") roundLoud();
    else roundPitch();
  }

  /* 1 · ¿Qué suena? — asociación sonido-objeto por onomatopeya.
     El enunciado escribe y dice el sonido ("PUM PUM") y el peque busca
     quién lo hace. Sube el número de opciones antes que el de rondas: lo
     que cuesta no es oír más veces el enunciado, es descartar entre más
     candidatos. Y a diferencia de la versión anterior se puede jugar con el
     móvil en silencio, que es como está casi siempre. */
  var INSTR_OPTS = [2, 3, 3, 4, 5];
  function roundInstr() {
    G.total = 4 + Math.floor(G.level / 2);
    setProg();
    var wrap = el("div", "pa55-tiles");
    P.field.appendChild(wrap);
    next();
    function next() {
      wrap.innerHTML = "";
      var opts = sample(INSTR, INSTR_OPTS[G.level]);
      var target = opts[rnd(opts.length)];
      var ono = iOno(target);
      function promptTxt() { return T("¿Quién hace " + ono + "?", "Who goes " + ono + "?"); }
      P.prompt.setAttribute("data-ono", ono);
      G.replay = function () { setPrompt(promptTxt()); pulse(P.prompt); };
      setPrompt(promptTxt());
      var targetNode = null;
      var hint = labelHint(target.es, target.en);
      opts.forEach(function (o) {
        var b = el("button", "pa55-tile");
        b.setAttribute("data-instr", o.id);
        b.innerHTML = '<span class="ic">' + o.emo + '</span><span class="nm">' + iName(o) + '</span>';
        if (o.id === target.id) targetNode = b;
        b.addEventListener("click", function () {
          if (G.busy) return;
          pulse(b);
          if (o.id === target.id) {
            G.busy = true;
            good(b);
            stepDone();
            setTimeout(function () { G.busy = false; if (G.done < G.total) next(); }, 900);
          } else { bad(b, hint); }
        });
        wrap.appendChild(b);
      });
      resetHint(targetNode);
    }
  }

  /* 2 · Repite la melodía — memoria secuencial (Simon).
     Un error NO resta progreso: repite la misma secuencia. A esta edad el
     castigo por fallar apaga las ganas mucho antes que el aburrimiento. */
  var PADS = [
    { f: 523, cls: "p1", emo: "🌿" },
    { f: 659, cls: "p2", emo: "🍄" },
    { f: 784, cls: "p3", emo: "🌻" },
    { f: 988, cls: "p4", emo: "🦋" }
  ];
  var ECHO_LEN = [2, 3, 4, 4, 5];
  function roundEcho() {
    G.total = 3 + Math.floor(G.level / 2);
    setProg();
    var wrap = el("div", "pa55-pads");
    var nodes = [];
    PADS.forEach(function (p, i) {
      var b = el("button", "pa55-pad " + p.cls, '<span>' + p.emo + '</span>');
      b.addEventListener("click", function () { hit(i, b); });
      wrap.appendChild(b); nodes.push(b);
    });
    P.field.appendChild(wrap);
    var seq = [], at = 0;
    // La pista suave YA existe en este juego (fallar reproduce la melodía
    // entera de nuevo, que es justo el andamiaje que un juego de memoria
    // puede dar sin regalar la respuesta). La escalada de #55 solo añade el
    // paso 2: si sigue sin acertar la primera nota tras el repaso, esa nota
    // brilla — nunca revela más de una nota a la vez, así el juego sigue
    // siendo de memoria y no de búsqueda visual.
    var echoHint = function (lvl) {
      if (lvl === 3) say(T("Empieza aquí. Toca el que brilla.", "Start here. Tap the glowing one."));
    };
    newSeq();
    function newSeq() {
      var n = ECHO_LEN[G.level], i;
      seq = []; for (i = 0; i < n; i++) seq.push(rnd(PADS.length));
      at = 0;
      setPrompt(T("Escucha y repite", "Listen and repeat"));
      G.replay = playSeq;
      resetHint(nodes[seq[0]]);
      setTimeout(playSeq, 560);
    }
    function playSeq() {
      G.busy = true;
      seq.forEach(function (idx, k) {
        setTimeout(function () {
          pulse(nodes[idx]);
          if (k === seq.length - 1) setTimeout(function () { G.busy = false; }, 420);
        }, k * 520);
      });
    }
    function hit(i, node) {
      if (G.busy) return;
      pulse(node);
      if (i === seq[at]) {
        node.classList.remove("pa55-reveal");
        at++;
        if (at >= seq.length) {
          G.busy = true; good(node); stepDone();
          setTimeout(function () {
            node.classList.remove("pa55-ok");
            G.busy = false; if (G.done < G.total) newSeq();
          }, 900);
        }
      } else {
        bad(node, echoHint); at = 0;
        setTimeout(playSeq, 700);
      }
    }
  }

  /* 3 · Fuerte o suave — intensidad.
     El tamaño del dibujo acompaña al volumen para que la palabra "fuerte"
     tenga un anclaje visual; sin él, la pareja fuerte/suave se confunde con
     agudo/grave, que es el error clásico a esta edad. */
  function roundLoud() {
    G.total = 5;
    setProg();
    var stage = el("div", "pa55-stage");
    var wave = el("div", "pa55-wave", '<span></span><span></span><span></span>');
    stage.appendChild(wave);
    var row = el("div", "pa55-tiles");
    P.field.appendChild(stage); P.field.appendChild(row);
    var OPTS = [
      { k: "loud", es: "Fuerte", en: "Loud", emo: "🔊" },
      { k: "soft", es: "Suave", en: "Soft", emo: "🔈" }
    ];
    var target = "loud";
    var nodeByK = {};
    var hint = null;
    OPTS.forEach(function (o) {
      var b = el("button", "pa55-tile");
      b.innerHTML = '<span class="ic">' + o.emo + '</span><span class="nm">' + (lang === "en" ? o.en : o.es) + '</span>';
      nodeByK[o.k] = b;
      b.addEventListener("click", function () {
        if (G.busy) return;
        if (o.k === target) {
          G.busy = true; good(b); stepDone();
          setTimeout(function () { b.classList.remove("pa55-ok"); G.busy = false; if (G.done < G.total) next(); }, 900);
        } else { bad(b, hint); }
      });
      row.appendChild(b);
    });
    next();
    function next() {
      target = rnd(2) ? "loud" : "soft";
      G.replay = function () { setPrompt(G.prompt); fire(); };
      // la pregunta usa las MISMAS palabras que los botones: pedir "grande o
      // pequeña" y ofrecer "Fuerte / Suave" era obligar al niño a hacer solo
      // el mapeo que este juego existe para enseñar
      setPrompt(T("¿La onda es fuerte o suave?", "Is the wave loud or soft?"));
      var opt = target === "loud" ? OPTS[0] : OPTS[1];
      hint = labelHint(opt.es, opt.en);
      resetHint(nodeByK[target]);
      setTimeout(fire, 620);
      function fire() {
        wave.className = "pa55-wave " + (target === "loud" ? "big" : "small");
        void wave.offsetWidth;
        wave.classList.add("go");
        setTimeout(function () { wave.classList.remove("go"); }, 900);
      }
    }
  }

  /* 4 · Agudo o grave — altura.
     Dos niveles de dificultad reales dentro del mismo juego: primero decidir
     entre dos (grave = oso abajo, agudo = pájaro arriba) y luego ORDENAR
     tres notas de grave a agudo, que ya es construir una escala mental. */
  var LOWHI = [
    { k: "low", es: "Grave", en: "Low", emo: "🐻" },
    { k: "high", es: "Agudo", en: "High", emo: "🐦" }
  ];

  /* La onda dibujada. Pocas crestas y anchas = grave; muchas y apretadas =
     agudo. No es un adorno: es la representación con la que se va a
     encontrar toda su vida, y aquí la aprende de golpe con el animal al
     lado (oso abajo, pájaro arriba). */
  function sigSvg(cycles) {
    var w = 240, h = 64, mid = h / 2, amp = h / 2 - 7, pts = [], i, steps = 120;
    for (i = 0; i <= steps; i++) {
      var x = (w * i) / steps;
      pts.push(x.toFixed(1) + "," + (mid - amp * Math.sin((2 * Math.PI * cycles * i) / steps)).toFixed(1));
    }
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="' + pts.join(" ") + '" /></svg>';
  }
  var SCALE = [262, 330, 392, 523, 659, 784];
  function roundPitch() {
    G.total = 5;
    setProg();
    if (G.level < 2) pairMode(); else sortMode();

    function pairMode() {
      var stage = el("div", "pa55-sig");
      P.field.appendChild(stage);
      var row = el("div", "pa55-tiles");
      P.field.appendChild(row);
      var target = "low";
      var nodeByK = {};
      var hint = null;
      LOWHI.forEach(function (o) {
        var b = el("button", "pa55-tile");
        b.innerHTML = '<span class="ic">' + o.emo + '</span><span class="nm">' + (lang === "en" ? o.en : o.es) + '</span>';
        nodeByK[o.k] = b;
        b.addEventListener("click", function () {
          if (G.busy) return;
          pulse(b);
          if (o.k === target) {
            G.busy = true; good(b); stepDone();
            setTimeout(function () { b.classList.remove("pa55-ok"); G.busy = false; if (G.done < G.total) next(); }, 900);
          } else { bad(b, hint); }
        });
        row.appendChild(b);
      });
      next();
      function next() {
        target = rnd(2) ? "low" : "high";
        var cycles = target === "low" ? (1 + rnd(2)) : (9 + rnd(5));
        G.replay = function () { setPrompt(G.prompt); fire(); };
        setPrompt(T("¿Esta onda es aguda o grave?", "Is this wave high or low?"));
        var opt = target === "low" ? LOWHI[0] : LOWHI[1];
        hint = labelHint(opt.es, opt.en);
        resetHint(nodeByK[target]);
        fire();
        function fire() {
          stage.setAttribute("data-cy", String(cycles));
          stage.className = "pa55-sig " + (target === "low" ? "low" : "high");
          stage.innerHTML = sigSvg(cycles);
          void stage.offsetWidth;
          stage.classList.add("go");
          setTimeout(function () { stage.classList.remove("go"); }, 900);
        }
      }
    }

    function sortMode() {
      var n = G.level === 2 ? 3 : (G.level === 3 ? 3 : 4);
      var wrap = el("div", "pa55-notes");
      P.field.appendChild(wrap);
      var order = [], picked = 0;
      next();
      function next() {
        wrap.innerHTML = "";
        picked = 0;
        var freqs = sample(SCALE, n).sort(function (a, b) { return a - b; });
        order = shuffle(freqs.slice());
        /* el repaso recorre las barras en el orden correcto encendiéndolas
           una a una: es la misma ayuda que daba el arpegio, pero visible. */
        G.replay = function () {
          freqs.forEach(function (f, i) {
            setTimeout(function () { pulse(wrap.querySelector('.pa55-note[data-f="' + f + '"]')); }, i * 380);
          });
        };
        setPrompt(T("Toca del más grave al más agudo", "Tap from lowest to highest"));
        var nodeByF = {};
        var sortHint = function (lvl) {
          if (lvl === 3) say(T("Toca el que brilla.", "Tap the glowing one."));
        };
        order.forEach(function (f) {
          var b = el("button", "pa55-note");
          b.innerHTML = '<span class="bar" style="height:' + (28 + Math.round((f - 240) / 6)) + 'px"></span>';
          b.setAttribute("data-f", String(f));
          nodeByF[f] = b;
          b.addEventListener("click", function () {
            if (G.busy || b.classList.contains("pa55-ok")) return;
            pulse(b);
            if (f === freqs[picked]) {
              picked++; b.classList.remove("pa55-reveal"); b.classList.add("pa55-ok");
              if (picked >= freqs.length) {
                G.busy = true; G.score++; P.score.textContent = G.score; stepDone();
                setTimeout(function () { G.busy = false; if (G.done < G.total) next(); }, 900);
              } else {
                resetHint(nodeByF[freqs[picked]]);
              }
            } else { bad(b, sortHint); }
          });
          wrap.appendChild(b);
        });
        resetHint(nodeByF[freqs[picked]]);
        setTimeout(G.replay, 560);
      }
    }
  }

  /* ---------- arranque ---------- */
  function boot() {
    detectLang();
    ensureCard();
    var lb = d.getElementById("langBtn");
    if (lb && !lb.__pa55) {
      lb.__pa55 = true;
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
    if (d.getElementById("pa55Card") || tries > 60) { paintCard(); clearInterval(iv); }
  }, 400);
  try {
    new MutationObserver(function () { ensureCard(); }).observe(d.body, { childList: true, subtree: true });
  } catch (e) {}
})();
