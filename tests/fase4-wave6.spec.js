const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

async function mk(page, name){
  await page.click('.pcard.add'); await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', name); await page.click('#createBtn');
  await page.waitForTimeout(300);
}

test('Fase 4 · Oleada 6: #28 expone PEQUE_STORE, núcleo y oleadas previas intactos, sin errores', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(1600);
  const g = await page.evaluate(() => ({
    store: typeof window.PEQUE_STORE === 'object',
    isPackaged: typeof window.PEQUE_STORE.isPackaged === 'boolean',
    platform: typeof window.PEQUE_STORE.platform === 'string',
    core: typeof window.passGate === 'function' && typeof window.refreshHome === 'function' && typeof window.startGame === 'function' && typeof window.afterCorrect === 'function' && typeof window.onWrong === 'function',
    // oleadas previas intactas
    prev: typeof window.ZDP === 'object' && typeof window.AdaptiveEngine === 'object' && typeof window.__reco === 'object' && typeof window.CONTENT_API === 'object' && typeof window.__parentalControls === 'object',
  }));
  expect(g.store).toBe(true);
  expect(g.isPackaged).toBe(true);
  expect(g.platform).toBe(true);
  expect(g.core).toBe(true);
  expect(g.prev).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · Oleada 6: seguridad de red — cero peticiones nuevas fuera de file:// durante alta de perfil + una ronda de juego', async ({ page }) => {
  // Los únicos orígenes no-file:// preexistentes en index.html (línea 9, ajeno a Fase 4)
  // son la hoja de estilo de Google Fonts (fonts.googleapis.com) y el propio archivo de
  // fuente que esa hoja referencia vía @font-face (fonts.gstatic.com) — ambos ya
  // presentes desde antes de Oleada 6, y que fallan solos bajo file:///offline sin
  // bloquear la app. Lo que este test verifica es que los módulos de Oleada 6
  // (#25/#26/#27 OFF por defecto + #28) no abren NINGÚN socket propio: cero peticiones
  // nuevas fuera de esos dos orígenes conocidos.
  const KNOWN_PRE_EXISTING = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];
  const offOrigin = [];
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith('file://') && !KNOWN_PRE_EXISTING.some(function(p){ return u.startsWith(p); })) offOrigin.push(u);
  });
  await page.goto(fileUrl);
  await page.waitForTimeout(1600);
  await mk(page, 'NetSafe');
  await page.click('.subject[data-game="math"]');
  await page.waitForTimeout(500);
  const count = await page.$$eval('#stage .obj', (els) => els.length);
  const btns = await page.$$('#stage .choice');
  for (const b of btns) {
    const n = await b.$eval('.cnum', (el) => parseInt(el.textContent, 10)).catch(() => null);
    if (n === count) { await b.click(); break; }
  }
  await page.waitForTimeout(400);
  expect(offOrigin).toEqual([]);
});

test('Fase 4 · Oleada 6: 3 materias (regresión), nivel 0 Números .cnum y estrella al acertar', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1600);
  await expect(page.locator('.subject')).toHaveCount(3);
  await mk(page, 'W6reg');
  await page.click('.subject[data-game="math"]');
  await page.waitForTimeout(500);
  expect(await page.locator('#stage .choice .cnum').count()).toBeGreaterThan(0);
  const count = await page.$$eval('#stage .obj', (els) => els.length);
  const btns = await page.$$('#stage .choice');
  for (const b of btns) {
    const n = await b.$eval('.cnum', (el) => parseInt(el.textContent, 10)).catch(() => null);
    if (n === count) { await b.click(); break; }
  }
  await page.waitForTimeout(400);
  await expect(page.locator('#starCount')).toHaveText('1');
});
