const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// El portón (#50) hace fail-open deliberado en file://: isSecureRegistrableContext()
// devuelve false porque ahí el Service Worker ni se registra, así que esperar su
// precache atraparía al peque sin motivo. Estos tests verifican justamente eso —
// que la carga en dos fases no rompe nada y que el portón no aparece donde no debe.

test('Fase 4 · #50: la carga en dos fases no rompe el núcleo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(2500);
  const g = await page.evaluate(() => ({
    core: typeof window.roundReading === 'function' &&
          typeof window.startGame === 'function' &&
          typeof window.afterCorrect === 'function' &&
          typeof window.refreshHome === 'function',
    loader: typeof window.PA_loadModule === 'function',
    gate: window.__pa50 === true,
    // #49 vive en la fase diferida: si su flag está puesto, la segunda
    // cadena arrancó y terminó de verdad, no solo la crítica.
    deferred: window.__pa49 === true,
    // el orden de inyección refleja el split: todo lo crítico entra al DOM
    // antes que cualquier módulo diferido.
    lastCritical: [...document.querySelectorAll('script[src^="fase4/"]')]
      .findIndex((s) => s.src.indexOf('50-progreso-carga') !== -1),
    firstDeferred: [...document.querySelectorAll('script[src^="fase4/"]')]
      .findIndex((s) => s.src.indexOf('01-eval-pre-post') !== -1),
  }));
  expect(g.core).toBe(true);
  expect(g.loader).toBe(true);
  expect(g.gate).toBe(true);
  expect(g.deferred).toBe(true);
  expect(g.lastCritical).toBeGreaterThanOrEqual(0);
  expect(g.firstDeferred).toBeGreaterThan(g.lastCritical);
  expect(errors).toEqual([]);
});

test('Fase 4 · #50: en file:// el portón hace fail-open y no bloquea', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({
    gates: document.querySelectorAll('#pa50gate').length,
    locked: document.documentElement.classList.contains('pa50lock'),
  }));
  expect(st.gates).toBe(0);
  expect(st.locked).toBe(false);
  // y la app sigue siendo usable: se puede crear un perfil
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'W50');
  await page.click('#createBtn');
  await page.waitForTimeout(400);
  await expect(page.locator('#home')).toBeVisible();
});

test('Fase 4 · #50: PA_loadModule es idempotente y no duplica etiquetas', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(2500);
  const n = await page.evaluate(() => {
    const before = document.querySelectorAll('script[src*="48-avatares"]').length +
                   document.querySelectorAll('link[href*="48-avatares"]').length;
    window.PA_loadModule('48-avatares');
    window.PA_loadModule('48-avatares');
    const after = document.querySelectorAll('script[src*="48-avatares"]').length +
                  document.querySelectorAll('link[href*="48-avatares"]').length;
    return { before, after };
  });
  expect(n.after).toBe(n.before);
});

test('Fase 4 · #50: el loader y el sw cubren exactamente los mismos módulos', () => {
  const root = path.resolve(__dirname, '..');
  const loader = fs.readFileSync(path.join(root, 'fase4/fase4.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const pick = (src, name) => {
    const body = src.match(new RegExp(name + '\\s*=\\s*\\[([\\s\\S]*?)\\n\\s*\\];'))[1];
    return [...body.matchAll(/["']([0-9]{2}-[a-z0-9-]+)["']/g)].map((m) => m[1]);
  };
  const critical = pick(loader, 'CRITICAL_MODULES');
  const deferred = pick(loader, 'DEFERRED_MODULES');
  const all = [...critical, ...deferred];
  const swList = pick(sw, 'FASE4_MODULES');

  // sin duplicados dentro del loader
  expect(new Set(all).size).toBe(all.length);
  // el precache del SW cubre exactamente lo mismo que carga el loader
  expect([...all].sort()).toEqual([...swList].sort());
  // el portón es crítico; los iconos del quiz son diferidos
  expect(critical).toContain('50-progreso-carga');
  expect(deferred).toContain('49-iconos-quiz-letras');
  // y todas las carpetas existen de verdad. Solo se exige spec.js: hay
  // módulos sin hoja de estilos propia (p.ej. 28-pwa-tiendas) y el loader
  // ya tolera que ese <link> no resuelva.
  for (const m of all) {
    expect(fs.existsSync(path.join(root, 'fase4', m, 'spec.js'))).toBe(true);
  }
});
