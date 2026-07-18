const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

async function mk(page, name){
  await page.click('.pcard.add'); await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', name); await page.click('#createBtn');
  await page.waitForTimeout(300);
}

test('Fase 4 · Oleada 2: los 5 módulos cargan, exponen API y no rompen el núcleo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(1200);
  const g = await page.evaluate(() => ({
    more: typeof window.__moreSubjects === 'object',
    mathAdv: typeof window.__mathAdv === 'object',
    readingAdv: typeof window.__readingAdv === 'object',
    scienceAdv: typeof window.__scienceAdv === 'object',
    cms: typeof window.CONTENT_API === 'object' && typeof window.CONTENT === 'object',
    core: typeof window.roundMath === 'function' && typeof window.roundReading === 'function' && typeof window.renderScienceRound === 'function',
    o1: typeof window.__assess === 'object' && typeof window.srsCompute === 'function' && typeof window.__frustration === 'object',
  }));
  expect(g.more).toBe(true);
  expect(g.mathAdv).toBe(true);
  expect(g.readingAdv).toBe(true);
  expect(g.scienceAdv).toBe(true);
  expect(g.cms).toBe(true);
  expect(g.core).toBe(true);
  expect(g.o1).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · Oleada 2: 3 materias por defecto (regresión) y nivel-0 de Números sigue con .cnum', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1200);
  await expect(page.locator('.subject')).toHaveCount(3);
  expect(await page.evaluate(() => window.__moreSubjects.isOn())).toBe(false);
  await mk(page, 'W2reg');
  await page.click('.subject[data-game="math"]');
  await page.click('[data-pa34-app="math"]');
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

test('Fase 4 · #11: materias nuevas opt-in (enable agrega 3 → 6)', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1200);
  const n = await page.evaluate(() => { window.__moreSubjects.enable(); return document.querySelectorAll('.subject').length; });
  expect(n).toBe(6);
});

test('Fase 4 · #15 CMS: CONTENT_API vigente y no-custom por defecto', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({
    hasContent: !!window.CONTENT_API.get(),
    lettersOk: Array.isArray(LETTERS.es) && LETTERS.es.length > 0,
    notCustom: window.CONTENT_API.isCustom() === false,
  }));
  expect(r.hasContent).toBe(true);
  expect(r.lettersOk).toBe(true);
  expect(r.notCustom).toBe(true);
});
