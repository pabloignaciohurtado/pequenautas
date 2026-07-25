const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #52 rediseña las tarjetas de "Elige un juego": una ilustración por JUEGO
// (doce) en vez de un icono por MECÁNICA (cinco), mucho más grande, y la
// tarjeta pasa de rectángulo blanco flotante a recorte de papel integrado
// con el diorama. Todo cuelga de html.pa52.

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  // #34 y #52 son diferidos: hay que darles su margen
  await page.waitForTimeout(3000);
}

test('Fase 4 · #52: el módulo activa y no rompe el núcleo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(3000);
  const g = await page.evaluate(() => ({
    flag: window.__pa52 === true,
    cls: document.documentElement.classList.contains('pa52'),
    core: typeof window.roundReading === 'function' &&
          typeof window.startGame === 'function' &&
          typeof window.refreshHome === 'function',
  }));
  expect(g.flag).toBe(true);
  expect(g.cls).toBe(true);
  expect(g.core).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · #52: cada juego tiene SU propia ilustración, y grande', async ({ page }) => {
  await entrar(page);
  await page.locator('.subject').nth(1).click();   // 0=Números 1=Letras 2=Animales
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.pa34-game')];
    return cards.map((c) => {
      const m = c.querySelector('.mech');
      const cs = getComputedStyle(m);
      return {
        id: c.getAttribute('data-pa34-game'),
        h: parseFloat(cs.height),
        img: cs.backgroundImage,
      };
    });
  });
  expect(r.length).toBe(4);
  for (const c of r) {
    // el icono era de 42px con dibujo de 30px: eso era la queja
    expect(c.h).toBeGreaterThan(88);
    expect(c.img).toContain('data:image/webp');
  }
  // y no comparten dibujo: una viñeta por juego, no una por mecánica
  expect(new Set(r.map((c) => c.img)).size).toBe(4);
});

test('Fase 4 · #52: las tres secciones traen doce viñetas distintas', async ({ page }) => {
  await entrar(page);
  const vistas = new Set();
  for (let i = 0; i < 3; i++) {
    await page.locator('.subject').nth(i).click();
    await page.waitForTimeout(1000);
    const imgs = await page.evaluate(() =>
      [...document.querySelectorAll('.pa34-game .mech')]
        .map((m) => getComputedStyle(m).backgroundImage));
    imgs.forEach((x) => vistas.add(x));
    await page.locator('.pa34-x').first().click();
    await page.waitForTimeout(500);
  }
  expect(vistas.size).toBe(12);
});

test('Fase 4 · #52: la tarjeta deja de ser un rectángulo blanco flotante', async ({ page }) => {
  await entrar(page);
  await page.locator('.subject').nth(0).click();
  await page.waitForTimeout(1200);

  const s = await page.evaluate(() => {
    const c = document.querySelector('.pa34-game');
    const cs = getComputedStyle(c);
    return {
      bg: cs.backgroundImage,
      border: cs.borderTopWidth,
      // esquinas desparejas: recorte de papel, no rectángulo vectorial
      r1: cs.borderTopLeftRadius,
      r2: cs.borderTopRightRadius,
      align: cs.alignItems,
    };
  });
  // papel: degradado cálido, no el #FFFDF7 plano de #34
  expect(s.bg).toContain('gradient');
  expect(s.border).toBe('2px');
  expect(s.r1).not.toBe(s.r2);
  expect(s.align).toBe('center');
});

test('Fase 4 · #52: registrado en el loader y en el precache del sw', () => {
  const root = path.resolve(__dirname, '..');
  const loader = fs.readFileSync(path.join(root, 'fase4/fase4.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const pick = (src, name) => {
    const body = src.match(new RegExp(name + '\\s*=\\s*\\[([\\s\\S]*?)\\n\\s*\\];'))[1];
    return [...body.matchAll(/["']([0-9]{2}-[a-z0-9-]+)["']/g)].map((m) => m[1]);
  };
  const deferred = pick(loader, 'DEFERRED_MODULES');
  const all = [...pick(loader, 'CRITICAL_MODULES'), ...deferred];
  // solo se ve dentro del overlay de #34: diferido, y después de #34
  expect(deferred).toContain('52-juegos-tarjetas');
  expect(deferred.indexOf('52-juegos-tarjetas')).toBeGreaterThan(deferred.indexOf('34-juegos'));
  expect([...all].sort()).toEqual([...pick(sw, 'FASE4_MODULES')].sort());
  expect(new Set(all).size).toBe(all.length);

  // las doce viñetas viajan embebidas: nada de binarios en el repo
  const imgDir = path.join(root, 'fase4/52-juegos-tarjetas/img');
  const hojas = fs.readdirSync(imgDir).filter((f) => f.endsWith('.css'));
  const css = hojas.map((f) => fs.readFileSync(path.join(imgDir, f), 'utf8')).join('\n');
  const vars = [...css.matchAll(/--pa52-([a-z-]+):url\("?data:image\/webp;base64,/g)].map((m) => m[1]);
  expect(vars.length).toBe(12);
  expect(new Set(vars).size).toBe(12);
  // y spec.css las importa todas: si una hoja no se importa, el sw no la
  // precachea y el dibujo desaparece al quedarse sin red.
  const hoja = fs.readFileSync(path.join(root, 'fase4/52-juegos-tarjetas/spec.css'), 'utf8');
  hojas.forEach((f) => expect(hoja).toContain('@import url("img/' + f + '")'));

  // #52 es aditivo: no reescribe #34
  const spec = fs.readFileSync(path.join(root, 'fase4/52-juegos-tarjetas/spec.js'), 'utf8');
  expect(spec).not.toContain('SECTIONS');
});
