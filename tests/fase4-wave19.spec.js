const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #54 añade la QUINTA sección —Ingenio— con las cuatro mecánicas que faltaban
// del plan: rompecabezas, silueta-sombra, sendero de un trazo y balanza.
// Repite la frontera delicada de #53 (tarjeta inyectada en una rejilla ya
// enganchada, junto al interceptor en captura de #34) y añade una nueva: la
// rejilla de Home pasa de cuatro a cinco casas.

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  await page.waitForTimeout(3000); // #34/#52/#53/#54 son diferidos
}

async function abrirIngenio(page, i) {
  await page.locator('.subject[data-game="brain"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa54-ov .pa34-game').nth(i).click();
  await page.waitForTimeout(400);
  await page.locator('.pa54-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(600);
}

test('Fase 4 · #54: el módulo activa y no rompe el núcleo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(3000);
  const g = await page.evaluate(() => ({
    flag: window.__pa54 === true,
    prev: window.__pa53 === true,
    core:
      typeof window.startGame === 'function' &&
      typeof window.refreshHome === 'function' &&
      typeof window.addStar === 'function',
  }));
  expect(g.flag).toBe(true);
  expect(g.prev).toBe(true); // #54 no puede desplazar a #53
  expect(g.core).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · #54: la quinta tarjeta existe y no roba el tap a las demás', async ({ page }) => {
  await entrar(page);
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('#home .subject')].map((c) => c.getAttribute('data-game'))
  );
  expect(cards).toEqual(['math', 'reading', 'science', 'shapes', 'brain', 'music', 'emotions']);

  await page.locator('.subject').nth(1).click();
  await page.waitForTimeout(700);
  expect(await page.locator('.pa34-ov.show').count()).toBe(1);
  expect(await page.locator('.pa54-ov.show').count()).toBe(0);
  expect(await page.locator('.pa53-ov.show').count()).toBe(0);
});

test('Fase 4 · #54: cinco casas en dos filas, ninguna huérfana', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await entrar(page);
  const filas = await page.evaluate(() => {
    // offsetTop: el rect incluiría el transform del balanceo de las tarjetas.
    const tops = [...document.querySelectorAll('#home .subject')].map((c) => c.offsetTop);
    const set = [...new Set(tops)];
    return set.map((t) => tops.filter((x) => x === t).length);
  });
  expect(filas).toEqual([3, 3, 1]); // con #58 son siete: 3+3 y la banda ancha de Emociones sola
});

test('Fase 4 · #54: abre su propia sección con cuatro juegos ilustrados', async ({ page }) => {
  await entrar(page);
  await page.locator('.subject[data-game="brain"]').click();
  await page.waitForTimeout(600);
  expect(await page.locator('.pa54-ov.show').count()).toBe(1);

  const games = await page.evaluate(() =>
    [...document.querySelectorAll('.pa54-ov .pa34-game')].map((c) => {
      const m = c.querySelector('.mech');
      const cs = getComputedStyle(m);
      return {
        id: c.getAttribute('data-pa34-game'),
        h: parseFloat(cs.height),
        img: cs.backgroundImage,
        name: (c.querySelector('.gn') || {}).textContent,
      };
    })
  );
  expect(games.map((g) => g.id)).toEqual([
    'brain:puzzle',
    'brain:shadow',
    'brain:path',
    'brain:scale',
  ]);
  for (const g of games) {
    expect(g.img).toContain('data:image/webp');
    expect(g.h).toBeGreaterThan(80); // hereda la banda grande de #52
    expect((g.name || '').length).toBeGreaterThan(3);
  }
});

test('Fase 4 · #54: mapa de cinco niveles con solo el primero abierto', async ({ page }) => {
  await entrar(page);
  await page.locator('.subject[data-game="brain"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa54-ov .pa34-game').first().click();
  await page.waitForTimeout(400);
  expect(await page.locator('.pa54-ov .pa34-lvl').count()).toBe(5);
  expect(await page.locator('.pa54-ov .pa34-lvl.cur').count()).toBe(1);
  expect(await page.locator('.pa54-ov .pa34-lvl.lock').count()).toBe(4);
});

test('Fase 4 · #54: se arma el rompecabezas de verdad y eso desbloquea el nivel 2', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await entrar(page);
  await abrirIngenio(page, 0); // brain:puzzle, nivel 1 = 2x2
  expect(await page.locator('.pa54-play.show').count()).toBe(1);
  expect(await page.locator('.pa54-piece').count()).toBe(4);

  // Cada pieza lleva su índice de destino en data-ix, igual que el hueco:
  // el test resuelve el puzzle emparejándolos, no adivinando.
  for (let ix = 0; ix < 4; ix++) {
    await page.locator(`.pa54-piece[data-ix="${ix}"]`).click();
    await page.waitForTimeout(120);
    await page.locator(`.pa54-slot[data-ix="${ix}"]`).click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(600);
  expect(await page.locator('.pa54-win.show').count()).toBe(1);

  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('pequenautas.f4.ingenio.v1') || '{}')
  );
  expect(saved['brain:puzzle']).toBe(1);
  expect(errors).toEqual([]);
});

test('Fase 4 · #54: las otras tres mecánicas arrancan y pintan su tablero', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await entrar(page);
  const esperado = ['.pa54-tile', '.pa54-foot', '.pa54-w'];
  for (const i of [1, 2, 3]) {
    await abrirIngenio(page, i);
    expect(await page.locator('.pa54-play.show').count()).toBe(1);
    expect(await page.locator(`.pa54-field ${esperado[i - 1]}`).count()).toBeGreaterThan(1);
    await page.locator('#pa54pX').click();
    await page.waitForTimeout(300);
  }
  expect(errors).toEqual([]);
});

test('Fase 4 · #54: el sendero no se resuelve leyendo de izquierda a derecha', async ({ page }) => {
  await entrar(page);
  await abrirIngenio(page, 2); // brain:path
  const ordenados = await page.evaluate(() => {
    const fs = [...document.querySelectorAll('.pa54-foot')];
    const porX = fs.slice().sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
    return porX.every((f, i) => Number(f.dataset.n) === i);
  });
  expect(ordenados).toBe(false);
});

test('Fase 4 · #54: la sección habla el idioma de la app', async ({ page }) => {
  await entrar(page);
  await page.click('#langBtn');
  await page.waitForTimeout(500);
  expect(await page.locator('#pa54Label').textContent()).toBe('Puzzles');
  await page.locator('.subject[data-game="brain"]').click();
  await page.waitForTimeout(500);
  const hd = await page.locator('.pa54-ov .pa34-hd .t').textContent();
  expect(hd).toContain('Puzzle Games');
});

test('Fase 4 · #54: registrado en el loader y en el precache del service worker', async () => {
  const loader = fs.readFileSync(path.resolve(__dirname, '../fase4/fase4.js'), 'utf8');
  const sw = fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8');
  expect(loader).toContain('54-ingenio');
  expect(sw).toContain('54-ingenio');

  const css = fs.readFileSync(path.resolve(__dirname, '../fase4/54-ingenio/spec.css'), 'utf8');
  for (const n of ['home', 'puzzle', 'shadow', 'path', 'scale']) {
    expect(css).toContain(`img/ig-${n}.css`);
    const p = path.resolve(__dirname, `../fase4/54-ingenio/img/ig-${n}.css`);
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).size).toBeLessThan(21000); // techo de subida
  }
});
