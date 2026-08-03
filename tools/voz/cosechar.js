#!/usr/bin/env node
/* Cosecha las frases que la app dice de verdad, jugando a la app.
 *
 * Uso:  node tools/voz/cosechar.js en tools/voz/frases-en-w1.json
 *
 * El catálogo en español se hizo a mano y eso ya se notó: cuatrocientas
 * frases escritas a ojo son cuatrocientas ocasiones de escribir una coma de
 * más y quedarse sin clip, porque #62 busca por texto exacto. Aquí no se
 * escribe ninguna: se abre la app en un navegador, se le cambia el idioma, se
 * suplanta speak()/speakSeq() por un par de espías y se juegan miles de
 * rondas de los nueve juegos en los cinco niveles. Lo que quede recogido es,
 * literalmente, lo que el niño va a oír; no puede haber desajuste entre la
 * lista y la app porque la lista sale de la app.
 *
 * Las rondas se disparan llamando a la función de cada juego, no clicando por
 * la pantalla de inicio: así se recorren los cinco niveles sin tener que
 * ganarse cada uno. Y se pulsan todas las respuestas —primero las malas, tres
 * veces cada una para que salgan las tres pistas, y al final la buena— porque
 * la pista y el "¡Muy bien!" son la mitad de lo que la narradora dice.
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const LANG = process.argv[2] || 'en';
const SALIDA = process.argv[3] || `tools/voz/frases-${LANG}-w1.json`;
const VUELTAS = parseInt(process.env.VUELTAS || '160', 10);
const RAIZ = path.resolve(__dirname, '..', '..');

// Los nueve juegos: los tres originales de app.js y los seis que fueron
// añadiendo los módulos de fase 4.
const JUEGOS = ['math', 'reading', 'science',
  'emotions', 'shapes', 'routines', 'music', 'habits', 'brain'];

(async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  await pagina.goto('file://' + path.join(RAIZ, 'index.html'));
  await pagina.waitForTimeout(500);

  // Un perfil, que sin él no hay nivel ni partida.
  await pagina.click('.pcard.add');
  await pagina.waitForTimeout(250);
  await pagina.locator('.avopt').first().click();
  await pagina.fill('#nameInput', 'Cosecha');
  await pagina.click('#createBtn');
  await pagina.waitForTimeout(1500);

  const cosecha = await pagina.evaluate(async ({ lang, juegos, vueltas }) => {
    const dicho = new Set();
    const espiar = (t) => { if (t && typeof t === 'string') dicho.add(t); };

    // Los espías sustituyen a la voz: nada suena, todo se apunta. Se dejan
    // puestos hasta el final; la página se cierra después.
    window.speak = function (t) { espiar(t); };
    window.speakSeq = function (partes) {
      (partes || []).forEach((p) => { if (p) espiar(p.t); });
    };
    // afterCorrect encadenaría la ronda siguiente con un temporizador y se
    // pisaría con el bucle de aquí abajo, que va a su ritmo.
    window.afterCorrect = function () { };
    window.confetti = function () { };
    window.chime = function () { };

    S.lang = lang;
    if (typeof applyLang === 'function') applyLang();
    S.sound = true;
    S.guide = true;      // sin pistas guiadas no se dirían las pistas
    S.screen = 'game';

    const perfil = currentProfile();
    const nuevos = window.__newSubjectRounds || {};
    const ronda = (g) => {
      if (nuevos[g]) return nuevos[g]();
      if (g === 'math') return roundMath();
      if (g === 'reading') return roundReading();
      return renderScienceRound();
    };

    const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
    const fallos = [];

    for (const g of juegos) {
      for (let nivel = 0; nivel <= 4; nivel++) {
        perfil.best[g] = nivel;
        for (let i = 0; i < vueltas; i++) {
          S.game = g; S.round = 0; S.attempts = 0; S.revealed = false;
          S.correctBtn = null;
          try { ronda(g); } catch (e) { fallos.push(g + ': ' + e.message); break; }
          const buena = S.correctBtn;
          const botones = Array.from(document.querySelectorAll(
            '#stage button, #stage .choice, #stage .opt, #stage [data-op]'));
          for (const b of botones) {
            if (b === buena) continue;
            // tres veces: pista 1, pista 2 y el revelado con pista 3
            for (let k = 0; k < 3; k++) { try { b.click(); } catch (e) { } }
          }
          if (buena) { try { buena.click(); } catch (e) { } }
          if (i % 20 === 0) await dormir(0);
        }
      }
    }

    // La pantalla de celebración también habla.
    try { celebrate(); } catch (e) { }

    /* ---------- las secciones con pantalla propia ----------
       Cinco materias —formas, ingenio, música, emociones, hábitos— no pasan
       por nextRound(): abren su propia capa, con su rejilla de juegos y sus
       cinco niveles, y sus rondas viven dentro de un cierre al que no se
       llega desde fuera. A esas hay que jugarlas de verdad: abrir la tarjeta,
       entrar en cada juego, subir nivel a nivel y pulsar todo lo que hay en
       el campo. Todas comparten el mismo esqueleto de identificadores
       (paNNfield, paNNwin, paNNwnext…), así que un solo recorrido sirve para
       las cinco. */
    try { goHome(); } catch (e) { try { show('home'); } catch (e2) { } }
    await new Promise((r) => setTimeout(r, 300));

    // juego de la portada, prefijo de identificadores, llave de progreso
    const SECCIONES = [
      ['shapes', 'pa53', 'pequenautas.f4.formas.v1'],
      ['brain', 'pa54', 'pequenautas.f4.ingenio.v1'],
      ['music', 'pa55', 'pequenautas.f4.musica.v1'],
      ['emotions', 'pa58', 'pequenautas.f4.emociones.v1'],
      ['habits', 'pa60', 'pequenautas.f4.habitos.v1']];

    const capa = (p) => document.querySelector('.' + p + '-ov');
    const tarjeta = (g) => document.querySelector('.subject[data-game="' + g + '"]');
    const fichas = (p) => Array.from(
      (capa(p) || document).querySelectorAll('[data-pa34-game]'));
    const niveles = (p) => Array.from(
      (capa(p) || document).querySelectorAll('.pa34-lvl'));

    for (const [juego, p, llave] of SECCIONES) {
      const tj = tarjeta(juego);
      if (!tj) { fallos.push(juego + ': sin tarjeta'); continue; }
      tj.click(); await dormir(350);
      const cuantos = fichas(p).length;
      if (!cuantos) { fallos.push(juego + ': sin juegos en la capa'); continue; }

      /* Los cinco niveles, abiertos de antemano. No es hacer trampa: varios
         de estos juegos se ganan arrastrando piezas, y arrastrar no se puede
         simular a base de clics, así que el nivel 2 nunca se abriría solo y
         sus enunciados —que el niño sí va a oír— se quedarían sin grabar. */
      const abierto = {};
      fichas(p).forEach((f) => { abierto[f.getAttribute('data-pa34-game')] = 4; });
      try { localStorage.setItem(llave, JSON.stringify(abierto)); } catch (e) { }
      const cerrarAntes = capa(p) && capa(p).querySelector('.pa34-x');
      if (cerrarAntes) { cerrarAntes.click(); await dormir(200); }
      tj.click(); await dormir(350);
      for (let gi = 0; gi < cuantos; gi++) {
        // Varias pasadas por el mismo nivel: el contenido de cada ronda se
        // sortea, así que una sola visita solo enseña una de las cartas.
        for (let vuelta = 0; vuelta < 4; vuelta++)
        for (let nivel = 0; nivel < 5; nivel++) {
          // Volver a la rejilla desde cero cada vez: entre nivel y nivel la
          // capa se cierra, y los nodos guardados dejarían de servir.
          if (!capa(p) || !capa(p).classList.contains('show')) {
            tj.click(); await dormir(300);
          }
          const f = fichas(p)[gi]; if (!f) break;
          f.click(); await dormir(250);
          const nv = niveles(p)[nivel];
          if (!nv || nv.disabled) continue;
          nv.click(); await dormir(400);
          for (let paso = 0; paso < 80; paso++) {
            const campo = document.getElementById(p + 'field');
            if (!campo) break;
            for (const nodo of Array.from(campo.querySelectorAll('*'))) {
              try { nodo.click(); } catch (e) { }
            }
            const rep = document.getElementById(p + 'replay');
            if (rep) { try { rep.click(); } catch (e) { } }
            await dormir(25);
            const win = document.getElementById(p + 'win');
            if (win && win.classList.contains('show')) {
              const sig = document.getElementById(p + 'wnext');
              if (sig) { sig.click(); await dormir(300); }
            }
          }
          const salir = document.getElementById(p + 'pX');
          if (salir) { salir.click(); await dormir(150); }
        }
      }
      const cerrar = capa(p) && capa(p).querySelector('.pa34-x');
      if (cerrar) { cerrar.click(); await dormir(200); }
    }

    return { frases: Array.from(dicho), fallos: Array.from(new Set(fallos)) };
  }, { lang: LANG, juegos: JUEGOS, vueltas: VUELTAS });

  await navegador.close();

  // Los fonemas sueltos —"sss", "aa"— se dicen con rate 0.8 como apoyo de la
  // letra, no son frases; grabarlos sería grabar un ruido.
  const fonema = /^[a-záéíóúñ]{1,4}$/i;
  const limpio = cosecha.frases
    .map((t) => t.replace(/\s+$/, ''))
    .filter((t) => t && !(fonema.test(t) && !/^\d+$/.test(t)))
    .filter((t, i, a) => a.indexOf(t) === i)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));

  /* ---------- el rabo que no se deja jugar ----------
     Quedan unas pocas frases que ningún clic alcanza: las de los juegos que
     se ganan arrastrando piezas, y las que salen de un temporizador —el
     "Aguanta" y el "Suelta el aire..." de la respiración— que este recorrido
     adelanta sin esperar. Se recogen leyendo el código, pero solo cuando la
     frase es un literal entero dentro de say()/setPrompt(): nada compuesto,
     nada interpolado. Un literal así es exactamente lo que se le pasa a la
     voz, así que sigue sin haber desajuste posible; y si alguna acabara
     sobrando, el coste es un clip de más que nadie pide, no una frase muda. */
  const estatico = new Set();
  if (LANG === 'en') {
    const lit = '"((?:[^"\\\\]|\\\\.)*)"';
    const pat = new RegExp(
      '(?:setPrompt|say|speak)\\(\\s*T\\(\\s*' + lit + '\\s*,\\s*' + lit +
      '\\s*\\)\\s*(?:,\\s*(?:true|false)\\s*)?\\)', 'g');
    for (const f of fs.readdirSync(path.join(RAIZ, 'fase4'))) {
      const spec = path.join(RAIZ, 'fase4', f, 'spec.js');
      if (!fs.existsSync(spec)) continue;
      const src = fs.readFileSync(spec, 'utf8');
      let m;
      while ((m = pat.exec(src))) {
        const en = m[2].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
        if (en && !/[$]\{/.test(en)) estatico.add(en);
      }
    }
  }
  const nuevas = Array.from(estatico).filter((t) => !limpio.includes(t));
  if (nuevas.length) {
    console.log('del código, no del juego:', nuevas.length);
    nuevas.forEach((t) => console.log('   +', t));
  }
  const todas = limpio.concat(nuevas)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));

  const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine'];
  const items = todas.map((t) => {
    const it = { lang: LANG, text: t, rank: 0 };
    // Un dígito suelto lo lee el sintetizador como quiere; mejor decirle la
    // palabra y que el clip quede igual de estable que los demás.
    if (LANG === 'en' && /^\d$/.test(t)) it.say = NUM[+t];
    return it;
  });

  fs.writeFileSync(path.resolve(RAIZ, SALIDA),
    JSON.stringify(items, null, 0).replace(/\},\{/g, '},\n {')
      .replace(/^\[/, '[').replace(/\]$/, ']\n'));
  console.log('frases:', items.length, '->', SALIDA);
  if (cosecha.fallos.length) console.log('juegos con fallo:', cosecha.fallos);
  if (errores.length) console.log('errores de página:', errores.slice(0, 5));
})();
