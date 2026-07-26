const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #53 añade una CUARTA sección completa —Formas y Colores— con cuatro juegos
// de cinco niveles. Lo delicado no es el contenido sino la convivencia: la
// tarjeta se inyecta en una rejilla que app.js ya enganchó, junto a un módulo
// (#34) que intercepta los taps en .subject en fase de captura. Estos tests
// vigilan justamente esa frontera.

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  await page.waitForTimeout(3000); // #34/#52/#53 son diferidos
}

test('Fase 4 · #53: el módulo activa y no rompe el núcleo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(3000);
  const g = await page.evaluate(() => ({
    flag: window.__pa53 === true,
    core:
      typeof window.startGame === 'function' &&
      typeof window.refreshHome === 'function' &&
      typeof window.addStar === 'function',
    store: localStorage.getItem('pequenautas.f4.formas.v1'),
  }));
  expect(g.flag).toBe(true);
  expect(g.core).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · #53: la cuarta tarjeta existe y no roba el tap a las otras tres', async ({ page }) => {
  await entrar(page);
  const cards = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('#home .subject')];
    return cs.map((c) => c.getAttribute('data-game'));
  });
  expect(cards).toEqual(['math', 'reading', 'science', 'shapes']);

  // Las tres originales siguen abriendo el overlay de #34, no el de #53.
  await page.locator('.subject').nth(1).click();
  await page.waitForTimeout(700);
  expect(await page.locator('.pa34-ov.show').count()).toBe(1);
  expect(await page.locator('.pa53-ov.show').count()).toBe(0);
});

test('Fase 4 · #53: la rejilla de Home no deja huérfana a la cuarta tarjeta', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await entrar(page);
  const rows = await page.evaluate(() => {
    const tops = [...document.querySelectorAll('#home .subject')].map(
      (c) => Math.round(c.getBoundingClientRect().top)
    );
    return [...new Set(tops)].length;
  });
  expect(rows).toBe(2); // 2x2, no 3+1
});

test('Fase 4 · #53: abre su propia sección con cuatro juegos ilustrados', async ({ page }) => {
  await entrar(page);
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(600);
  expect(await page.locator('.pa53-ov.show').count()).toBe(1);

  const games = await page.evaluate(() => {
    return [...document.querySelectorAll('.pa53-ov .pa34-game')].map((c) => {
      const m = c.querySelector('.mech');
      const cs = getComputedStyle(m);
      return {
        id: c.getAttribute('data-pa34-game'),
        h: parseFloat(cs.height),
        img: cs.backgroundImage,
        name: (c.querySelector('.gn') || {}).textContent,
      };
    });
  });
  expect(games.map((g) => g.id)).toEqual([
    'shape:tap',
    'shape:match',
    'color:classify',
    'pattern:tap',
  ]);
  for (const g of games) {
    expect(g.img).toContain('data:image/webp');
    expect(g.h).toBeGreaterThan(80); // hereda la banda grande de #52
    expect((g.name || '').length).toBeGreaterThan(3);
  }
});

test('Fase 4 · #53: mapa de cinco niveles con solo el primero abierto', async ({ page }) => {
  await entrar(page);
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa53-ov .pa34-game').first().click();
  await page.waitForTimeout(400);
  expect(await page.locator('.pa53-ov .pa34-lvl').count()).toBe(5);
  expect(await page.locator('.pa53-ov .pa34-lvl.cur').count()).toBe(1);
  expect(await page.locator('.pa53-ov .pa34-lvl.lock').count()).toBe(4);
});

test('Fase 4 · #53: se puede jugar y ganar un nivel, y eso desbloquea el siguiente', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await entrar(page);
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa53-ov .pa34-game').first().click(); // shape:tap
  await page.waitForTimeout(400);
  await page.locator('.pa53-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(600);
  expect(await page.locator('.pa53-play.show').count()).toBe(1);

  // Resuelve las cuatro rondas leyendo el enunciado: el aria-label de cada
  // ficha lleva el nombre de la forma, así que el test juega "de verdad".
  for (let r = 0; r < 8; r++) {
    if ((await page.locator('.pa53-win.show').count()) > 0) break;
    const prompt = await page.locator('#pa53prompt').textContent();
    const m = prompt.match(/el\s+(.+)\?/);
    if (!m) break;
    await page.locator(`.pa53-tile[aria-label="${m[1]}"]`).first().click();
    await page.waitForTimeout(900);
  }
  expect(await page.locator('.pa53-win.show').count()).toBe(1);

  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('pequenautas.f4.formas.v1') || '{}')
  );
  expect(saved['shape:tap']).toBe(1);
  expect(errors).toEqual([]);
});

test('Fase 4 · #53: las otras tres mecánicas arrancan sin error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await entrar(page);
  for (const i of [1, 2, 3]) {
    await page.locator('.subject[data-game="shapes"]').click();
    await page.waitForTimeout(500);
    await page.locator('.pa53-ov .pa34-game').nth(i).click();
    await page.waitForTimeout(350);
    await page.locator('.pa53-ov .pa34-lvl.cur').click();
    await page.waitForTimeout(600);
    expect(await page.locator('.pa53-play.show').count()).toBe(1);
    expect(await page.locator('.pa53-field .pa53-tile, .pa53-field .pa53-bin').count()).toBeGreaterThan(1);
    await page.locator('#pa53pX').click();
    await page.waitForTimeout(300);
  }
  expect(errors).toEqual([]);
});

test('Fase 4 · #53: la sección habla el idioma de la app', async ({ page }) => {
  await entrar(page);
  await page.click('#langBtn');
  await page.waitForTimeout(500);
  expect(await page.locator('#pa53Label').textContent()).toBe('Shapes');
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(500);
  const hd = await page.locator('.pa53-ov .pa34-hd .t').textContent();
  expect(hd).toContain('Choose a game');
});

test('Fase 4 · #53: registrado en el loader y en el precache del service worker', async () => {
  const loader = fs.readFileSync(path.resolve(__dirname, '../fase4/fase4.js'), 'utf8');
  const sw = fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8');
  expect(loader).toContain('53-formas-colores');
  expect(sw).toContain('53-formas-colores');

  // Las cinco hojas de imagen tienen que estar importadas: el sw las
  // precachea leyendo los @import de spec.css, no una lista aparte.
  const css = fs.readFileSync(
    path.resolve(__dirname, '../fase4/53-formas-colores/spec.css'),
    'utf8'
  );
  for (const n of ['home', 'shape-tap', 'shape-match', 'color-classify', 'pattern-tap']) {
    expect(css).toContain(`img/ig-${n}.css`);
    const p = path.resolve(__dirname, `../fase4/53-formas-colores/img/ig-${n}.css`);
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).size).toBeLessThan(21000); // techo de subida
  }
});
