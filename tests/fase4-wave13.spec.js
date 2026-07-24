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
  if (await app.count()) { await app.click(); await page.waitForTimeout(500); }
}

test('Fase 4 · Oleada 13: #43 carga sin romper el núcleo ni oleadas previas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(1200);
  const g = await page.evaluate(() => ({
    core: typeof window.roundReading === 'function' && typeof window.startGame === 'function' && typeof window.afterCorrect === 'function',
    flag: window.__pa43 === true,
  }));
  expect(g.core).toBe(true);
  expect(g.flag).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · Oleada 13: en el quiz de letras, los .cface muestran icono papercraft (emoji oculto)', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1200);
  await mk(page, 'W13a');
  await openReadingQuiz(page);
  await expect(page.locator('#stage .lettertile')).toHaveCount(1);
  const cfaces = page.locator('#stage .choice .cface');
  await expect(cfaces.first()).toBeVisible();
  const info = await cfaces.evaluateAll((els) => els.map((el) => ({
    hasOn: el.classList.contains('pa43-ico-on'),
    fontSize: getComputedStyle(el).fontSize,
    hasBg: getComputedStyle(el).backgroundImage !== 'none',
  })));
  for (const it of info) {
    expect(it.hasOn).toBe(true);
    expect(it.fontSize).toBe('0px');
    expect(it.hasBg).toBe(true);
  }
});

test('Fase 4 · Oleada 13: el zorro del chip de perfil se ilustra solo durante el quiz de letras (no fuera de él)', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1200);
  await mk(page, 'W13b');
  // En home: el chip no debe llevar la clase de icono aún si el avatar es zorro.
  const homeState = await page.evaluate(() => {
    const av = document.querySelector('#profileChip .av');
    return av ? { txt: av.textContent.trim(), on: av.classList.contains('pa43-fox-on') } : null;
  });
  expect(homeState).not.toBeNull();
  if (homeState.txt === '🦊') {
    expect(homeState.on).toBe(false);
  }
  await openReadingQuiz(page);
  const quizState = await page.evaluate(() => {
    const av = document.querySelector('#profileChip .av');
    return av ? { txt: av.textContent.trim(), on: av.classList.contains('pa43-fox-on') } : null;
  });
  if (quizState.txt === '🦊') {
    expect(quizState.on).toBe(true);
    const fs = await page.evaluate(() => getComputedStyle(document.querySelector('#profileChip .av')).fontSize);
    expect(fs).toBe('0px');
  }
  // Volviendo a home, se desactiva de nuevo.
  await page.click('#homeBtn');
  await page.waitForTimeout(400);
  const backState = await page.evaluate(() => {
    const av = document.querySelector('#profileChip .av');
    return av ? av.classList.contains('pa43-fox-on') : null;
  });
  expect(backState).toBe(false);
});

test('Fase 4 · Oleada 13: no hay fuga fuera del quiz de letras (math/science no muestran clases pa43-*)', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1200);
  await mk(page, 'W13c');
  await page.click('.subject[data-game="math"]');
  await page.waitForTimeout(300);
  const mathApp = page.locator('[data-pa34-app="math"]');
  if (await mathApp.count()) { await mathApp.click(); await page.waitForTimeout(500); }
  const leaked = await page.evaluate(() => {
    const els = document.querySelectorAll('#stage [class*="pa43-"]');
    return els.length;
  });
  expect(leaked).toBe(0);
});
