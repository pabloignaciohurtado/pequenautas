const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// #50 · el portón de carga nunca puede atrapar al peque.
//
// Bug real (reportado por Ignacio en el APK de prueba): en un teléfono la
// página tarda más de 8 s en disparar 'load', y app.js registra el SW recién
// ahí. El temporizador de 8 s del portón vencía antes de que el SW existiera,
// retiraba el portón (fail-open) y, cuando por fin llegaba el progreso del
// SW, update() lo RECONSTRUÍA; como ya estaba marcado como retirado, ni
// 'precache-complete' podía quitarlo. Quedaba fijo en "Descargando
// recursos… 100%".
//
// Estos tests montan el módulo en un origen https falso con un Service
// Worker simulado y reloj controlado, para recorrer esos caminos sin red.

const SPEC = fs.readFileSync(path.resolve(__dirname, '../fase4/50-progreso-carga/spec.js'), 'utf8');
const KEY = SPEC.match(/PA_DONE_KEY = '([^']+)'/)[1];

async function montar(page, { readyAlInicio }) {
  await page.route('https://pa50.test/**', (r) => r.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body><div id="app">app</div></body></html>',
  }));
  await page.clock.install();
  await page.addInitScript(({ readyAlInicio }) => {
    const sw = new EventTarget();
    let resolverReady;
    sw.ready = new Promise((r) => { resolverReady = r; });
    sw.controller = null;
    sw.registros = 0;
    sw.register = () => { sw.registros++; return Promise.resolve({}); };
    sw.activar = () => resolverReady({});
    sw.enviar = (data) => sw.dispatchEvent(new MessageEvent('message', { data }));
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
    if (readyAlInicio) sw.activar();
  }, { readyAlInicio });
  await page.goto('https://pa50.test/');
  await page.evaluate(() => localStorage.clear());
  await page.addScriptTag({ content: SPEC });
}

const porton = (page) => page.locator('#pa50gate');

test('Fase 4 · #50: si el portón se retira por tiempo, el progreso tardío NO lo vuelve a levantar', async ({ page }) => {
  await montar(page, { readyAlInicio: false });
  await expect(porton(page)).toHaveCount(1);
  // el SW nunca llega a activarse: tope de registro y fail-open
  await page.clock.runFor(31000);
  await expect(porton(page)).toHaveCount(0);
  // ahora sí llega el SW con su progreso: el portón no puede reaparecer
  await page.evaluate(() => navigator.serviceWorker.enviar({ type: 'precache-progress', done: 26, total: 53 }));
  await page.evaluate(() => navigator.serviceWorker.enviar({ type: 'precache-progress', done: 53, total: 53 }));
  await page.clock.runFor(500);
  await expect(porton(page)).toHaveCount(0);
  // y al completar se recuerda, para entrar directo la próxima vez
  await page.evaluate(() => navigator.serviceWorker.enviar({ type: 'precache-complete', failed: [] }));
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('1');
});

test('Fase 4 · #50: los 8 s de silencio cuentan desde que el SW está activo, no desde el arranque', async ({ page }) => {
  await montar(page, { readyAlInicio: false });
  // página lenta: pasan 12 s sin SW (antes, a los 8 s ya se retiraba)
  await page.clock.runFor(12000);
  await expect(porton(page)).toHaveCount(1);
  // el SW se activa y empieza a informar: el portón sigue y avanza
  await page.evaluate(() => navigator.serviceWorker.activar());
  await page.evaluate(() => navigator.serviceWorker.enviar({ type: 'precache-progress', done: 10, total: 53 }));
  await page.clock.runFor(1000);
  await expect(page.locator('#pa50pct')).toHaveText('Descargando recursos… 19%');
  await page.evaluate(() => navigator.serviceWorker.enviar({ type: 'precache-complete', failed: [] }));
  await page.clock.runFor(600);
  await expect(porton(page)).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('1');
});

test('Fase 4 · #50: SW activo pero mudo → se retira a los 8 s (fail-open) sin marcar completo', async ({ page }) => {
  await montar(page, { readyAlInicio: true });
  await page.clock.runFor(7000);
  await expect(porton(page)).toHaveCount(1);
  await page.clock.runFor(1600);
  await expect(porton(page)).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
});

