const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fileUrl = 'file://' + path.join(root, 'index.html');

// Esta ola no añade una función nueva: fija el arreglo de un defecto que el
// usuario vio y que ningún test veía. Al reabrir la app aparecía "la versión
// antigua" —el <style> en línea de index.html— y luego iba morfando al arte
// nuevo pieza por pieza. La causa era estructural, no de caché sucia:
//   · el loader encadenaba los 14 módulos críticos de forma estrictamente
//     serial, así que costaban 14 viajes de red seguidos;
//   · y el SW forzaba cache:'reload' en todo el mismo origen, de modo que la
//     caché nunca servía para ir rápido, sólo como red offline.
// En la primera visita el portón de #50 tapaba el morfeo; en las siguientes el
// portón ya no se construye, y de ahí el "siempre que abro de nuevo el link".
// Lo que hay que proteger, entonces, es que el CSS crítico siga llegando en un
// solo lote y que la cascada no cambie de orden al hacerlo.

test('Fase 4 · #58: las hojas críticas se piden todas de golpe, no una tras otra', async ({ page }) => {
  await page.goto(fileUrl);
  // Sin esperar a que la cadena de spec.js termine: si la carga fuese serial,
  // aquí sólo existiría el <link> del primer módulo.
  await page.waitForTimeout(120);
  const n = await page.evaluate(() =>
    document.querySelectorAll('link[rel=stylesheet][href*="fase4/"]').length
  );
  const loader = fs.readFileSync(path.join(root, 'fase4/fase4.js'), 'utf8');
  const body = loader.match(/CRITICAL_MODULES\s*=\s*\[([\s\S]*?)\n\s*\];/)[1];
  const criticos = [...body.matchAll(/["']([0-9]{2}-[a-z0-9-]+)["']/g)].map((m) => m[1]);
  expect(criticos.length).toBeGreaterThan(10);
  expect(n).toBeGreaterThanOrEqual(criticos.length);
});

test('Fase 4 · #58: el orden de la cascada es el mismo que la lista crítica', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(3000);
  const orden = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel=stylesheet][href*="fase4/"]')].map((l) =>
      l.getAttribute('href').split('fase4/')[1].split('/')[0]
    )
  );
  const loader = fs.readFileSync(path.join(root, 'fase4/fase4.js'), 'utf8');
  const body = loader.match(/CRITICAL_MODULES\s*=\s*\[([\s\S]*?)\n\s*\];/)[1];
  const criticos = [...body.matchAll(/["']([0-9]{2}-[a-z0-9-]+)["']/g)].map((m) => m[1]);
  // los críticos ocupan la cabeza del <head>, en su orden exacto: es lo que
  // garantiza que paralelizar la descarga no cambie qué regla gana.
  expect(orden.slice(0, criticos.length)).toEqual(criticos);
  // y ninguno se duplicó por culpa de la precarga
  expect(new Set(orden).size).toBe(orden.length);
});

test('Fase 4 · #58: cada spec.js crítico se precarga en paralelo', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(120);
  const pre = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel=preload][as=script]')].map((l) => l.getAttribute('href'))
  );
  const loader = fs.readFileSync(path.join(root, 'fase4/fase4.js'), 'utf8');
  const body = loader.match(/CRITICAL_MODULES\s*=\s*\[([\s\S]*?)\n\s*\];/)[1];
  const criticos = [...body.matchAll(/["']([0-9]{2}-[a-z0-9-]+)["']/g)].map((m) => m[1]);
  criticos.forEach((m) => {
    expect(pre).toContain('fase4/' + m + '/spec.js');
  });
});

test('Fase 4 · #58: el arte se sirve de caché al instante y el shell no', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  // stale-while-revalidate SÓLO para fase4/: responde con lo cacheado y
  // revalida por detrás.
  expect(sw).toMatch(/url\.pathname\.indexOf\('\/fase4\/'\)!==-1/);
  // el shell sigue siendo network-first: ahí una versión vieja sí duele.
  expect(sw).toMatch(/fetch\(req,\{cache:'reload'\}\)/);
  // y la rama de fase4 aparece ANTES del network-first, o nunca se usaría
  expect(sw.indexOf("indexOf('/fase4/')")).toBeLessThan(sw.indexOf("fetch(req,{cache:'reload'})"));
});

test('Fase 4 · #58: la versión de CACHE y la marca del portón van sincronizadas', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const gate = fs.readFileSync(path.join(root, 'fase4/50-progreso-carga/spec.js'), 'utf8');
  const vSw = sw.match(/const CACHE='pequenautas-v(\d+)'/)[1];
  const vGate = gate.match(/PA_DONE_KEY = 'pa_precache_done_v(\d+)'/)[1];
  // si se desincronizan, un usuario con arte viejo en caché nunca vuelve a ver
  // el portón y por tanto nunca espera a que se baje el arte nuevo.
  expect(vGate).toBe(vSw);
});
