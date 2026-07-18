const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

async function mk(page, name){
  await page.click('.pcard.add'); await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', name); await page.click('#createBtn');
  await page.waitForTimeout(300);
}

test('Fase 4 · Oleada 5: los 4 módulos cargan, exponen API y no rompen el núcleo ni oleadas previas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(1600);
  const g = await page.evaluate(() => ({
    album: typeof window.__album === 'object',
    weeklyReport: typeof window.__weeklyReport === 'object',
    weeklyGoal: typeof window.__weeklyGoal === 'object',
    aula: typeof window.PequeAula === 'object',
    // #24 "biblioteca-cojuego" NO se integró (COPLAY_Q vive dentro de una IIFE,
    // inalcanzable sin editar app.js): el hook #16-preexistente __coplay debe
    // seguir intacto y funcionando exactamente como antes de esta oleada.
    coplayUnaffected: typeof window.__coplay === 'object' && typeof window.__coplay.enable === 'function',
    core: typeof window.passGate === 'function' && typeof window.refreshHome === 'function' && typeof window.startGame === 'function' && typeof window.afterCorrect === 'function',
    // oleadas previas intactas
    prev: typeof window.ZDP === 'object' && typeof window.__parentalControls === 'object' && typeof window.CONTENT_API === 'object',
  }));
  expect(g.album).toBe(true);
  expect(g.weeklyReport).toBe(true);
  expect(g.weeklyGoal).toBe(true);
  expect(g.aula).toBe(true);
  expect(g.coplayUnaffected).toBe(true);
  expect(g.core).toBe(true);
  expect(g.prev).toBe(true);
  expect(errors).toEqual([]);
});

test('Fase 4 · Oleada 5: #tabAlbum, #tabAula y #tabParental (Oleada 4) conviven sin duplicados', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1600);
  const counts = await page.evaluate(() => ({
    album: document.querySelectorAll('#tabAlbum').length,
    aula: document.querySelectorAll('#tabAula').length,
    parental: document.querySelectorAll('#tabParental').length,
    // las 3 pestañas nuevas viven en el mismo único contenedor .tabs
    // (#adultView .tabs === #sheet .tabs: adultView está anidado en sheet)
    sameContainer: document.querySelector('#adultView .tabs') === document.querySelector('#sheet .tabs'),
  }));
  expect(counts.album).toBe(1);
  expect(counts.aula).toBe(1);
  expect(counts.parental).toBe(1);
  expect(counts.sameContainer).toBe(true);
});

test('Fase 4 · #21/#22: #weekGoalCard antepuesto en #progBody sin pisar #assessHead (Oleada 1)', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1600);
  await mk(page, 'W5prog');
  // jugar una ronda para generar actividad y datos de evaluación
  await page.click('.subject[data-game="math"]');
  await page.click('[data-pa34-app="math"]');
  await page.waitForTimeout(500);
  const count = await page.$$eval('#stage .obj', (els) => els.length);
  const btns = await page.$$('#stage .choice');
  for (const b of btns) {
    const n = await b.$eval('.cnum', (el) => parseInt(el.textContent, 10)).catch(() => null);
    if (n === count) { await b.click(); break; }
  }
  await page.waitForTimeout(500);
  await page.evaluate(() => { $('sheet').classList.add('show'); showSheetView('adultView'); showTab('prog'); });
  await page.waitForTimeout(400);
  const order = await page.evaluate(() => {
    const host = document.getElementById('progBody');
    if (!host) return null;
    return {
      firstChildId: host.firstElementChild ? host.firstElementChild.id : null,
      hasGoalCard: !!host.querySelector('#weekGoalCard'),
      hasAssessHead: !!host.querySelector('#assessHead'),
      // #weeklyReportBox (#21) es HERMANO de #progBody (insertAdjacentElement
      // 'afterend' dentro de #progView), no un hijo — documentando la
      // ubicación real, no una suposición.
      weeklyReportIsSiblingNotChild: !host.contains(document.getElementById('weeklyReportBox')) && !!document.getElementById('weeklyReportBox'),
    };
  });
  expect(order).not.toBeNull();
  expect(order.hasGoalCard).toBe(true);
  // #weekGoalCard, cuando existe, es efectivamente el primer hijo de #progBody
  // (MASTER_PLAN: "#22 antepone #weekGoalCard como primer hijo de #progBody").
  expect(order.firstChildId).toBe('weekGoalCard');
  expect(order.weeklyReportIsSiblingNotChild).toBe(true);
});

test('Fase 4 · Oleada 5: 3 materias (regresión), level-0 Números con .cnum y estrella al acertar', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1600);
  await expect(page.locator('.subject')).toHaveCount(3);
  await mk(page, 'W5reg');
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
