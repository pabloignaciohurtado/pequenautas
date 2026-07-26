/* ===== Fase 4 #55 · Sección "Música y Sonidos" =====

   La sexta materia. Las cinco anteriores entran por los ojos; esta entra
   por el oído, que a los 3-5 años es justo donde se juega la discriminación
   auditiva de la que luego cuelga la lectura (distinguir timbre, intensidad
   y altura es el mismo músculo que distingue /p/ de /b/).

   Decisión técnica de fondo: TODO el sonido se sintetiza en vivo con
   WebAudio. No se sube ni un solo archivo de audio. Tres razones, y las
   tres importan para este proyecto:
   - el repo no admite binarios por el canal por el que se sube,
   - la app es offline-first: un sonido generado siempre está disponible,
     no depende de precache ni pesa un byte en el Service Worker,
   - un oscilador es afinable, así que "agudo/grave" es exacto por
     construcción y no depende de qué muestra se grabó.

   Y una decisión de accesibilidad que condiciona todo el diseño: ningún
   juego puede depender SOLO del sonido. Cada sonido va acompañado de una
   animación visible (la ficha late, la onda crece), de modo que un peque
   con el volumen apagado —o con el móvil en silencio, que es lo normal—
   sigue viendo qué está pasando. Los tests tampoco dependen del audio.

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

  var PKEY = "pequenautas.f4.musica.v1";
  function loadP() { try { return JSON.parse(localStorage.getItem(PKEY) || "{}") || {}; } catch (e) { return {}; } }
  function saveP(o) { try { localStorage.setItem(PKEY, JSON.stringify(o)); } catch (e) {} }
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

  /* ---------- motor de sonido ----------
     El AudioContext SOLO puede nacer dentro de un gesto del usuario (iOS lo
     exige y Chrome lo recomienda), por eso se crea perezosamente en el
     primer toque y nunca en el arranque del módulo. Si el navegador no
     tiene WebAudio, todas las funciones son no-ops silenciosos: los juegos
     siguen siendo jugables porque cada sonido tiene su eco visual. */
  var AC = null;
  function ac() {
    try {
      if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); }
      if (AC && AC.state === "suspended" && AC.resume) AC.resume();
    } catch (e) { AC = null; }
    return AC;
  }
  function tone(o) {
    var c = ac(); if (!c) return;
    try {
      var t0 = c.currentTime + (o.at || 0), dur = o.dur || 0.4, v = (o.vol == null ? 0.22 : o.vol);
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(o.f || 440, t0);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + (o.atk || 0.012));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.06);
    } catch (e) {}
  }
  function hiss(o) {
    var c = ac(); if (!c) return;
    try {
      var dur = o.dur || 0.16, t0 = c.currentTime + (o.at || 0);
      var n = Math.max(1, Math.floor(c.sampleRate * dur));
      var buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0), i;
      for (i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = c.createBufferSource(); src.buffer = buf;
      var f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = o.f || 3000; f.Q.value = 0.9;
      var g = c.createGain(); g.gain.value = (o.vol == null ? 0.18 : o.vol);
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(t0);
    } catch (e) {}
  }

  /* Cinco voces reconocibles. No imitan al instrumento real: imitan lo que
     un peque cree que suena como ese instrumento, que es lo que hace que
     acierte. */
  var VOICES = {
    drum: function () { tone({ type: "sine", f: 170, slide: 55, dur: 0.26, vol: 0.34 }); hiss({ f: 900, dur: 0.09, vol: 0.10 }); },
    flute: function () { tone({ type: "sine", f: 784, dur: 0.72, vol: 0.16, atk: 0.10 }); tone({ type: "sine", f: 1568, dur: 0.55, vol: 0.03, atk: 0.12 }); },
    bell: function () { tone({ type: "triangle", f: 1046, dur: 1.10, vol: 0.16 }); tone({ type: "triangle", f: 2637, dur: 0.75, vol: 0.06 }); },
    maraca: function () { hiss({ f: 5200, dur: 0.10, vol: 0.16 }); hiss({ at: 0.16, f: 5200, dur: 0.08, vol: 0.12 }); hiss({ at: 0.30, f: 5200, dur: 0.10, vol: 0.15 }); },
    xylo: function () { tone({ type: "triangle", f: 1318, dur: 0.34, vol: 0.20 }); tone({ type: "sine", f: 2637, dur: 0.16, vol: 0.05 }); }
  };
  var INSTR = [
    { id: "drum", es: "Tambor", en: "Drum", emo: "🥁" },
    { id: "flute", es: "Flauta", en: "Flute", emo: "🎶" },
    { id: "bell", es: "Campana", en: "Bell", emo: "🔔" },
    { id: "maraca", es: "Maracas", en: "Maracas", emo: "🪇" },
    { id: "xylo", es: "Xilófono", en: "Xylophone", emo: "🎹" }
  ];
  function iName(o) { return lang === "en" ? o.en : o.es; }
  function playVoice(id) { try { (VOICES[id] || VOICES.bell)(); } catch (e) {} }

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
    { id: "music:loud", kind: "loud", mech: "drag",
      es: "Fuerte o suave", en: "Loud or soft",
      des: "Di si el sonido fue fuerte o suave", den: "Tell if the sound was loud or soft" },
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
    b.addEventListener("click", function () { detectLang(); ac(); openGames(); });
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
      b.addEventListener("click", function () { ac(); openLevels(g); });
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
      '<button class="pa55-cta" id="pa55replay" aria-label="Repetir">🔊</button></div>' +
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
    if (node) node.classList.add("pa55-ok");
    G.score++; P.score.textContent = G.score;
  }
  function bad(node) {
    if (!node) return;
    node.classList.add("pa55-no");
    setTimeout(function () { node.classList.remove("pa55-no"); }, 480);
    tone({ type: "sine", f: 300, slide: 200, dur: 0.22, vol: 0.12 });
  }
  function stepDone() {
    G.done++; setProg();
    if (G.done >= G.total) setTimeout(winLevel, 640);
  }
  function winLevel() {
    setUnlocked(G.g.id, Math.min(4, G.level + 1));
    star();
    /* arpegio de victoria: do-mi-sol-do */
    var notes = [523, 659, 784, 1046], i;
    for (i = 0; i < notes.length; i++) tone({ type: "triangle", f: notes[i], at: i * 0.12, dur: 0.42, vol: 0.16 });
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
    ac();
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

  /* 1 · ¿Qué suena? — timbre.
     Sube el número de opciones antes que el de rondas: lo que cuesta no es
     escuchar más veces, es descartar entre más candidatos parecidos. */
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
      G.replay = function () { playVoice(target.id); pulse(d.querySelector(".pa55-tile[data-hit='1']") || wrap); };
      setPrompt(T("¿Qué instrumento suena?", "Which instrument is playing?"));
      opts.forEach(function (o) {
        var b = el("button", "pa55-tile");
        b.innerHTML = '<span class="ic">' + o.emo + '</span><span class="nm">' + iName(o) + '</span>';
        b.addEventListener("click", function () {
          if (G.busy) return;
          playVoice(o.id); pulse(b);
          if (o.id === target.id) {
            G.busy = true;
            good(b);
            stepDone();
            setTimeout(function () { G.busy = false; if (G.done < G.total) next(); }, 900);
          } else { bad(b); }
        });
        wrap.appendChild(b);
      });
      setTimeout(function () { playVoice(target.id); }, 620);
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
    newSeq();
    function newSeq() {
      var n = ECHO_LEN[G.level], i;
      seq = []; for (i = 0; i < n; i++) seq.push(rnd(PADS.length));
      at = 0;
      setPrompt(T("Escucha y repite", "Listen and repeat"));
      G.replay = playSeq;
      setTimeout(playSeq, 560);
    }
    function playSeq() {
      G.busy = true;
      seq.forEach(function (idx, k) {
        setTimeout(function () {
          tone({ type: "triangle", f: PADS[idx].f, dur: 0.38, vol: 0.20 });
          pulse(nodes[idx]);
          if (k === seq.length - 1) setTimeout(function () { G.busy = false; }, 420);
        }, k * 520);
      });
    }
    function hit(i, node) {
      if (G.busy) return;
      tone({ type: "triangle", f: PADS[i].f, dur: 0.34, vol: 0.20 });
      pulse(node);
      if (i === seq[at]) {
        at++;
        if (at >= seq.length) {
          G.busy = true; good(node); stepDone();
          setTimeout(function () {
            node.classList.remove("pa55-ok");
            G.busy = false; if (G.done < G.total) newSeq();
          }, 900);
        }
      } else {
        bad(node); at = 0;
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
    OPTS.forEach(function (o) {
      var b = el("button", "pa55-tile");
      b.innerHTML = '<span class="ic">' + o.emo + '</span><span class="nm">' + (lang === "en" ? o.en : o.es) + '</span>';
      b.addEventListener("click", function () {
        if (G.busy) return;
        if (o.k === target) {
          G.busy = true; good(b); stepDone();
          setTimeout(function () { b.classList.remove("pa55-ok"); G.busy = false; if (G.done < G.total) next(); }, 900);
        } else { bad(b); }
      });
      row.appendChild(b);
    });
    next();
    function next() {
      target = rnd(2) ? "loud" : "soft";
      var inst = INSTR[rnd(INSTR.length)];
      G.replay = fire;
      setPrompt(T("¿Sonó fuerte o suave?", "Was it loud or soft?"));
      setTimeout(fire, 620);
      function fire() {
        wave.className = "pa55-wave " + (target === "loud" ? "big" : "small");
        void wave.offsetWidth;
        wave.classList.add("go");
        setTimeout(function () { wave.classList.remove("go"); }, 900);
        var f = { drum: 170, flute: 784, bell: 1046, maraca: 5200, xylo: 1318 }[inst.id] || 660;
        if (inst.id === "maraca") hiss({ f: f, dur: 0.22, vol: target === "loud" ? 0.24 : 0.04 });
        else tone({ type: "triangle", f: f, dur: 0.5, vol: target === "loud" ? 0.34 : 0.05 });
      }
    }
  }

  /* 4 · Agudo o grave — altura.
     Dos niveles de dificultad reales dentro del mismo juego: primero decidir
     entre dos (grave = oso abajo, agudo = pájaro arriba) y luego ORDENAR
     tres notas de grave a agudo, que ya es construir una escala mental. */
  var LOWHI = [
    { k: "low", f: 147, es: "Grave", en: "Low", emo: "🐻" },
    { k: "high", f: 1318, es: "Agudo", en: "High", emo: "🐦" }
  ];
  var SCALE = [262, 330, 392, 523, 659, 784];
  function roundPitch() {
    G.total = 5;
    setProg();
    if (G.level < 2) pairMode(); else sortMode();

    function pairMode() {
      var row = el("div", "pa55-tiles");
      P.field.appendChild(row);
      var target = "low";
      LOWHI.forEach(function (o) {
        var b = el("button", "pa55-tile");
        b.innerHTML = '<span class="ic">' + o.emo + '</span><span class="nm">' + (lang === "en" ? o.en : o.es) + '</span>';
        b.addEventListener("click", function () {
          if (G.busy) return;
          tone({ type: "sine", f: o.f, dur: 0.42, vol: 0.20 }); pulse(b);
          if (o.k === target) {
            G.busy = true; good(b); stepDone();
            setTimeout(function () { b.classList.remove("pa55-ok"); G.busy = false; if (G.done < G.total) next(); }, 900);
          } else { bad(b); }
        });
        row.appendChild(b);
      });
      next();
      function next() {
        target = rnd(2) ? "low" : "high";
        var f = target === "low" ? (110 + rnd(60)) : (1100 + rnd(700));
        G.replay = fire;
        setPrompt(T("¿Sonó agudo o grave?", "Was it high or low?"));
        setTimeout(fire, 620);
        function fire() { tone({ type: "sine", f: f, dur: 0.62, vol: 0.22 }); }
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
        G.replay = function () { freqs.forEach(function (f, i) { setTimeout(function () { tone({ type: "sine", f: f, dur: 0.36, vol: 0.20 }); }, i * 380); }); };
        setPrompt(T("Toca del más grave al más agudo", "Tap from lowest to highest"));
        order.forEach(function (f) {
          var b = el("button", "pa55-note");
          b.innerHTML = '<span class="bar" style="height:' + (28 + Math.round((f - 240) / 6)) + 'px"></span>';
          b.setAttribute("data-f", String(f));
          b.addEventListener("click", function () {
            if (G.busy || b.classList.contains("pa55-ok")) return;
            tone({ type: "sine", f: f, dur: 0.36, vol: 0.20 }); pulse(b);
            if (f === freqs[picked]) {
              picked++; b.classList.add("pa55-ok");
              if (picked >= freqs.length) {
                G.busy = true; G.score++; P.score.textContent = G.score; stepDone();
                setTimeout(function () { G.busy = false; if (G.done < G.total) next(); }, 900);
              }
            } else { bad(b); }
          });
          wrap.appendChild(b);
        });
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
