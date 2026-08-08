const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

async function mk(page, name){
  await page.click('.pcard.add'); await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', name); await page.click('#createBtn');
  await page.waitForTimeout(300);
}

async function openReadingQuiz(page){
  await page.click('.subject[data-game="reading"]');
  await page.waitForTimeout(300);
  const app = page.locator('[data-pa34-app="reading"]');
  if (await app.count()) {
    await app.click();
    await page.waitForTimeout(200);
    await page.click('.pa34-lvl.cur');
    await page.waitForTimeout(500);
  }
}

test('Fase 4 · #49: carga sin romper el nucleo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(1500);
  const g = await page.evaluate(() => ({
    core: typeof window.roundReading === 'function' && typeof window.startGame === 'function' && typeof window.afterCorrect === 'function',
    flag: window.__pa49 === true,
  }));
  expect(g.core).toBe(true);
  expect(g.flag).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · #49: en el quiz de letras los .cface muestran icono papercraft', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1500);
  await mk(page, 'W49a');
  await openReadingQuiz(page);
  await expect(page.locator('#stage .lettertile')).toHaveCount(1);
  const cfaces = page.locator('#stage .choice .cface');
  await expect(cfaces.first()).toBeVisible();
  const info = await cfaces.evaluateAll((els) => els.map((el) => ({
    hasOn: el.classList.contains('pa49-ico-on'),
    fontSize: getComputedStyle(el).fontSize,
    bg: getComputedStyle(el).backgroundImage,
  })));
  for (const it of info) {
    expect(it.hasOn).toBe(true);
    expect(it.fontSize).toBe('0px');
    expect(it.bg).toContain('data:image/webp');
  }
});

test('Fase 4 · #49: no hay fuga de clases pa49-* fuera del quiz de letras', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1500);
  await mk(page, 'W49b');
  await page.click('.subject[data-game="math"]');
  await page.waitForTimeout(300);
  const mathApp = page.locator('[data-pa34-app="math"]');
  if (await mathApp.count()) {
    await mathApp.click();
    await page.waitForTimeout(200);
    await page.click('.pa34-lvl.cur');
    await page.waitForTimeout(500);
  }
  const leaked = await page.evaluate(() => document.querySelectorAll('#stage [class*="pa49-"]').length);
  expect(leaked).toBe(0);
});
