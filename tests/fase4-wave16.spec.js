const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #51 rediseña el hero de Home: título de portada en Baloo 2, Rufo recortado
// con alfa flotando libre (sin marco ni fondo de bosque propio) y el saludo
// dentro de un globo de cómic. Todo cuelga de html.pa51, así que lo primero
// que hay que verificar es que esa clase llegue de verdad.

test('Fase 4 · #51: el módulo activa y no rompe el núcleo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(2500);
  const g = await page.evaluate(() => ({
    flag: window.__pa51 === true,
    cls: document.documentElement.classList.contains('pa51'),
    font: !!document.querySelector('link[data-pa51font]'),
    core: typeof window.roundReading === 'function' &&
          typeof window.startGame === 'function' &&
          typeof window.refreshHome === 'function',
  }));
  expect(g.flag).toBe(true);
  expect(g.cls).toBe(true);
  expect(g.font).toBe(true);
  expect(g.core).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · #51: el hero pierde el bloque y Rufo queda suelto', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  await page.waitForTimeout(1200);
  await expect(page.locator('#home')).toBeVisible();

  const s = await page.evaluate(() => {
    const hero = document.querySelector('.pa33-hero');
    if (!hero) return { missing: true };
    const cs = getComputedStyle(hero);
    const img = document.querySelector('.pa33-saluda .pa33-saluda-img');
    const ics = img ? getComputedStyle(img) : null;
    const bg = document.querySelector('.pa33-hero .pa33-hero-bg');
    return {
      // sin marco, sin sombra dura, sin recorte
      border: cs.borderTopWidth,
      shadow: cs.boxShadow,
      overflow: cs.overflow,
      // el fondo de bosque propio de #33 ya no se pinta
      bgHidden: bg ? getComputedStyle(bg).display === 'none' : true,
      // Rufo usa la ilustración de #51 y tiene animación de saludo
      zorro: ics ? ics.backgroundImage.indexOf('data:image/webp') !== -1 : false,
      anim: ics ? ics.animationName : '',
    };
  });
  expect(s.missing).toBeUndefined();
  expect(s.border).toBe('0px');
  expect(s.shadow === 'none' || s.shadow === '').toBe(true);
  expect(s.overflow).toBe('visible');
  expect(s.bgHidden).toBe(true);
  expect(s.zorro).toBe(true);
  expect(s.anim).toBe('pa51saluda');
});

test('Fase 4 · #51: el saludo vive en un globo de cómic con colita', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  await page.waitForTimeout(1200);

  const b = await page.evaluate(() => {
    const p = document.querySelector('.pa33-greet .panel');
    if (!p) return { missing: true };
    const cs = getComputedStyle(p);
    const tail = getComputedStyle(p, '::before');
    return {
      pos: cs.position,
      // la hoja base le pone overflow:auto y eso recortaba la colita
      ovf: cs.overflow,
      radius: cs.borderTopLeftRadius,
      border: cs.borderTopWidth,
      // la colita es un triángulo CSS: borde derecho grueso y ancho 0
      tailW: tail.width,
      tailRight: tail.borderRightWidth,
      hi: (document.querySelector('.pa33-greet .hi') || {}).textContent || '',
      sub: (document.querySelector('.pa33-greet .sub') || {}).textContent || '',
    };
  });
  expect(b.missing).toBeUndefined();
  expect(b.pos).toBe('relative');
  expect(b.ovf).toBe('visible');
  expect(parseFloat(b.radius)).toBeGreaterThan(15);
  expect(b.border).toBe('3px');
  expect(b.tailW).toBe('0px');
  expect(parseFloat(b.tailRight)).toBeGreaterThan(10);
  expect(b.hi).toContain('Lea');
  expect(b.sub).toContain('bosque');
});

test('Fase 4 · #51: registrado en el loader y en el precache del sw', () => {
  const root = path.resolve(__dirname, '..');
  const loader = fs.readFileSync(path.join(root, 'fase4/fase4.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const pick = (src, name) => {
    const body = src.match(new RegExp(name + '\\s*=\\s*\\[([\\s\\S]*?)\\n\\s*\\];'))[1];
    return [...body.matchAll(/["']([0-9]{2}-[a-z0-9-]+)["']/g)].map((m) => m[1]);
  };
  const critical = pick(loader, 'CRITICAL_MODULES');
  const all = [...critical, ...pick(loader, 'DEFERRED_MODULES')];
  // el hero se ve en el primer pintado: es crítico, no diferido
  expect(critical).toContain('51-hero-globo');
  // y va después de #33, que es quien construye el nodo que #51 reestiliza
  expect(critical.indexOf('51-hero-globo')).toBeGreaterThan(critical.indexOf('33-hero-diorama'));
  expect([...all].sort()).toEqual([...pick(sw, 'FASE4_MODULES')].sort());
  expect(new Set(all).size).toBe(all.length);
  // la ilustración de Rufo viaja embebida: nada de binarios en el repo
  const css = fs.readFileSync(path.join(root, 'fase4/51-hero-globo/img/ig-zorro.css'), 'utf8');
  expect(css).toContain('--pa51-zorro');
  expect(css).toContain('data:image/webp;base64,');
});
