/* ===== Fase 4 #61 · La voz de Rufo (reproductor) =====

   spec.css trae los dieciocho clips como data: URIs en propiedades
   personalizadas (--pa61-<idioma>-<clave>). Este archivo es lo único que hace
   falta para que suenen: envuelve speak()/speakSeq() por REASIGNACIÓN, igual
   que #16, y antes de dejar hablar al sintetizador comprueba si esa frase
   tiene clip.

   Dónde encaja en la cadena de voces
   ----------------------------------
   app.js ya montó el AudioBank, que busca audio/<idioma>/<clave>.mp3 y cae al
   TTS si no lo encuentra. Ese banco sigue intacto: espera clips locutados por
   personas en archivos sueltos, y ese día llegará. Lo que este módulo aporta
   es una capa intermedia con los clips que SÍ existen hoy, embebidos.

   El orden en fase4.js es deliberado: #61 se carga ANTES que #16, de modo que
   la envoltura de #16 queda por fuera. Así #16 sigue siendo quien reconoce la
   frase y estampa opts.key, y quien mueve la boca de la mascota, aunque el
   sonido lo ponga este módulo. Aun así resolvemos la clave por nuestra cuenta
   si nos llega sin ella: si algún día #16 no carga, Rufo no se queda mudo.

   Prioridad al reproducir una clave:
     1. clip locutado real en audio/<idioma>/<clave>.mp3  (AudioBank, cuando exista)
     2. clip embebido aquí                                 (lo que suena hoy)
     3. voz del sistema                                    (lo de siempre)

   El paso 1 va primero a propósito: el día que se grabe a una persona, esos
   clips deben ganar sin que nadie tenga que borrar nada de aquí.

   Aditivo: no toca app.js, ni index.html, ni STORE_KEY. */
