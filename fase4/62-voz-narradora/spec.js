/* ===== Fase 4 #62 · La voz de la narradora (reproductor) =====

   Rufo ya tenía voz propia (#61), pero solo para las dieciocho frases del
   guion del AudioBank. Todo lo demás —el enunciado de cada ronda, la
   pregunta, la pista, el "¡Muy bien!" de después— lo decía el sintetizador
   del sistema, que en Android suena distinto en cada teléfono y en algunos
   ni siquiera tiene voz en español instalada. Este módulo trae esas frases
   grabadas.

   Cómo encuentra el clip
   ----------------------
   El resto de la app no sabe que esto existe: sigue llamando a speak() con
   el texto tal cual. Así que la búsqueda es por TEXTO, normalizado (espacios
   colapsados y recortados) para que el prompt que se pinta con doble espacio
   y el que se pronuncia acaben en la misma entrada. El mapa texto -> clip lo
   genera la herramienta de horneado junto con los CSS; nadie lo escribe a
   mano.

   Dónde encaja en la cadena de voces
   ----------------------------------
   El orden en fase4.js es deliberado: #62 se carga DESPUÉS de #61 y ANTES de
   #16. Queda por fuera de #61, de modo que la primera decisión es nuestra;
   por eso, antes de tocar nada, comprobamos si la frase es una de las de
   Rufo y en ese caso dejamos pasar la llamada intacta para que la ponga él.
   Y queda por dentro de #16, que sigue siendo quien mueve la boca de la
   mascota y quien estampa opts.key.

   Prioridad al hablar:
     1. clip locutado real en audio/<idioma>/<clave>.mp3  (AudioBank)
     2. clip de Rufo, si la frase es de su guion          (#61)
     3. clip de la narradora                              (este módulo)
     4. voz del sistema                                   (lo de siempre)

   Ola 1 cubre el español. En inglés todavía no hay clips y la app se
   comporta exactamente como antes: cae al sintetizador. Eso es a propósito,
   no un olvido; el banco crece por olas y este módulo no necesita cambiar
   para aprovechar las siguientes.

   Aditivo: no toca app.js, ni index.html, ni STORE_KEY. */
