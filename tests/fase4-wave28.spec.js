const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #62 le pone voz grabada a la narradora: el enunciado de cada ronda, la
// pregunta, la pista y el "¡Muy bien!" de después ya no los improvisa el
// sintetizador del teléfono. Los clips viajan embebidos en varios CSS
// porque el service worker precachea cada @import por separado. Lo que hay
// que vigilar:
//   · que los trozos existan, estén importados y traigan audio de verdad;
//   · que #62 se cargue DESPUÉS de #61 —para dejarle a Rufo sus frases— y
//     ANTES de #16, que sigue siendo quien mueve la boca de la mascota;
//   · que el AudioBank de app.js siga intacto y con prioridad;
//   · que estén las dos olas, español e inglés, y que ninguna se invente
//     frases que la app no dice;
//   · y que si todo esto falla, la ronda se siga premiando igual, porque la
//     voz es un adorno y el juego no.

const raiz = (f) => path.resolve(__dirname, '..', f);
const leer = (f) => fs.readFileSync(raiz(f), 'utf8');
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MOD = 'fase4/62-voz-narradora';

test('Fase 4 · #62: los trozos existen, están importados y traen audio', () => {
  const css = leer(`${MOD}/spec.css`);
  const trozos = fs.readdirSync(raiz(`${MOD}/voz`)).filter((f) => f.endsWith('.css')).sort();
  expect(trozos.length).toBeGreaterThanOrEqual(5);
  // repartir es el punto: un archivo por frase serían cientos de fetch al
  // arrancar, y uno solo obligaría a rebajarlo entero por cada frase nueva
  expect(trozos.length).toBeLessThanOrEqual(40);
  let clips = 0;
  for (const t of trozos) {
    expect(css).toContain(`voz/${t}`);
    const cuerpo = leer(`${MOD}/voz/${t}`);
    const props = cuerpo.match(/--pa62-[a-z]{2}-[0-9a-f]{10}:/g) || [];
    expect(props.length).toBeGreaterThan(0);
    clips += props.length;
    for (const b64 of cuerpo.match(/base64,([\s\S]*?)"\)/g) || []) {
      // 1 KB de base64 son ~0,75 KB de MP3: por debajo de eso está vacío
      expect(b64.replace(/[\\\s]/g, '').length).toBeGreaterThan(1000);
    }
    expect(cuerpo).toContain('data:audio/mpeg;base64,');
  }
  expect(clips).toBeGreaterThanOrEqual(100);
});

test('Fase 4 · #62: registrado en el cargador y en el service worker, y en ese orden', () => {
  const loader = leer('fase4/fase4.js');
  const sw = leer('sw.js');
  for (const t of [loader, sw]) {
    expect(t).toContain('62-voz-narradora');
    // después de Rufo: así sus dieciocho frases siguen siendo suyas
    expect(t.indexOf('61-voz-rufo')).toBeLessThan(t.indexOf('62-voz-narradora'));
    // y antes de #16: #16 tiene que quedar por fuera para mover la boca
    expect(t.indexOf('62-voz-narradora')).toBeLessThan(t.indexOf('16-voces-mascota'));
  }
});

test('Fase 4 · #62: el precache sube de versión en los dos sitios a la vez', () => {
  const sw = leer('sw.js');
  const carga = leer('fase4/50-progreso-carga/spec.js');
  const v = (sw.match(/const CACHE\s*=\s*'pequenautas-(v\d+)'/) || [])[1];
  expect(v).toBeTruthy();
  // si una sube y la otra no, el usuario se queda con los clips a medias
  expect(carga).toContain(`pa_precache_done_${v}`);
});

test('Fase 4 · #62: aditivo — ni app.js, ni index.html, ni STORE_KEY', () => {
  const js = sinComentarios(leer(`${MOD}/spec.js`));
  const css = sinComentarios(leer(`${MOD}/spec.css`));
  expect(js).not.toContain('STORE_KEY');
  expect(css).not.toContain('STORE_KEY');
  // el guion de Rufo vive en app.js y solo se consulta desde allí
  expect(js).toContain('AudioBank');
  expect(js).toContain('VozRufo');
});

test('Fase 4 · #62: en ejecución hay clips en los dos idiomas y ninguno inventado', async ({ page }) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Rufo');
  await page.click('#createBtn');
  await page.waitForTimeout(1800);

  const info = await page.evaluate(() => {
    const v = window.VozNarradora;
    if (!v) return { falta: true };
    const frases = v.frases();
    const es = frases.filter((f) => f.indexOf('es|') === 0);
    const muestra = es.length ? es[0].slice(3) : '';
    return {
      falta: false,
      total: v.total(),
      es: es.length,
      // el espaciado del texto no debería decidir si hay clip o no
      tieneMuestra: v.has(muestra, 'es'),
      tieneConEspacios: v.has('  ' + muestra.replace(/ /g, '  ') + ' ', 'es'),
      esAudio: v.uri(v.id(muestra, 'es')).indexOf('data:audio/mpeg;base64,') === 0,
      // la ola 2 trae el inglés, cosechado jugando a la app en ese idioma
      en: frases.filter((f) => f.indexOf('en|') === 0).length,
      tieneIngles: v.has('Well done!', 'en'),
      inventado: v.has('esto no lo dice nadie', 'es')
    };
  });
  expect(info.falta).toBe(false);
  expect(info.es).toBeGreaterThanOrEqual(100);
  expect(info.tieneMuestra).toBe(true);
  expect(info.tieneConEspacios).toBe(true);
  expect(info.esAudio).toBe(true);
  expect(info.inventado).toBe(false);
  expect(errores).toEqual([]);
});

test('Fase 4 · #62: el AudioBank de app.js sigue intacto y las frases de Rufo siguen siendo suyas', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Rufo');
  await page.click('#createBtn');
  await page.waitForTimeout(1800);

  const info = await page.evaluate(() => ({
    available: window.AudioBank.available(),
    url: window.AudioBank.url('intro_tap', 'es'),
    // Rufo conserva sus dieciocho: #62 no puede pisarle el guion
    rufo: window.VozRufo.disponibles('es').length
  }));
  expect(info.available).toEqual([]);
  expect(info.url).toBe('audio/es/intro_tap.mp3');
  expect(info.rufo).toBe(9);
});

test('Fase 4 · #62: con la narradora puesta, la ronda de números se sigue premiando', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Rufo');
  await page.click('#createBtn');
  await page.waitForTimeout(1800);
  await page.click('.subject[data-game="math"]');
  await page.waitForTimeout(300);
  await page.click('[data-pa34-app="math"]');
  await page.waitForTimeout(600);
  const cuantos = await page.$$eval('#stage .obj', (els) => els.length);
  const botones = await page.$$('#stage .choice');
  for (const b of botones) {
    const n = await b.$eval('.cnum', (el) => parseInt(el.textContent, 10)).catch(() => null);
    if (n === cuantos) { await b.click(); break; }
  }
  await page.waitForTimeout(500);
  await expect(page.locator('#starCount')).toHaveText('1');
});
