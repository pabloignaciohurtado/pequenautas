const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #56 convierte toda elección por toque en arrastrar y soltar. Es una capa de
// gesto: no reescribe ningún juego, intercepta el puntero en `document` y al
// soltar sintetiza los clicks que el módulo ya sabía atender. Lo que hay que
// demostrar aquí es exactamente eso:
//   · arrastrar a un destino propio del juego (la canasta) resuelve la ronda;
//   · en elección múltiple sin destino, el enunciado hace de buzón;
//   · soltar en el aire NO cuenta como respuesta —es la vía de escape del
//     niño que se arrepiente a mitad del gesto—;
//   · y el toque simple sigue funcionando, porque es la red de seguridad
//     motriz y también el camino del teclado y del lector de pantalla.

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  await page.waitForTimeout(3000); // los módulos diferidos, #56 el último
}

async function centro(loc) {
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

// Un arrastre de verdad: el módulo exige más de 10 px de recorrido antes de
// considerar que no es un toque, y varios pasos intermedios para que el
// hit-test del destino se actualice como lo haría un dedo.
async function arrastrar(page, origen, destino) {
  const a = await centro(origen);
  const b = await centro(destino);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
  }
  await page.mouse.up();
}

async function abrir(page, materia, juego, ov) {
  await page.locator(`.subject[data-game="${materia}"]`).click();
  await page.waitForTimeout(500);
  await page.locator(`${ov} .pa34-game`).nth(juego).click();
  await page.waitForTimeout(400);
  await page.locator(`${ov} .pa34-lvl.cur`).click();
  await page.waitForTimeout(900);
}

test('Fase 4 · #56: la capa de gesto se activa y no altera la pantalla', async ({ page }) => {
  await entrar(page);
  await expect(page.locator('html.pa56')).toHaveCount(1);
  // no inyecta nada en el documento: ni cajones, ni zonas, ni overlays.
  expect(await page.locator('.pa56-ghost').count()).toBe(0);
  // La capa de gesto no quita ni añade casas: sean las que sean, siguen todas.
  expect(await page.locator('#home .subject').count()).toBeGreaterThanOrEqual(7);
});

test('Fase 4 · #56: arrastrar la figura a su canasta resuelve la ronda', async ({ page }) => {
  await entrar(page);
  await abrir(page, 'shapes', 2, '.pa53-ov'); // cada cosa a su color
  const canastas = page.locator('.pa53-bin');
  expect(await canastas.count()).toBeGreaterThan(1);
  const antes = await page.locator('.pa53-tile.pa53-gone').count();
  // No se puede saber de antemano qué canasta es la correcta sin replicar la
  // lógica del juego, así que se prueban todas: lo que se está midiendo es
  // que el ARRASTRE llega a puntuar igual que el doble toque.
  const ficha = page.locator('.pa53-tile.pa53-sm:not(.pa53-gone)').first();
  const n = await canastas.count();
  for (let i = 0; i < n; i++) {
    await arrastrar(page, ficha, canastas.nth(i));
    await page.waitForTimeout(320);
    if ((await page.locator('.pa53-tile.pa53-gone').count()) > antes) break;
  }
  expect(await page.locator('.pa53-tile.pa53-gone').count()).toBe(antes + 1);
});

test('Fase 4 · #56: durante el arrastre se ve el fantasma y se marcan los destinos', async ({ page }) => {
  await entrar(page);
  await abrir(page, 'shapes', 2, '.pa53-ov');
  const ficha = page.locator('.pa53-tile.pa53-sm').first();
  const a = await centro(ficha);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 30, a.y + 30);
  await page.mouse.move(a.x + 60, a.y + 45);
  await expect(page.locator('.pa56-ghost')).toHaveCount(1);
  expect(await page.locator('.pa53-bin.pa56-target').count()).toBeGreaterThan(1);
  await expect(page.locator('html.pa56-dragging')).toHaveCount(1);
  await page.mouse.up();
  await page.waitForTimeout(200);
  // y al soltar no queda basura en el DOM
  await expect(page.locator('.pa56-ghost')).toHaveCount(0);
  await expect(page.locator('.pa56-target')).toHaveCount(0);
  await expect(page.locator('html.pa56-dragging')).toHaveCount(0);
});

