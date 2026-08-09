const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// Auditoría de coherencia: las capas aditivas de fase 4 (#53 formas, #54
// ingenio, #55 música, #58 emociones, #60 hábitos) repintan su menú cuando
// el usuario cambia de idioma con la capa abierta, EXCEPTO #60, a la que le
// faltaba esa línea (a diferencia de #53, que sí la tiene desde su propia
// ola). Esta prueba cubre la corrección para #60, siguiendo el mismo patrón
// que ya prueba este comportamiento para #34 en fase4-wave29.spec.js.

test('Fase 4 · #60: cambiar de idioma con el menú de hábitos abierto lo repinta sin cerrarlo', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lee');
  await page.click('#createBtn');
  await page.waitForTimeout(1800);
  await page.click('.subject[data-game="habits"]');
  await page.waitForTimeout(400);
  await expect(page.locator('.pa60-ov')).toHaveClass(/show/);
  const antes = await page.evaluate(() => document.querySelector('.pa60-sheet').textContent);
  expect(antes).toContain('Elige un juego');

  // #langBtn queda visualmente tapado por el overlay de #60 (mismo dialog
  // modal que #34), asi que un tap normal nunca lo alcanza -eso es
  // intencional-. Pero sigue en el DOM y en el orden de tabulacion, asi que
  // a quien navega con teclado o lector de pantalla el boton le sigue
  // funcionando. Se dispara asi, no con click(), para probar ese camino
  // real en vez de una interaccion que ningun usuario puede hacer.
  await page.locator('#langBtn').dispatchEvent('click');
  await page.waitForTimeout(500);
  await expect(page.locator('.pa60-ov')).toHaveClass(/show/); // sigue abierta
  const despues = await page.evaluate(() => document.querySelector('.pa60-sheet').textContent);
  expect(despues).toContain('Choose a game');
  expect(despues).not.toContain('Elige un juego');
});
