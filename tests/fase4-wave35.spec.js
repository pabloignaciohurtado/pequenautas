const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// Regresión del fix de #48: el shorthand `background` de #31 sobre .avopt.sel
// devolvía background-repeat a `repeat` y background-position a `0% 0%`, así
// que el retrato seleccionado se anclaba arriba-izquierda y se repetía en
// mosaico dentro de la casilla (se asomaba un segundo zorro por el borde).

test('Fase 4 · #48: el avatar seleccionado se ve centrado y sin mosaico', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(2500);
  await page.click('.pcard.add');
  await page.waitForTimeout(300);
  // probar varios, no solo el primero: el bug se veía en cualquiera
  for (const i of [0, 4, 6]) {
    await page.locator('.avopt').nth(i).click();
    await page.waitForTimeout(200);
    const cs = await page.evaluate(() => {
      const el = document.querySelector('.avopt.sel');
      const s = getComputedStyle(el);
      return {
        repeat: s.backgroundRepeat,
        pos: s.backgroundPosition,
        img: s.backgroundImage,
        marcado: el.hasAttribute('data-pa48'),
      };
    });
    if (!cs.marcado) continue; // sin #48 activo no hay retrato que proteger
    expect(cs.repeat).toBe('no-repeat');
    expect(cs.pos).toBe('50% 50%');
    expect(cs.img).toContain('data:image/webp');
  }
});

test('Fase 4 · #48: los no seleccionados también quedan centrados y sin repetir', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(2500);
  await page.click('.pcard.add');
  await page.waitForTimeout(300);
  await page.locator('.avopt').first().click();
  await page.waitForTimeout(200);
  const malos = await page.evaluate(() =>
    [...document.querySelectorAll('.avopt[data-pa48]:not(.sel)')].filter((el) => {
      const s = getComputedStyle(el);
      return s.backgroundRepeat !== 'no-repeat' || s.backgroundPosition !== '50% 50%';
    }).length);
  expect(malos).toBe(0);
});
