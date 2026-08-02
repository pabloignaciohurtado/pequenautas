const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

async function createProfile(page, name) {
  await page.goto(fileUrl);
  await expect(page.locator('#profiles')).toBeVisible();
  await page.click('.pcard.add');
  await page.waitForTimeout(300);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', name || 'Test');
  await page.click('#createBtn');
  await page.waitForTimeout(300);
  await expect(page.locator('#home')).toBeVisible();
}

// El módulo #34 no engancha las tarjetas de materia en cuanto carga: entra
// diferido y las busca con un sondeo cada 400 ms, marcando cada tarjeta con
// data-pa34 al conseguirlo. Pulsar antes de esa marca no da un error visible
// —el clic cae en el manejador viejo y arranca el juego directamente— pero la
// rejilla de juegos no llega a abrirse nunca, así que la espera posterior se
// agota entera. Por eso aquí se espera la marca en vez de un tiempo fijo: la
// carrera no se pierde por ir lento, se pierde por adelantarse.
async function entrarAJuego(page, key) {
  const tarjeta = page.locator('.subject[data-game="' + key + '"][data-pa34="1"]');
  await tarjeta.waitFor({ state: 'attached' });
  await tarjeta.click();
  await page.click('[data-pa34-app="' + key + '"]');
}

test('el doc de estrategia bilingue existe y la app carga sin errores', async ({ page }) => {
  const docPath = path.resolve(__dirname, '../docs/bilingue.md');
  expect(fs.existsSync(docPath)).toBe(true);
  expect(fs.readFileSync(docPath, 'utf8')).toMatch(/Modo de idioma/);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  const ok = await page.evaluate(() => typeof window.applyBilingualLang === 'function' && typeof window.bilMode === 'function');
  expect(ok).toBe(true);
  expect(errors).toEqual([]);
});

test('el control de Modo de idioma aparece en Ajustes, persiste por perfil y no rompe el juego', async ({ page }) => {
  // Esta prueba carga la app dos veces —una al crear el perfil y otra al
  // recargar para comprobar que la preferencia sobrevive—, así que gasta el
  // doble que sus vecinas. Con el minuto de serie iba justa en un corredor
  // ocupado, y una prueba que falla por poco acaba enseñando a no mirar el
  // rojo del CI.
  test.slow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createProfile(page, 'Bili');
  expect(await page.evaluate(() => window.bilMode())).toBe('immersion');
  await page.evaluate(() => { $('sheet').classList.add('show'); showSheetView('adultView'); showTab('set'); });
  await page.waitForTimeout(150);
  await expect(page.locator('#bilModeChoices button[data-mode="mirror"]')).toBeVisible();
  await page.click('#bilModeChoices button[data-mode="mirror"]');
  expect(await page.evaluate(() => currentProfile().langMode)).toBe('mirror');
  await page.reload();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => currentProfile().langMode)).toBe('mirror');
  await page.evaluate(() => { $('sheet').classList.remove('show'); });
  await entrarAJuego(page, 'math');
  await page.waitForTimeout(500);
  const count = await page.$$eval('#stage .obj', (els) => els.length);
  const btns = await page.$$('#stage .choice');
  for (const b of btns) {
    const n = await b.$eval('.cnum', (el) => parseInt(el.textContent, 10)).catch(() => null);
    if (n === count) { await b.click(); break; }
  }
  await page.waitForTimeout(400);
  await expect(page.locator('#starCount')).toHaveText('1');
  expect(errors).toEqual([]);
});

test('el modo Alternado cambia la lengua entre rondas', async ({ page }) => {
  await createProfile(page, 'Alt');
  await page.evaluate(() => { const p = currentProfile(); p.langMode = 'alternate'; saveDB(); });
  await entrarAJuego(page, 'reading');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('es');
  const flipped = await page.evaluate(() => { S.round = 1; nextRound(); return document.documentElement.lang; });
  expect(flipped).toBe('en');
});