test('Fase 4 · #56: sin destino propio, el enunciado hace de buzón', async ({ page }) => {
  await entrar(page);
  await abrir(page, 'music', 0, '.pa55-ov'); // ¿qué suena? es elección múltiple
  const ficha = page.locator('.pa55-tile').first();
  const a = await centro(ficha);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x, a.y - 25);
  await page.mouse.move(a.x, a.y - 50);
  await expect(page.locator('#pa55prompt.pa56-mail')).toHaveCount(1);
  // el buzón es el enunciado que YA existía: no se ha creado ningún nodo
  expect(await page.locator('.pa55-play .pa56-drop').count()).toBe(0);
  await page.mouse.up();
  await page.waitForTimeout(200);
  await expect(page.locator('.pa56-mail')).toHaveCount(0);
});

test('Fase 4 · #56: llevar la respuesta al enunciado puntúa', async ({ page }) => {
  await entrar(page);
  await abrir(page, 'music', 0, '.pa55-ov');
  const total = await page.locator('#pa55prog i').count();
  expect(total).toBe(4);
  const prompt = page.locator('#pa55prompt');
  const n = await page.locator('.pa55-tile').count();
  for (let i = 0; i < n; i++) {
    await arrastrar(page, page.locator('.pa55-tile').nth(i), prompt);
    await page.waitForTimeout(200);
    if ((await page.locator('#pa55prog i.on').count()) > 0) break;
  }
  expect(await page.locator('#pa55prog i.on').count()).toBe(1);
});

test('Fase 4 · #56: soltar en el aire no cuenta como respuesta', async ({ page }) => {
  await entrar(page);
  await abrir(page, 'shapes', 2, '.pa53-ov');
  const antes = await page.locator('.pa53-tile.pa53-gone').count();
  const ficha = page.locator('.pa53-tile.pa53-sm').first();
  const a = await centro(ficha);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 40, a.y - 40);
  await page.mouse.move(a.x + 90, a.y - 120); // zona vacía del campo
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await page.locator('.pa53-tile.pa53-gone').count()).toBe(antes);
  // y la ficha vuelve entera: ni se queda levantada ni se pierde
  await expect(page.locator('.pa56-lift')).toHaveCount(0);
  expect(await page.locator('.pa53-tile.pa53-sm').count()).toBeGreaterThan(0);
});

test('Fase 4 · #56: el toque simple sigue resolviendo la ronda', async ({ page }) => {
  await entrar(page);
  await abrir(page, 'music', 0, '.pa55-ov');
  const n = await page.locator('.pa55-tile').count();
  for (let i = 0; i < n; i++) {
    await page.locator('.pa55-tile').nth(i).click();
    await page.waitForTimeout(140);
    if ((await page.locator('#pa55prog i.on').count()) > 0) break;
  }
  expect(await page.locator('#pa55prog i.on').count()).toBe(1);
});

test('Fase 4 · #56: la bellota de #34 conserva su propio arrastre', async ({ page }) => {
  await entrar(page);
  // #34 ya tenía arrastre real a la cesta con mousedown/touchstart propios;
  // #56 la excluye a propósito para no robarle el puntero.
  await abrir(page, 'math', 0, '.pa34-ov'); // "Contar y arrastrar"
  const bellotas = await page.locator('.pa34-acorn').count();
  expect(bellotas).toBeGreaterThan(0);
  // el arrastre de la bellota no debe generar el fantasma de #56
  const b = page.locator('.pa34-acorn').first();
  const a = await centro(b);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 40, a.y + 40);
  expect(await page.locator('.pa56-ghost').count()).toBe(0);
  await page.mouse.up();
});
