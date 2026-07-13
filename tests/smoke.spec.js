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

test('la pantalla de perfiles crea un perfil y lleva al hub con 3 materias', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createProfile(page, 'Sofia');
  await expect(page.locator('.subject')).toHaveCount(3);
  await expect(page.locator('#chipNm')).toHaveText('Sofia');
  expect(errors).toEqual([]);
});

test('el juego de numeros suma una estrella al acertar', async ({ page }) => {
  await createProfile(page, 'Ana');
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

test('la pista progresiva revela la respuesta correcta tras dos fallas', async ({ page }) => {
  await createProfile(page, 'Leo');
  await page.click('.subject[data-game="math"]');
  await page.waitForTimeout(500);
  const count = await page.$$eval('#stage .obj', (els) => els.length);
  const btns = await page.$$('#stage .choice');
  let wrong = 0;
  for (const b of btns) {
    const n = await b.$eval('.cnum', (el) => parseInt(el.textContent, 10)).catch(() => null);
    if (n !== count && wrong < 2) { await b.click(); wrong++; await page.waitForTimeout(250); }
  }
  await expect(page.locator('#stage .choice.reveal')).toHaveCount(1);
});

test('el progreso del perfil persiste tras recargar', async ({ page }) => {
  await createProfile(page, 'Emma');
  await page.reload();
  await page.waitForTimeout(400);
  await expect(page.locator('.pcard .nm', { hasText: 'Emma' })).toHaveCount(1);
});

test('cambia el idioma de ES a EN en la interfaz', async ({ page }) => {
  await page.goto(fileUrl);
  await page.click('#langBtn');
  await expect(page.locator('#lblMath')).toHaveText('Numbers');
});

test('la ronda de ciencias de dieta se renderiza con categorias herbivoro/carnivoro', async ({ page }) => {
  await createProfile(page, 'Cora');
  await page.click('.subject[data-game="science"]');
  await page.waitForTimeout(400);
  const ok = await page.evaluate(() => {
    S.game = 'science'; S.round = 1; renderScienceRound();
    return typeof DIET_CAT !== 'undefined' && document.querySelectorAll('#stage .choice').length >= 2;
  });
  expect(ok).toBe(true);
});

test('los controles de limite de sesion existen en Ajustes', async ({ page }) => {
  await createProfile(page, 'Nico');
  await page.click('#adultBtn');
  await page.waitForTimeout(200);
  const hb = await page.$('#holdBtn'); const box = await hb.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(1300); await page.mouse.up();
  await page.waitForTimeout(200);
  await page.click('#tabSet');
  await expect(page.locator('#sessLimitToggle')).toHaveCount(1);
  await expect(page.locator('#sessMinsChoices')).toHaveCount(1);
});