(function () {
  "use strict";

  if (window.__pa62) return;
  window.__pa62 = true;

  var MAPA = {
    "es|1": "es-356a192b79",
    "es|2": "es-da4b9237ba",
    "es|3": "es-77de68daec",
    "es|4": "es-1b64538924",
    "es|Abro el agua": "es-bfb715996e",
    "es|Alegre": "es-0ff010fdfa",
    "es|Asustado": "es-e392782525",
    "es|El conejo come plantas.": "es-ce39668247",
    "es|El conejo vive en la tierra.": "es-877d2c2d28",
    "es|El delfín come carne.": "es-800ad9a212",
    "es|El delfín vive en el agua.": "es-4331f9dc39",
    "es|El elefante come plantas.": "es-1d221aab15",
    "es|El elefante vive en la tierra.": "es-297f4a4929",
    "es|El león come carne.": "es-69d319b84a",
    "es|El león vive en la tierra.": "es-f4168ecd05",
    "es|El perro come carne.": "es-e3508635f9",
    "es|El perro vive en la tierra.": "es-20f962f1b0",
    "es|El pez come carne.": "es-a1bbd41a4f",
    "es|El pez vive en el agua.": "es-78c62ae299",
    "es|El pulpo come carne.": "es-d5c46dceee",
    "es|El pulpo vive en el agua.": "es-e6789db10b",
    "es|El pájaro come plantas.": "es-25f0f81abd",
    "es|El pájaro vive en el cielo.": "es-ebef06bade",
    "es|El águila come carne.": "es-81900e2e3d",
    "es|El águila vive en el cielo.": "es-2b0298c3e4",
    "es|Enojado": "es-630a944539",
    "es|La abeja come plantas.": "es-b1b362b6bc",
    "es|La abeja vive en el cielo.": "es-913127484b",
    "es|La ballena come carne.": "es-7fb9ba168e",
    "es|La ballena vive en el agua.": "es-87bff7554c",
    "es|La letra A": "es-b97166ad75",
    "es|La letra C": "es-9031f05b0c",
    "es|La letra E": "es-66cccf9597",
    "es|La letra L": "es-928d29887d",
    "es|La letra M": "es-ac233d7caa",
    "es|La letra O": "es-99e00921b7",
    "es|La letra P": "es-302411d37b",
    "es|La letra S": "es-2426618afa",
    "es|La mariposa come plantas.": "es-76190c2029",
    "es|La mariposa vive en el cielo.": "es-699f7ef9c7",
    "es|Me cepillo": "es-ea09f1b73a",
    "es|Me enjabono": "es-f5e8e487b7",
    "es|Me enjuago": "es-b26dc30f5e",
    "es|Me seco": "es-5b535a4e7d",
    "es|Pongo la pasta": "es-4145daab89",
    "es|Toca el que brilla.": "es-4c9220a71f",
    "es|Triste": "es-d7d0c67216",
    "es|aaa... Árbol": "es-655d3175b0",
    "es|azul": "es-1768d39c5b",
    "es|ca... Casa": "es-0f89116807",
    "es|cinco": "es-a097b33b77",
    "es|cuadrado": "es-80e7adc16a",
    "es|cuatro": "es-a37e3bea6f",
    "es|círculo": "es-b54490df29",
    "es|dos": "es-e67f16d28a",
    "es|eee... Elefante": "es-2d55f58c37",
    "es|estrella": "es-e0cab40783",
    "es|lll... Luna": "es-b22b0dfbf5",
    "es|mmm... Manzana": "es-d5827c07c6",
    "es|ooo... Oso": "es-dfd86a95a2",
    "es|ppp... Perro": "es-f040bb28b9",
    "es|rojo": "es-af6c1a0ca2",
    "es|seis": "es-ba15793485",
    "es|sss... Sol": "es-1200b5f70e",
    "es|tres": "es-0c95987338",
    "es|triángulo": "es-560148aebe",
    "es|uno": "es-81b6f50734",
    "es|¡Excelente!": "es-95e252d8f4",
    "es|¡Muy bien!": "es-2c0ab017ea",
    "es|¡Sí! Casa empieza con C.": "es-013a235899",
    "es|¡Sí! Elefante empieza con E.": "es-a455c1a112",
    "es|¡Sí! Este grupo tiene más.": "es-e9bff360e3",
    "es|¡Sí! Había cinco.": "es-7659ad6bbf",
    "es|¡Sí! Había cuatro.": "es-8f5ad90aa9",
    "es|¡Sí! Había dos.": "es-a10662e93f",
    "es|¡Sí! Había tres.": "es-e0eb4c0512",
    "es|¡Sí! Hay cinco.": "es-2b7823364e",
    "es|¡Sí! Hay cuatro.": "es-4d6d80f2a2",
    "es|¡Sí! Hay dos.": "es-0c4adcdc79",
    "es|¡Sí! Hay tres.": "es-ea20f4db3e",
    "es|¡Sí! Hay uno.": "es-7dd7afc644",
    "es|¡Sí! Luna empieza con L.": "es-5a1d473259",
    "es|¡Sí! Manzana empieza con M.": "es-f52fa239b2",
    "es|¡Sí! Oso empieza con O.": "es-0dd8c894c7",
    "es|¡Sí! Perro empieza con P.": "es-f025061142",
    "es|¡Sí! Sigue": "es-1d82f6b941",
    "es|¡Sí! Sol empieza con S.": "es-e15e576346",
    "es|¡Sí! Árbol empieza con A.": "es-ebe203b123",
    "es|¿Cuántos hay? Toca para contar.": "es-ac96b64ba4",
    "es|¿Cómo se siente?": "es-23d11f6911",
    "es|¿Dónde vive el conejo?": "es-597b740cf2",
    "es|¿Dónde vive el delfín?": "es-506a007894",
    "es|¿Dónde vive el elefante?": "es-861685892e",
    "es|¿Dónde vive el león?": "es-3075b1f1a7",
    "es|¿Dónde vive el perro?": "es-37b6730609",
    "es|¿Dónde vive el pez?": "es-f0e32cd50b",
    "es|¿Dónde vive el pulpo?": "es-a4c0d3ca71",
    "es|¿Dónde vive el pájaro?": "es-eca9eb54e4",
    "es|¿Dónde vive el águila?": "es-d7b7e11d63",
    "es|¿Dónde vive la abeja?": "es-84e465777f",
    "es|¿Dónde vive la ballena?": "es-a2f5ffb25f",
    "es|¿Dónde vive la mariposa?": "es-b5165f0ec9",
    "es|¿Qué come el conejo?": "es-228bedcd5b",
    "es|¿Qué come el delfín?": "es-8222de1d91",
    "es|¿Qué come el elefante?": "es-3ca1cceec3",
    "es|¿Qué come el león?": "es-0c2d7d3415",
    "es|¿Qué come el perro?": "es-7e50c09a0a",
    "es|¿Qué come el pez?": "es-33a5d8cae1",
    "es|¿Qué come el pulpo?": "es-991d939c52",
    "es|¿Qué come el pájaro?": "es-ea7cc68119",
    "es|¿Qué come el águila?": "es-277b8b014a",
    "es|¿Qué come la abeja?": "es-01bf837f73",
    "es|¿Qué come la ballena?": "es-8d5366d62c",
    "es|¿Qué come la mariposa?": "es-4d5f33f523",
    "es|¿Qué empieza con A?": "es-c22a5ea43c",
    "es|¿Qué empieza con C?": "es-bc2b417e91",
    "es|¿Qué empieza con E?": "es-e662fbfd77",
    "es|¿Qué empieza con L?": "es-8c16230716",
    "es|¿Qué empieza con M?": "es-b432dd3e17",
    "es|¿Qué empieza con O?": "es-84b2ff04dc",
    "es|¿Qué empieza con P?": "es-d1d218f80d",
    "es|¿Qué empieza con S?": "es-6a4607f06d"
  };

  var cache = Object.create(null);   // id -> Audio
  var uris  = Object.create(null);   // id -> data URI | ''

  function norm(t) {
    return String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  }

  function idDe(text, lang) {
    if (!text) return '';
    return MAPA[(lang || 'es') + '|' + norm(text)] || '';
  }

  /* Igual que en #61: el data: URI viene envuelto en url("...") porque así
     declara la app sus recursos, y getComputedStyle no es gratis, así que se
     desenvuelve una vez y se recuerda. Si el CSS todavía no aplicó, la
     variable llega vacía y NO memorizamos el fallo. */
  function uriFor(id) {
    if (!id) return '';
    if (id in uris) return uris[id];
    var raw = '';
    try {
      raw = getComputedStyle(document.documentElement)
              .getPropertyValue('--pa62-' + id) || '';
    } catch (e) { raw = ''; }
    raw = String(raw).trim();
    var m = raw.match(/^url\(\s*["']?([^"')]+)["']?\s*\)$/);
    var out = m ? m[1] : (raw.indexOf('data:') === 0 ? raw : '');
    if (out) uris[id] = out;
    return out;
  }

  function has(text, lang) {
    return !!uriFor(idDe(text, lang));
  }

  function el(id) {
    var a = cache[id];
    if (!a) { a = new Audio(uriFor(id)); a.preload = 'auto'; cache[id] = a; }
    return a;
  }

  /* Resuelve true solo si el clip sonó entero. Cualquier tropiezo resuelve
     false y quien llame cae al sintetizador; nunca rechaza, porque una
     promesa rota dejaría la ronda a medias y sin premio. */
  function playClip(id) {
    return new Promise(function (resolve) {
      if (typeof S === 'undefined' || !S.sound || !uriFor(id)) return resolve(false);
      var a;
      try { a = el(id); } catch (e) { return resolve(false); }
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

  /* El guion de Rufo vive en un solo sitio —AUDIO_MANIFEST.keys, dentro de
     app.js—, así que aquí solo se compara contra él; nunca se duplica el
     texto. Devuelve la clave si la frase es de las suyas. */
  function claveRufo(text, opts, lang) {
    try {
      if (opts && opts.key) return opts.key;
      var keys = window.AudioBank && window.AudioBank.manifest &&
                 window.AudioBank.manifest.keys;
      if (!keys || !text) return null;
      var n = norm(text);
      for (var k in keys) {
        if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
        if (keys[k] && norm(keys[k][lang]) === n) return k;
      }
    } catch (e) {}
    return null;
  }

  function bankTiene(key, lang) {
    try {
      return !!(window.AudioBank && window.AudioBank.enabled &&
                window.AudioBank.has(key, lang));
    } catch (e) { return false; }
  }

  function rufoTiene(key, lang) {
    try { return !!(key && window.VozRufo && window.VozRufo.has(key, lang)); }
    catch (e) { return false; }
  }

  /* Devuelve el id de nuestro clip solo si la frase nos toca a nosotros: si
     es del guion de Rufo se la dejamos entera, tenga clip locutado o
     embebido. */
  function nuestra(text, opts, lang) {
    if (typeof S === 'undefined' || !S.sound) return '';
    var key = claveRufo(text, opts, lang);
    if (key && (bankTiene(key, lang) || rufoTiene(key, lang))) return '';
    var id = idDe(text, lang);
    return uriFor(id) ? id : '';
  }

  /* Fallback de una sola frase dentro de una secuencia: la dice el
     sintetizador y avisa al terminar, para que la siguiente no se le monte
     encima. Copia deliberada de la de #61: cuando #62 toma el mando de una
     tanda mixta, las partes ajenas siguen necesitando este cierre. */
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

  var _speak    = (typeof window.speak    === 'function') ? window.speak    : null;
  var _speakSeq = (typeof window.speakSeq === 'function') ? window.speakSeq : null;

  if (_speak) {
    window.speak = function (text, opts) {
      opts = opts || {};
      var lang = opts.lang || (typeof S !== 'undefined' ? S.lang : 'es');
      var id = nuestra(text, opts, lang);
      if (id) {
        /* Se corta el sintetizador antes de soltar el clip: si no, la frase
           anterior se solapa y no se entiende ninguna. */
        if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
        playClip(id).then(function (ok) { if (!ok) _speak(text, opts); });
        return;
      }
      return _speak(text, opts);
    };
  }

  if (_speakSeq) {
    window.speakSeq = function (parts) {
      parts = parts || [];
      var lang0 = (typeof S !== 'undefined' ? S.lang : 'es');
      var usa = parts.some(function (p) {
        return p && nuestra(p.t, p, p.lang || lang0);
      });
      /* Si ninguna frase de la tanda es nuestra, esto no es asunto nuestro:
         que la resuelva quien ya la resolvía, entera y de una pieza. */
      if (!usa) return _speakSeq(parts);
      if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
      var i = 0;
      (function next() {
        if (i >= parts.length) return;
        var p = parts[i++];
        if (!p || !p.t) return next();
        var lang = p.lang || lang0;
        var id = nuestra(p.t, p, lang);
        if (id) {
          playClip(id).then(function (ok) { if (ok) next(); else resto(p, next); });
        } else {
          resto(p, next);
        }
      })();

      /* Una parte que no es nuestra puede seguir siendo de Rufo: en ese caso
         le pedimos su clip directamente, que devuelve promesa y nos deja
         encadenar sin adivinar duraciones. Si tampoco es suya, la dice el
         sintetizador. */
      function resto(p, done) {
        var lang = p.lang || lang0;
        var key = claveRufo(p.t, p, lang);
        if (key && !bankTiene(key, lang) && rufoTiene(key, lang)) {
          window.VozRufo.play(key, lang).then(function (ok) {
            if (ok) done(); else ttsPart(p, lang, done);
          });
          return;
        }
        ttsPart(p, lang, done);
      }
    };
  }

  /* Superficie mínima para las pruebas y para depurar desde la consola. */
  window.VozNarradora = {
    has: has,
    id: idDe,
    uri: uriFor,
    play: playClip,
    frases: function () { return Object.keys(MAPA); },
    total: function () { return Object.keys(MAPA).length; }
  };
})();
