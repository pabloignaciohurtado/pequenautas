const { test, expect } = require('@playwright/test');
const path = require('path');

const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

test('carga sin errores de consola y renderiza el hub con 3 materias', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('.subject')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('el juego de numeros suma una estrella al contar correctamente', async ({ page }) => {
  await page.goto(fileUrl);
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

test('cambia el idioma de ES a EN en la interfaz', async ({ page }) => {
  await page.goto(fileUrl);
  await page.click('#langBtn');
  await expect(page.locator('#lblMath')).toHaveText('Numbers');
});
