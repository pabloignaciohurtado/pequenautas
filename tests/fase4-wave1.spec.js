const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

test('Fase 4 · Oleada 1: los 5 módulos cargan sin errores y exponen su API', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(800);
  const g = await page.evaluate(() => ({
    assess: typeof window.__assess === 'object' && !!window.__assess,
    ab: typeof window.abVariant === 'function' && typeof window.__ab === 'object',
    srs: typeof window.srsCompute === 'function' && typeof window.__srs === 'object',
    domi: typeof window.__domi === 'object' && !!window.__domi,
    frust: typeof window.__frustration === 'object' && !!window.__frustration,
    core: typeof window.nextRound === 'function' && typeof window.afterCorrect === 'function' && typeof renderEducator === 'function',
  }));
  expect(g.assess).toBe(true);
  expect(g.ab).toBe(true);
  expect(g.srs).toBe(true);
  expect(g.domi).toBe(true);
  expect(g.frust).toBe(true);
  expect(g.core).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · Oleada 1: el flujo de juego sigue premiando (regresión núcleo)', async ({ page }) => {
  await page.goto(fileUrl);
  await expect(page.locator('#profiles')).toBeVisible();
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Fase4');
  await page.click('#createBtn');
  await page.waitForTimeout(300);
  await page.click('.subject[data-game="math"]');
  await page.waitForTimeout(500);
  const count = await page.$$eval('#stage .obj', (els) => els.length);
  const btns = await page.$$('#stage .choice');
  for (const b of btns) {
    const n = await b.$eval('.cnum', (el) => parseInt(el.textContent, 10)).catch(() => null);
    if (n === count) { await b.click(); break; }
  }
  await page.waitForTimeout(400);
  await expect(page.locator('#starCount')).toHaveText('1');
});

test('Fase 4 · #2 A/B: variante estable por perfil (mismo id → misma variante)', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(800);
  const v = await page.evaluate(() => {
    const a = window.abVariant({ id: 'pX' });
    const b = window.abVariant({ id: 'pX' });
    return { a, b, valid: (a === 'A' || a === 'B') };
  });
  expect(v.valid).toBe(true);
  expect(v.a).toBe(v.b);
});

test('Fase 4 · #3 SRS: sólo vencen ítems que alguna vez fallaron', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const ev = [];
    for (let i = 0; i < 40; i++) ev.push({ g:'math', k:'math-3', ft:1, at:1, ms:1000, as:0 });
    ev.push({ g:'math', k:'math-5', ft:0, at:2, ms:3000, as:0 });
    for (let i = 0; i < 40; i++) ev.push({ g:'math', k:'math-x'+i, ft:1, at:1, ms:900, as:0 });
    const out = window.srsCompute({ id:'p', ev });
    const keys = out.map(o => o.key);
    return { hasFailed: keys.includes('math-5'), hasClean: keys.includes('math-3') };
  });
  expect(r.hasFailed).toBe(true);
  expect(r.hasClean).toBe(false);
});