test('Fase 4 · #50: registra el SW sin esperar a window load', async ({ page }) => {
  await montar(page, { readyAlInicio: false });
  expect(await page.evaluate(() => navigator.serviceWorker.registros)).toBe(1);
});

// #63 · lo que vio la auditoría del APK en un teléfono en horizontal.
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');
async function entrarHorizontal(page) {
  await page.setViewportSize({ width: 892, height: 412 });
  await page.goto(fileUrl);
  await page.waitForTimeout(500);
  await page.click('.pcard.add');
  await page.waitForTimeout(300);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  await page.waitForTimeout(3500);
}

test('Fase 4 · #63: en horizontal, la hoja de cada materia nueva deja ver la × y entrar al nivel 1', async ({ page }) => {
  await entrarHorizontal(page);
  for (const [card, ov] of [['.subject.pa53-card', '.pa53-ov'], ['.subject.pa54-card', '.pa54-ov'], ['.subject.pa55-card', '.pa55-ov'], ['#pa58Card', '.pa58-ov'], ['.subject.pa60-card', '.pa60-ov']]) {
    await page.locator(card).scrollIntoViewIfNeeded();
    await page.evaluate((c) => document.querySelector(c).click(), card);
    await page.waitForTimeout(600);
    const x = await page.locator(ov + ' .pa34-x').boundingBox();
    expect(x.y, ov + ' × visible').toBeGreaterThanOrEqual(0);
    expect(x.width).toBeGreaterThanOrEqual(48);
    await page.locator(ov + ' .pa34-game').first().click();
    await page.waitForTimeout(450);
    await page.locator(ov + ' .pa34-lvl.cur').click(); // antes: "outside of the viewport"
    await page.waitForTimeout(800);
    await page.locator(ov.replace('-ov', '-play') + '.show .pa34-x').click();
    await page.waitForTimeout(600);
  }
});

test('Fase 4 · #63: el botón atrás cierra la capa de arriba en vez de salir de la app', async ({ page }) => {
  await entrarHorizontal(page);
  await page.locator('.subject.pa53-card').click({ force: true });
  await page.waitForTimeout(700);
  await page.locator('.pa53-ov .pa34-game').first().click();
  await page.waitForTimeout(450);
  await page.locator('.pa53-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(900);
  await expect(page.locator('.pa53-play.show')).toHaveCount(1);
  await page.goBack();
  await page.waitForTimeout(700);
  expect(page.url()).toContain('index.html');
  await expect(page.locator('.pa53-play.show')).toHaveCount(0);
  await expect(page.locator('#home.active')).toHaveCount(1);
});

test('Fase 4 · #63: juegos nuevos sobre el bosque, íconos y caras de Grok en vez de emoji, idioma recordado', async ({ page }) => {
  await entrarHorizontal(page);
  await page.evaluate(() => document.querySelector('#pa58Card').click());
  await page.waitForTimeout(600);
  await page.locator('.pa58-ov .pa34-game').first().click();
  await page.waitForTimeout(450);
  await page.locator('.pa58-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const play = document.querySelector('.pa58-play.show');
    const ic = document.querySelector('.pa58-tile .pa58-rf');
    const rep = document.querySelector('#pa58replay');
    return {
      bg: getComputedStyle(play).backgroundImage,
      ic: getComputedStyle(ic).backgroundImage,
      rep: getComputedStyle(rep).backgroundImage, repFont: getComputedStyle(rep).fontSize,
    };
  });
  expect(r.bg).toContain('data:image/webp');
  expect(r.ic).toContain('data:image/webp');
  expect(r.rep).toContain('data:image/webp');
  expect(r.repFont).toBe('0px');
  await page.locator('.pa58-play.show .pa34-x').click();
  await page.waitForTimeout(500);
  await page.evaluate(() => { const x = document.querySelector('.pa58-ov.show .pa34-x'); if (x) x.click(); });
  await page.waitForTimeout(500);

  await page.evaluate(() => document.getElementById('langBtn').click());
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  await page.reload();
  await page.waitForTimeout(3500);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
});
