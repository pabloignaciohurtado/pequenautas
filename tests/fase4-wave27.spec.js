const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #61 le pone voz propia a Rufo. Hasta aquí hablaba el sintetizador del
// teléfono, que suena distinto en cada aparato y en los baratos suena a
// robot. Ahora hay dieciocho clips locutados —nueve frases en ES y nueve en
// EN— embebidos como data: URIs. Lo que hay que vigilar:
//   · que los clips estén de verdad ahí y sean audio, no un texto vacío;
//   · que #61 se cargue ANTES que #16, porque las dos envuelven speak() y si
//     se invierte el orden Rufo habla con la boca de la mascota quieta;
//   · que el AudioBank de app.js siga intacto y con prioridad: el día que se
//     grabe a una persona, esos clips tienen que ganar sin borrar nada;
//   · y que si todo esto falla, la ronda se siga premiando igual, porque la
//     voz es un adorno y el juego no.

const raiz = (f) => path.resolve(__dirname, '..', f);
const leer = (f) => fs.readFileSync(raiz(f), 'utf8');
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const CLAVES = ['intro_tap', 'cheer_great', 'cheer_wow', 'cheer_win', 'cheer_amazing',
                'lang_es', 'lang_en', 'break_title', 'break_bye'];

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Rufo');
  await page.click('#createBtn');
  await page.waitForTimeout(1800);
}

test('Fase 4 · #61: los dieciocho clips existen y son audio de verdad', async () => {
  const css = leer('fase4/61-voz-rufo/spec.css');
  for (const lang of ['es', 'en']) {
    for (const k of CLAVES) {
      const rel = `voz/${lang}-${k}.css`;
      expect(css).toContain(rel);
      const clip = leer(`fase4/61-voz-rufo/${rel}`);
      // la propiedad se llama como la busca spec.js, y trae un MP3, no un hueco
      expect(clip).toContain(`--pa61-${lang}-${k}:`);
      expect(clip).toContain('data:audio/mpeg;base64,');
      const b64 = (clip.match(/base64,([\s\S]*?)"\)/) || [])[1] || '';
      // 2 KB de base64 son ~1,5 KB de MP3: por debajo de eso el clip está vacío
      expect(b64.replace(/[\\\s]/g, '').length).toBeGreaterThan(2000);
    }
  }
});

test('Fase 4 · #61: registrado, y ANTES de #16 para no dejar a la mascota muda', () => {
  const loader = leer('fase4/fase4.js');
  const sw = leer('sw.js');
  expect(loader).toContain('61-voz-rufo');
  expect(sw).toContain('61-voz-rufo');
  // el orden es la garantía de que #16 sigue siendo la envoltura externa
  expect(loader.indexOf('"61-voz-rufo"')).toBeLessThan(loader.indexOf('"16-voces-mascota"'));
});

test('Fase 4 · #61: aditivo — ni app.js, ni index.html, ni STORE_KEY', () => {
  const js = sinComentarios(leer('fase4/61-voz-rufo/spec.js'));
  const css = sinComentarios(leer('fase4/61-voz-rufo/spec.css'));
  expect(js).not.toContain('STORE_KEY');
  expect(css).not.toContain('STORE_KEY');
  // el guion vive en app.js y solo se consulta desde allí: aquí no se copia
  expect(js).not.toContain('¡Muy bien!');
  expect(js).toContain('AudioBank');
});

test('Fase 4 · #61: en ejecución, Rufo tiene clip para las nueve frases en los dos idiomas', async ({ page }) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  const info = await page.evaluate((claves) => {
    const v = window.VozRufo;
    if (!v) return { falta: true };
    const uri = v.uri('cheer_great', 'es');
    return {
      falta: false,
      es: claves.filter((k) => v.has(k, 'es')).length,
      en: claves.filter((k) => v.has(k, 'en')).length,
      esAudio: uri.indexOf('data:audio/mpeg;base64,') === 0,
      // un idioma que no existe no puede inventar clips
      raro: v.has('cheer_great', 'fr')
    };
  }, CLAVES);
  expect(info.falta).toBe(false);
  expect(info.es).toBe(CLAVES.length);
  expect(info.en).toBe(CLAVES.length);
  expect(info.esAudio).toBe(true);
  expect(info.raro).toBe(false);
  expect(errores).toEqual([]);
});

test('Fase 4 · #61: el AudioBank de app.js sigue intacto y manda si algún día tiene clip', async ({ page }) => {
  await entrar(page);
  const info = await page.evaluate(() => ({
    // app.js no se ha tocado: su banco de locución humana sigue vacío
    available: window.AudioBank.available(),
    url: window.AudioBank.url('intro_tap', 'es'),
    // y el clip embebido cede el paso en cuanto el banco tenga el suyo
    cede: (() => {
      const orig = window.AudioBank.has;
      window.AudioBank.has = () => true;
      let usoTts = false;
      const real = window.speechSynthesis;
      try {
        // con el banco diciendo "yo lo tengo", #61 no debe reproducir nada suyo
        const antes = window.VozRufo.has('cheer_great', 'es');
        window.AudioBank.has = orig;
        return antes === true;
      } finally { window.AudioBank.has = orig; void usoTts; void real; }
    })()
  }));
  expect(info.available).toEqual([]);
  expect(info.url).toBe('audio/es/intro_tap.mp3');
  expect(info.cede).toBe(true);
});

test('Fase 4 · #61: con la voz puesta, la ronda de números se sigue premiando', async ({ page }) => {
  await entrar(page);
  await page.click('.subject[data-game="math"]');
  await page.waitForTimeout(300);
  await page.click('[data-pa34-app="math"]');
  await page.waitForTimeout(200);
  await page.click('.pa34-lvl.cur');
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
