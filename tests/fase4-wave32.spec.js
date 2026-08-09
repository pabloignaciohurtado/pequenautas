const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// Auditoría #8 (decisión de producto: "duplicidad / economía de premios /
// badge Nivel N"): esta ola cubre las dos partes de esa decisión que se
// resuelven con código.
//
//   1. Duplicidad (hallazgo #5): #11 (Emociones/Formas y colores/Rutinas)
//      queda retirado — la versión que gana es la de las capas #53/#58/#60.
//      enable() ya no inyecta esas 3 tarjetas (cubierto también en
//      fase4-wave2.spec.js, aquí se confirma que sigue así tras jugar).
//   2. Economía de premios (hallazgo #6): las seis capas (#34/#53/#54/#55/
//      #58/#60) ahora suenan+confeti+estrella en CADA acierto, igual que el
//      modelo base (chime('ok')+confetti()+afterCorrect por ronda), en vez
//      de una sola estrella silenciosa al ganar el nivel completo.
//
// El badge "Nivel N" (hallazgo #8 de los numerados) no necesita cambios de
// código: #12/#13/#14 (mates/lectura/ciencias avanzada) ya hacen escalar el
// tipo de ronda con profile.best.<materia> desde antes de esta ola, y con
// #11 retirado el único caso decorativo que quedaba desaparece.

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Ona');
  await page.click('#createBtn');
  await page.waitForTimeout(3000); // #34/#53/#54/#55/#58/#60 son diferidos
}

test('Fase 4 · #8: en #53 (formas) cada acierto suma estrella, no solo el nivel completo', async ({ page }) => {
  await entrar(page);
  const before = Number((await page.locator('#starCount').textContent()) || '0');
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa53-ov .pa34-game').first().click(); // shape:tap
  await page.waitForTimeout(400);
  await page.locator('.pa53-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(600);
  expect(await page.locator('.pa53-play.show').count()).toBe(1);

  let corrects = 0;
  for (let r = 0; r < 8; r++) {
    if ((await page.locator('.pa53-win.show').count()) > 0) break;
    const prompt = await page.locator('#pa53prompt').textContent();
    const m = prompt.match(/el\s+(.+)\?/);
    if (!m) break;
    await page.locator(`.pa53-tile[aria-label="${m[1]}"]`).first().click();
    corrects++;
    await page.waitForTimeout(900);
    // La estrella global (#starCount) sube EN CADA acierto, no solo al
    // terminar el nivel: es la economía de premios del modelo base.
    const now = Number((await page.locator('#starCount').textContent()) || '0');
    expect(now).toBe(before + corrects);
  }
  expect(await page.locator('.pa53-win.show').count()).toBe(1);
  expect(corrects).toBeGreaterThan(1);
  // Ganar el nivel no regala una estrella extra encima de las ya dadas por
  // acierto (evita el doble conteo que tendría sumar en good() y en
  // winLevel() a la vez).
  const after = Number((await page.locator('#starCount').textContent()) || '0');
  expect(after).toBe(before + corrects);
});

test('Fase 4 · #8: en #34 (bellotas) cada bellota en la canasta suma estrella y suena', async ({ page }) => {
  await entrar(page);
  const before = Number((await page.locator('#starCount').textContent()) || '0');
  await page.locator('.subject[data-game="math"]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-pa34-game="math:count"]').click();
  await page.waitForTimeout(400);
  await page.locator('.pa34-lvl.cur').click();
  await page.waitForTimeout(500);
  expect(await page.locator('.pa34-play.show').count()).toBe(1);

  const need = await page.evaluate(() => document.querySelectorAll('#pa34prog .pa34-leaf').length);
  expect(need).toBeGreaterThan(0);
  for (let i = 0; i < need; i++) {
    const acorn = page.locator('.pa34-acorn:not(.placed)').first();
    const box = await acorn.boundingBox();
    const basket = await page.locator('#pa34basket').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(basket.x + basket.width / 2, basket.y + basket.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const now = Number((await page.locator('#starCount').textContent()) || '0');
    expect(now).toBe(before + i + 1);
  }
  await page.waitForTimeout(500);
  const after = Number((await page.locator('#starCount').textContent()) || '0');
  expect(after).toBe(before + need);
});

test('Fase 4 · #5: #11 retirado — jugar en las capas no revive las 3 tarjetas duplicadas', async ({ page }) => {
  await entrar(page);
  // Jugar una capa entera (dispara refreshHome/eduFaceOf de #11, que siguen
  // envolviendo por orden de carga aunque ya no tengan contenido propio).
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa53-ov .pa34-x, .pa34-x').first().click().catch(() => {});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const dup = await page.evaluate(() => ({
    emo: document.getElementById('subj_emotions'),
    shapes: document.getElementById('subj_shapes'),
    rout: document.getElementById('subj_routines'),
    cards: document.querySelectorAll('#home .subject').length,
  }));
  expect(dup.emo).toBeNull();
  expect(dup.shapes).toBeNull();
  expect(dup.rout).toBeNull();
  // Las 8 materias que sí siguen vivas (3 base + 5 capas de contenido: shapes,
  // brain, music, emotions, habits) más rutinas viviendo dentro de #60.
  expect(dup.cards).toBeGreaterThanOrEqual(6);
});
