/* ===== Fase 4 #57 · Ambiente de bosque =====

   Cambio de rumbo respecto a #55: los efectos sintetizados sonaban a
   juguete roto. Un pitido de oscilador puro no suena "premio", suena
   "electrodoméstico", y a los 3-5 años eso no refuerza nada: lo que
   refuerza es la estrella y la animación, que ya estaban.

   Así que este módulo hace tres cosas, todas aditivas:

   1. Pone una CAMA SONORA de bosque debajo de la app entera —viento entre
      las hojas, follaje cercano, un hilo de agua y algún pájaro lejano—.
      Sigue siendo WebAudio procedural: no se sube ni un binario, funciona
      sin red y no pesa un byte en el precache. La diferencia es que el
      ruido filtrado SÍ suena a naturaleza, porque la naturaleza es
      literalmente ruido filtrado; un oscilador nunca suena a tambor.

   2. Silencia los efectos puntuales sustituyendo window.chime por un
      no-op. chime() es una función global, así que se puede reemplazar
      desde aquí sin tocar app.js. La recompensa visual no se toca.

   3. NO toca speak()/speakSeq(). La narración se queda: a los 3-5 años el
      niño no lee, y el enunciado hablado es la única vía por la que
      entiende qué se le pide. Quitarla no sería "menos ruido", sería
      dejar la app sin instrucciones.

   Tres restricciones que condicionan el código y conviene no perder:

   · El AudioContext no puede nacer al cargar el módulo (iOS lo exige) y
     tampoco durante el alta de perfil: la ola 20 comprueba que después de
     crear un perfil siguen existiendo CERO contextos. Por eso el arranque
     se engancha al primer gesto que ocurra YA FUERA de la pantalla de
     perfiles, y sólo una vez.
   · window.S no es global, así que el estado de silencio no se puede leer
     de S.sound: se lee del interruptor visible (#tgSound / #soundBtn),
     que es la fuente de verdad que el niño y el adulto manipulan.
   · La preferencia se guarda SÓLO cuando el adulto la cambia. Si se
     guardara por defecto aparecería una clave nueva en localStorage en
     mitad del flujo de #55 y la ola 20 lo mide. Silencio por defecto en
     el almacenamiento = cero sorpresas.

   Aditivo: no toca app.js, ni index.html, ni STORE_KEY. */
