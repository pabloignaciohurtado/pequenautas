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
  await page.click('.subject[data-game="math"]');
  await page.click('[data-pa34-app="math"]');
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
  await page.click('.subject[data-game="reading"]');
  await page.click('[data-pa34-app="reading"]');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('es');
  const flipped = await page.evaluate(() => { S.round = 1; nextRound(); return document.documentElement.lang; });
  expect(flipped).toBe('en');
});
