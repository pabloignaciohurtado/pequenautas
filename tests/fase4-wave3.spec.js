const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

async function mk(page, name){
  await page.click('.pcard.add'); await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', name); await page.click('#createBtn');
  await page.waitForTimeout(300);
}

test('Fase 4 · Oleada 3: los 4 módulos cargan, exponen API y no rompen el núcleo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(1400);
  const g = await page.evaluate(() => ({
    seq: typeof window.__seq === 'object',
    adaptive: typeof window.AdaptiveEngine === 'object',
    zdp: typeof window.ZDP === 'object',
    reco: typeof window.__reco === 'object',
    // dispatchers ampliados de la Oleada 2 siguen presentes (los envuelve #8)
    o2: typeof window.__mathAdv === 'object' && typeof window.CONTENT_API === 'object',
    // núcleo intacto
    core: typeof window.roundMath === 'function' && typeof window.roundReading === 'function' && typeof window.renderScienceRound === 'function' && typeof window.refreshHome === 'function',
    // Oleada 1 intacta
    o1: typeof window.__assess === 'object' && typeof window.srsCompute === 'function',
  }));
  expect(g.seq).toBe(true);
  expect(g.adaptive).toBe(true);
  expect(g.zdp).toBe(true);
  expect(g.reco).toBe(true);
  expect(g.o2).toBe(true);
  expect(g.core).toBe(true);
  expect(g.o1).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · Oleada 3: por defecto solo UN motor de best.math activo (#6 ON, #8 OFF)', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1400);
  const r = await page.evaluate(() => ({
    adaptiveOn: window.AdaptiveEngine.isOn() === true,
    zdpOff: window.ZDP.isOn() === false,
    rowAdaptive: !!document.getElementById('setAdaptive'),
    rowZdp: !!document.getElementById('setZdp'),
  }));
  expect(r.adaptiveOn).toBe(true);
  expect(r.zdpOff).toBe(true);
  expect(r.rowAdaptive).toBe(true);
  expect(r.rowZdp).toBe(true);
});

test('Fase 4 · Oleada 3: 3 materias por defecto (regresión) y nivel-0 de Números con .cnum + estrella', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1400);
  await expect(page.locator('.subject')).toHaveCount(3);
  await mk(page, 'W3reg');
  await page.click('.subject[data-game="math"]');
  await page.click('[data-pa34-app="math"]');
  await page.waitForTimeout(500);
  expect(await page.locator('#stage .choice .cnum').count()).toBeGreaterThan(0);
  const count = await page.$$eval('#stage .obj', (els) => els.length);
  const btns = await page.$$('#stage .choice');
  for (const b of btns) {
    const n = await b.$eval('.cnum', (el) => parseInt(el.textContent, 10)).catch(() => null);
    if (n === count) { await b.click(); break; }
  }
  await page.waitForTimeout(400);
  await expect(page.locator('#starCount')).toHaveText('1');
});

test('Fase 4 · #6↔#8 compat: con ambos motores activos, best.math PERSISTIDO nunca cambia', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1400);
  await mk(page, 'W3compat');
  const r = await page.evaluate(() => {
    const p = window.currentProfile();
    const baseline = (p.best && typeof p.best.math === 'number') ? p.best.math : 0;
    // activa el 2º motor: ahora #6 (ON por defecto) y #8 sesgan best.math a la vez
    window.ZDP.setOn(true);
    window.ZDP.forceTier('math', 2);           // fuerza sesgo máximo de reto
    // dispara varias rondas de Números: cada wrapper intercambia best.math y lo restaura en finally
    for (let i = 0; i < 6; i++) { try { window.roundMath(); } catch (e) {} }
    const after = (window.currentProfile().best && typeof window.currentProfile().best.math === 'number') ? window.currentProfile().best.math : 0;
    return { baseline, after, bothActive: window.AdaptiveEngine.isOn() === true && window.ZDP.isOn() === true };
  });
  expect(r.bothActive).toBe(true);
  // el sesgo es EFÍMERO (finally restore): el nivel/insignia persistido no se altera
  expect(r.after).toBe(r.baseline);
});