(function () {
  "use strict";
  if (window.__pa57) return;
  window.__pa57 = true;

  var d = document;
  var PKEY = "pequenautas.f4.ambiente.v1";

  /* nivel 0 = apagado, 1 = suave, 2 = normal, 3 = presente.
     El defecto es 2 y NO se escribe hasta que alguien lo cambia. */
  var LEVELS = [0, 0.035, 0.065, 0.11];
  var level = 2;
  var touched = false;
  try {
    var raw = localStorage.getItem(PKEY);
    if (raw != null) {
      var n = parseInt(raw, 10);
      if (n >= 0 && n <= 3) { level = n; touched = true; }
    }
  } catch (e) {}
  function saveLevel() { try { localStorage.setItem(PKEY, String(level)); } catch (e) {} }

  var lang = "es";
  function detectLang() {
    var n = d.getElementById("lblRead");
    lang = (n && /letter/i.test(n.textContent || "")) ? "en" : "es";
    return lang;
  }
  function T(es, en) { return lang === "en" ? en : es; }

  /* ---------- el interruptor de sonido de la app ----------
     Se mira primero la fila de Ajustes (que es la que persiste el adulto) y
     si no existe todavía, el botón flotante. Si no hay ninguno de los dos,
     se asume sonido activo: es el estado por defecto de la app. */
  function appSoundOn() {
    var tg = d.getElementById("tgSound");
    if (tg) return tg.classList.contains("on");
    var b = d.getElementById("soundBtn");
    if (b) return (b.textContent || "").indexOf("🔇") < 0;
    return true;
  }

  /* ---------- la cama sonora ----------
     Cuatro capas sobre un mismo ruido rosa-ish. La clave para que no suene
     a "shhh de radio" es que el viento respire: un LFO muy lento abre y
     cierra el filtro, que es lo que el oído interpreta como ráfaga. */
  var AC = null, master = null, started = false, birdT = null, running = false;

  function ctx() {
    try {
      if (!AC) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        AC = new C();
      }
      if (AC.state === "suspended" && AC.resume) AC.resume();
    } catch (e) { AC = null; }
    return AC;
  }

  function noiseBuffer(c, secs) {
    var n = Math.max(1, Math.floor(c.sampleRate * secs));
    var buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0);
    var last = 0, i;
    for (i = 0; i < n; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;      // integrador barato: rosa-ish
      ch[i] = last * 3.2;
    }
    // los últimos milisegundos se casan con los primeros para que el bucle
    // no chasquee en el punto de empalme.
    var fade = Math.min(2000, Math.floor(n / 8));
    for (i = 0; i < fade; i++) {
      var k = i / fade;
      ch[i] = ch[i] * k + ch[n - fade + i] * (1 - k);
    }
    return buf;
  }

  function loopLayer(c, buf, type, freq, q, gain) {
    var src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    var f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; if (q != null) f.Q.value = q;
    var g = c.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(0);
    return { src: src, filter: f, gain: g };
  }

  function build() {
    var c = ctx(); if (!c) return false;
    try {
      master = c.createGain();
      master.gain.value = 0.0001;
      master.connect(c.destination);

      var buf = noiseBuffer(c, 6);

      // viento: paso bajo ancho, con ráfagas
      var wind = loopLayer(c, buf, "lowpass", 520, 0.6, 0.9);
      var lfo = c.createOscillator(), lfoG = c.createGain();
      lfo.frequency.value = 0.055;          // una ráfaga cada ~18 s
      lfoG.gain.value = 260;
      lfo.connect(lfoG); lfoG.connect(wind.filter.frequency);
      lfo.start(0);

      // hojas: banda alta muy baja de nivel, la que da la textura de follaje
      var leaves = loopLayer(c, buf, "bandpass", 2400, 0.8, 0.20);
      var lfo2 = c.createOscillator(), lfo2G = c.createGain();
      lfo2.frequency.value = 0.13;
      lfo2G.gain.value = 0.12;
      lfo2.connect(lfo2G); lfo2G.connect(leaves.gain.gain);
      lfo2.start(0);

      // agua: hilo estrecho y constante, muy al fondo
      loopLayer(c, buf, "bandpass", 1200, 1.6, 0.10);

      fadeTo(target());
      scheduleBird();
      running = true;
      return true;
    } catch (e) { return false; }
  }

  function target() {
    if (!appSoundOn()) return 0;
    return LEVELS[level] || 0;
  }

  function fadeTo(v, secs) {
    if (!AC || !master) return;
    try {
      var t = AC.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
      master.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + (secs == null ? 2.2 : secs));
    } catch (e) {}
  }

  /* Un pájaro cada 6-18 s: dos notas cortas con un pequeño portamento.
     Es el único elemento tonal, y va tan bajo que se percibe como
     distancia, no como pitido. */
  function chirp() {
    if (!AC || !master || target() <= 0) return;
    try {
      var c = AC, t0 = c.currentTime + 0.02;
      var base = 1800 + Math.random() * 1100;
      var notes = [[0, base], [0.16 + Math.random() * 0.1, base * (Math.random() < 0.5 ? 1.18 : 0.86)]];
      for (var i = 0; i < notes.length; i++) {
        var at = t0 + notes[i][0], f = notes[i][1];
        var osc = c.createOscillator(), g = c.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f * 0.94, at);
        osc.frequency.exponentialRampToValueAtTime(f, at + 0.05);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
        osc.connect(g); g.connect(master);
        osc.start(at); osc.stop(at + 0.2);
      }
    } catch (e) {}
  }

  function scheduleBird() {
    if (birdT) clearTimeout(birdT);
    birdT = setTimeout(function () {
      chirp();
      scheduleBird();
    }, 6000 + Math.random() * 12000);
  }

  function apply() {
    if (!running) return;
    fadeTo(target(), 0.9);
  }

  /* ---------- arranque ----------
     Sólo dentro de un gesto real, y sólo cuando ya se ha salido de la
     pantalla de perfiles: durante el alta no puede existir ningún
     AudioContext (lo comprueba la ola 20). */
  function onProfiles() {
    var p = d.getElementById("profiles");
    return !!(p && p.classList.contains("active"));
  }

  function tryStart() {
    if (started || onProfiles()) return;
    started = true;
    if (!build()) started = false;
  }

  d.addEventListener("pointerdown", tryStart, true);
  d.addEventListener("keydown", tryStart, true);

  /* Nunca sonar en segundo plano: si el peque cambia de app, el bosque se
     calla. Es batería y también es respeto por el adulto que estaba
     escuchando otra cosa. */
  d.addEventListener("visibilitychange", function () {
    if (!running) return;
    if (d.hidden) { fadeTo(0, 0.4); try { if (AC && AC.suspend) AC.suspend(); } catch (e) {} }
    else { try { if (AC && AC.resume) AC.resume(); } catch (e) {} fadeTo(target(), 1.2); }
  });

  /* El interruptor global de sonido manda sobre el bosque. No hay evento
     que avise, así que se re-sincroniza tras cualquier clic en los dos
     mandos que existen. */
  d.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest("#tgSound") || t.closest("#soundBtn")) setTimeout(apply, 60);
  }, true);

  /* ---------- silenciar los efectos ----------
     chime() es global: se reemplaza por un no-op y con eso desaparecen los
     pitidos de acierto y de error de toda la app sin editar app.js. Se
     conserva la firma y se deja el original accesible por si alguna vez
     hiciera falta volver atrás. */
  try {
    if (typeof window.chime === "function" && !window.chime.__pa57) {
      window.__pa57chime = window.chime;
      var noop = function () {};
      noop.__pa57 = true;
      window.chime = noop;
    }
  } catch (e) {}

  /* ---------- fila de Ajustes ----------
     index.html es intocable, así que la fila se clona en JS con el mismo
     patrón idempotente que usa #16: se crea la primera vez que se abre
     Ajustes y se reutiliza siempre. Un interruptor para encender o apagar,
     y un botón de nivel para el volumen, porque "un poco de bosque" y
     "bosque" no son la misma cosa en un aula. */
  function $(id) { return d.getElementById(id); }

  var LVL_NAMES = [["Apagado", "Off"], ["Suave", "Soft"], ["Normal", "Normal"], ["Presente", "Full"]];

  function syncRow() {
    var tg = $("tgAmb"), btn = $("ambLvl");
    var on = level > 0;
    if (tg) {
      tg.classList[on ? "add" : "remove"]("on");
      tg.setAttribute("aria-checked", on ? "true" : "false");
    }
    if (btn) {
      var i = on ? level : 2;
      btn.textContent = T(LVL_NAMES[i][0], LVL_NAMES[i][1]);
      btn.disabled = !on;
    }
  }

  function langRow() {
    detectLang();
    var n = $("setAmbN"), ds = $("setAmbD");
    if (n) n.textContent = T("Bosque de fondo", "Forest ambience");
    if (ds) ds.textContent = T("Viento, hojas y pájaros mientras juega", "Wind, leaves and birds while playing");
    syncRow();
  }

  var lastLevel = 2;   // a qué nivel volver al reencender

  function ensureRow() {
    var set = $("setView"); if (!set) return;
    var row = $("setAmb");
    if (!row) {
      row = d.createElement("div");
      row.className = "setting pa57-row";
      row.id = "setAmb";
      row.innerHTML =
        '<div><div class="name" id="setAmbN"></div><div class="desc" id="setAmbD"></div></div>' +
        '<div class="pa57-ctl">' +
        '<button class="pa57-lvl" id="ambLvl" type="button"></button>' +
        '<button class="toggle on" id="tgAmb" role="switch" aria-checked="true"><span class="knob"></span></button>' +
        '</div>';
      var anchor = $("setSessLimit");
      if (anchor && anchor.parentNode === set) set.insertBefore(row, anchor);
      else set.appendChild(row);
    }
    var tg = $("tgAmb");
    if (tg && !tg._pa57) {
      tg._pa57 = true;
      tg.addEventListener("click", function () {
        if (level > 0) { lastLevel = level; level = 0; }
        else level = lastLevel || 2;
        touched = true; saveLevel(); syncRow(); apply();
      });
    }
    var btn = $("ambLvl");
    if (btn && !btn._pa57) {
      btn._pa57 = true;
      btn.addEventListener("click", function () {
        if (level <= 0) return;
        level = level >= 3 ? 1 : level + 1;
        lastLevel = level;
        touched = true; saveLevel(); syncRow(); apply();
      });
    }
    langRow();
  }

  var ts = $("tabSet");
  if (ts && !ts._pa57) {
    ts._pa57 = true;
    ts.addEventListener("click", function () { setTimeout(ensureRow, 30); });
  }
  // Ajustes puede abrirse por otras vías (controles parentales de #30), así
  // que también se vigila cuándo se hace visible.
  d.addEventListener("click", function () {
    var set = $("setView");
    if (set && set.style.display !== "none") setTimeout(ensureRow, 30);
  }, true);

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", function () { setTimeout(ensureRow, 400); });
  else setTimeout(ensureRow, 400);

  // expuesto sólo para depuración y para que los tests puedan comprobar el
  // estado sin espiar el grafo de audio.
  window.PA57 = {
    level: function () { return level; },
    running: function () { return running; },
    touched: function () { return touched; },
    apply: apply,
    row: ensureRow
  };
})();
