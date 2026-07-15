const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

async function mk(page, name){
  await page.click('.pcard.add'); await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', name); await page.click('#createBtn');
  await page.waitForTimeout(300);
}

test('Fase 4 · Oleada 4: los 5 módulos cargan, exponen API y no rompen el núcleo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(1600);
  const g = await page.evaluate(() => ({
    a11y: typeof window.__a11y === 'object',
    dyslexia: typeof window.__dyslexia === 'object',
    mascot: typeof window.__mascot === 'object',
    personaje: typeof window.__personajeAnim === 'object',
    parental: typeof window.__parentalControls === 'object',
    core: typeof window.passGate === 'function' && typeof window.refreshHome === 'function' && typeof window.startGame === 'function' && typeof window.afterCorrect === 'function' && typeof window.onWrong === 'function',
    // oleadas previas intactas
    prev: typeof window.ZDP === 'object' && typeof window.AdaptiveEngine === 'object' && typeof window.__reco === 'object' && typeof window.CONTENT_API === 'object',
  }));
  expect(g.a11y).toBe(true);
  expect(g.dyslexia).toBe(true);
  expect(g.mascot).toBe(true);
  expect(g.personaje).toBe(true);
  expect(g.parental).toBe(true);
  expect(g.core).toBe(true);
  expect(g.prev).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · #16↔#20: un solo personaje (mascota #16 presente → #20 en modo enhance, sin #pa20Pet)', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1600);
  const r = await page.evaluate(() => ({
    mascotNode: !!document.getElementById('peqMascot'),
    mode: window.__personajeAnim.mode(),
    ownNode: !!document.getElementById('pa20Pet'),
  }));
  expect(r.mascotNode).toBe(true);
  expect(r.mode).toBe('enhance');
  expect(r.ownNode).toBe(false); // #20 no crea su propio personaje si #16 ya puso la mascota
});

test('Fase 4 · #30: PIN OFF por defecto (parent-gate no-op) y pestaña Control parental inyectada', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1600);
  const r = await page.evaluate(() => {
    // abrir el área de adultos (como en bilingual.spec)
    $('sheet').classList.add('show'); showSheetView('adultView');
    return {
      pinOff: window.__parentalControls.cfg().pinEnabled === false,
      tabParental: !!document.getElementById('tabParental'),
    };
  });
  expect(r.pinOff).toBe(true);
  expect(r.tabParental).toBe(true);
});

test('Fase 4 · Oleada 4: 3 materias (regresión), filas de Ajustes inyectadas y estrella al acertar', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1600);
  await expect(page.locator('.subject')).toHaveCount(3);
  await mk(page, 'W4reg');
  // abrir Ajustes y comprobar que las 5 filas de Oleada 4 están presentes
  const rows = await page.evaluate(() => {
    $('sheet').classList.add('show'); showSheetView('adultView'); showTab('set');
    return {
      hiContrast: !!document.getElementById('setHiContrast'),
      colorblind: !!document.getElementById('setColorblind'),
      dyslexia: !!document.getElementById('setDyslexia'),
      mascot: !!document.getElementById('setMascot'),
      pa20: !!document.getElementById('setPa20Anim'),
    };
  });
  expect(rows.hiContrast).toBe(true);
  expect(rows.colorblind).toBe(true);
  expect(rows.dyslexia).toBe(true);
  expect(rows.mascot).toBe(true);
  expect(rows.pa20).toBe(true);
  // regresión de juego: cerrar hoja, jugar Números y ganar estrella
  await page.evaluate(() => { $('sheet').classList.remove('show'); });
  await page.click('.subject[data-game="math"]');
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
