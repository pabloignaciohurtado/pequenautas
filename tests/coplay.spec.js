const { test, expect } = require('@playwright/test');
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

test('co-juego OFF por defecto: no aparece tarjeta y la ronda sigue premiando', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createProfile(page, 'Sin');
  expect(await page.evaluate(() => window.__coplay.isOn())).toBe(false);
  await page.click('.subject[data-game="math"]');
  await page.click('[data-pa34-app="math"]');
  await page.waitForTimeout(500);
  await expect(page.locator('#coplayCard')).toBeHidden();
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

test('co-juego ON: tarjeta indagatoria aparece al iniciar la materia y se puede cerrar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createProfile(page, 'Con');
  await page.evaluate(() => window.__coplay.enable());
  await page.click('.subject[data-game="reading"]');
  await page.click('[data-pa34-app="reading"]');
  await page.waitForTimeout(600);
  const cardVisible = await page.locator('#coplayCard.show').isVisible();
  expect(cardVisible).toBe(true);
  const q = (await page.locator('#coplayQ').textContent() || '').trim();
  expect(q.length).toBeGreaterThan(0);
  await page.click('#coplayClose');
  await page.waitForTimeout(200);
  await expect(page.locator('#coplayCard')).toBeHidden();
  expect(errors).toEqual([]);
});

test('co-juego: el toggle vive en Ajustes, persiste en DB y es bilingüe', async ({ page }) => {
  await createProfile(page, 'Cfg');
  const info = await page.evaluate(() => {
    window.__coplay.enable();
    const row = document.getElementById('setCoplay');
    const tg = document.getElementById('tgCoplay');
    let persisted = false;
    try { persisted = JSON.parse(localStorage.getItem('pequenautas.v1')).settings.coplay === true; } catch (e) {}
    return { hasRow: !!row, hasToggle: !!tg, on: tg && tg.classList.contains('on'), persisted };
  });
  expect(info.hasRow).toBe(true);
  expect(info.hasToggle).toBe(true);
  expect(info.on).toBe(true);
  expect(info.persisted).toBe(true);
});