(function () {
  "use strict";

  if (window.__pa61) return;
  window.__pa61 = true;

  var LANGS = ['es', 'en'];
  var cache = Object.create(null);   // "<lang>/<key>" -> Audio
  var uris  = Object.create(null);   // "<lang>/<key>" -> data URI | ''

  /* El data: URI llega envuelto en url("...") porque así es como el arte de la
     app declara sus imágenes y no merecía la pena romper la convención por el
     sonido. Se desenvuelve una sola vez y se recuerda: getComputedStyle no es
     gratis y esto puede pedirse en mitad de una animación de acierto. */
  function uriFor(key, lang) {
    var id = lang + '/' + key;
    if (id in uris) return uris[id];
    var raw = '';
    try {
      raw = getComputedStyle(document.documentElement)
              .getPropertyValue('--pa61-' + lang + '-' + key) || '';
    } catch (e) { raw = ''; }
    raw = String(raw).trim();
    var m = raw.match(/^url\(\s*["']?([^"')]+)["']?\s*\)$/);
    var out = m ? m[1] : (raw.indexOf('data:') === 0 ? raw : '');
    /* Mientras spec.css no haya aplicado todavía, la variable viene vacía. En
       ese caso NO memorizamos el fallo: la siguiente frase volverá a mirar. */
    if (out) uris[id] = out;
    return out;
  }

  function has(key, lang) {
    if (!key || LANGS.indexOf(lang) < 0) return false;
    return !!uriFor(key, lang);
  }

  function el(key, lang) {
    var id = lang + '/' + key, a = cache[id];
    if (!a) { a = new Audio(uriFor(key, lang)); a.preload = 'auto'; cache[id] = a; }
    return a;
  }

  /* Resuelve true si el clip sonó entero. Cualquier tropiezo —el navegador
     bloquea el autoplay porque aún no hubo gesto, el data: URI no se decodifica,
     el elemento se queda a medias— resuelve false y quien llame se encarga de
     caer al sintetizador. Nunca rechaza: una voz que revienta la promesa
     dejaría la ronda sin premio. */
  function playClip(key, lang) {
    return new Promise(function (resolve) {
      lang = lang || (typeof S !== 'undefined' ? S.lang : 'es');
      if (typeof S === 'undefined' || !S.sound || !has(key, lang)) return resolve(false);
      var a;
      try { a = el(key, lang); } catch (e) { return resolve(false); }
      var done = false;
      function fin(ok) { if (done) return; done = true; a.onended = a.onerror = null; resolve(ok); }
      a.onended = function () { fin(true); };
      a.onerror = function () { fin(false); };
      try {
        a.currentTime = 0;
        var pr = a.play();
        if (pr && pr.then) pr.catch(function () { fin(false); });
      } catch (e) { fin(false); }
    });
  }

  /* El AudioBank de app.js ya sabe si existe un clip locutado de verdad. Si lo
     hay, este módulo se aparta y deja pasar la llamada tal cual. */
  function bankTiene(key, lang) {
    try {
      return !!(window.AudioBank && window.AudioBank.enabled &&
                window.AudioBank.has(key, lang));
    } catch (e) { return false; }
  }

  /* Copia defensiva del resolutor de #16, por si #16 no llegó a cargar. El
     guion vive en un solo sitio —AUDIO_MANIFEST.keys, dentro de app.js—, así
     que aquí solo se compara contra él; nunca se duplica el texto. */
  function resolveKey(text, lang) {
    try {
      if (!text || !window.AudioBank || !window.AudioBank.manifest) return null;
      var keys = window.AudioBank.manifest.keys;
      if (!keys) return null;
      var norm = String(text).trim();
      for (var k in keys) {
        if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
        if (keys[k] && keys[k][lang] === norm) return k;
      }
    } catch (e) {}
    return null;
  }

  function claveDe(text, opts, lang) {
    if (opts && opts.key) return opts.key;
    return resolveKey(text, lang);
  }

  var _speak    = (typeof window.speak    === 'function') ? window.speak    : null;
  var _speakSeq = (typeof window.speakSeq === 'function') ? window.speakSeq : null;

  /* Fallback de una sola frase dentro de una secuencia. Reproduce el texto con
     el sintetizador y avisa al terminar, para que la siguiente frase no se le
     monte encima. */
  function ttsPart(p, lang, done) {
    if (typeof S === 'undefined' || !S.sound || !window.speechSynthesis || !p || !p.t) return done();
    try {
      var u = new SpeechSynthesisUtterance(p.t);
      u.lang = lang === 'es' ? 'es-ES' : 'en-US';
      u.rate = p.rate || 0.9;
      u.pitch = p.pitch || 1.12;
      u.onend = function () { done(); };
      u.onerror = function () { done(); };
      speechSynthesis.speak(u);
    } catch (e) { done(); }
  }

  if (_speak) {
    window.speak = function (text, opts) {
      opts = opts || {};
      var lang = opts.lang || (typeof S !== 'undefined' ? S.lang : 'es');
      var key = claveDe(text, opts, lang);
      if (key && !bankTiene(key, lang) && typeof S !== 'undefined' && S.sound && has(key, lang)) {
        /* Se corta el sintetizador antes de soltar el clip: si no, la frase
           anterior se solapa con la voz de Rufo y no se entiende ninguna. */
        if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
        playClip(key, lang).then(function (ok) { if (!ok) _speak(text, opts); });
        return;
      }
      return _speak(text, opts);
    };
  }

  if (_speakSeq) {
    window.speakSeq = function (parts) {
      parts = parts || [];
      var lang0 = (typeof S !== 'undefined' ? S.lang : 'es');
      var usa = typeof S !== 'undefined' && S.sound && parts.some(function (p) {
        if (!p) return false;
        var l = p.lang || lang0;
        var k = claveDe(p.t, p, l);
        return k && !bankTiene(k, l) && has(k, l);
      });
      /* Si ninguna frase de la tanda tiene clip embebido, esto no es asunto
         nuestro: que la resuelva quien ya la resolvía. */
      if (!usa) return _speakSeq(parts);
      if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
      var i = 0;
      (function next() {
        if (i >= parts.length) return;
        var p = parts[i++];
        if (!p || !p.t) return next();
        var lang = p.lang || lang0;
        var k = claveDe(p.t, p, lang);
        if (k && !bankTiene(k, lang) && has(k, lang)) {
          playClip(k, lang).then(function (ok) { if (ok) next(); else ttsPart(p, lang, next); });
        } else {
          ttsPart(p, lang, next);
        }
      })();
    };
  }

  /* Superficie mínima para las pruebas y para poder depurar desde la consola
     sin abrir el CSS a mano. */
  window.VozRufo = {
    langs: LANGS.slice(),
    has: has,
    uri: uriFor,
    play: playClip,
    keys: function () {
      try { return Object.keys(window.AudioBank.manifest.keys); } catch (e) { return []; }
    },
    disponibles: function (lang) {
      lang = lang || 'es';
      return window.VozRufo.keys().filter(function (k) { return has(k, lang); });
    }
  };
})();
