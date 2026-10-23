const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

async function mk(page, name){
  await page.click('.pcard.add'); await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', name); await page.click('#createBtn');
  await page.waitForTimeout(300);
}

// La rejilla de #34 engancha las tarjetas con un sondeo (ver bilingual.spec):
// esperar la marca data-pa34 evita perder la carrera por adelantarse.
async function abrirMemoria(page, subject, gid){
  const tarjeta = page.locator('.subject[data-game="' + subject + '"][data-pa34="1"]');
  await tarjeta.waitFor({ state: 'attached' });
  await tarjeta.click();
  await page.click('[data-pa34-game="' + gid + '"]');
  await page.waitForTimeout(200);
  await page.click('.pa34-lvl.cur');
  await page.waitForTimeout(400);
}

// Arrastra una carta hacia arriba (>34px) para voltearla.
async function revelar(page, idx){
  const card = page.locator('.pa34-memcard[data-idx="' + idx + '"]');
  const box = await card.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 60, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

// Arrastra la carta A sobre la carta B para confirmar la pareja.
async function unir(page, idxA, idxB){
  const a = page.locator('.pa34-memcard[data-idx="' + idxA + '"]');
  const b = page.locator('.pa34-memcard[data-idx="' + idxB + '"]');
  const ba = await a.boundingBox(); const bb = await b.boundingBox();
  await page.mouse.move(ba.x + ba.width / 2, ba.y + ba.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

test('Fase 4 · #34 Memoria: la carta aparece en las tres materias con mapa de niveles', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  await page.waitForTimeout(1500);
  await mk(page, 'Mem1');
  const casos = [['math','math:memory'], ['reading','read:memory'], ['science','sci:memory']];
  for (const [subject, gid] of casos) {
    const tarjeta = page.locator('.subject[data-game="' + subject + '"][data-pa34="1"]');
    await tarjeta.waitFor({ state: 'attached' });
    await tarjeta.click();
    await page.waitForTimeout(200);
    const memBtn = page.locator('[data-pa34-game="' + gid + '"]');
    await expect(memBtn).toBeVisible();
    await expect(memBtn.locator('.gp')).toHaveText('Nivel 1 de 5');
    // abre el mismo mapa de niveles que el resto de la rejilla (auditoría #12)
    await memBtn.click();
    await page.waitForTimeout(200);
    await expect(page.locator('.pa34-lvl.cur')).toHaveCount(1);
    await page.locator('.pa34-ov .pa34-x').click();
    await page.waitForTimeout(150);
  }
  expect(errors).toEqual([]);
});

test('Fase 4 · #34 Memoria: nivel 1 completo — revelar, unir, estrella por pareja (#8) y victoria', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1500);
  await mk(page, 'Mem2');
  await abrirMemoria(page, 'math', 'math:memory');
  await expect(page.locator('.pa34-mmplay')).toBeVisible();
  await expect(page.locator('.pa34-memcard')).toHaveCount(6); // nivel 1 = 3 pares
  const pids = await page.$$eval('.pa34-memcard', (els) => els.map((e) => e.getAttribute('data-pid')));
  const porPar = {};
  pids.forEach((p, i) => { (porPar[p] = porPar[p] || []).push(i); });
  let estrellas = 0;
  for (const p of Object.keys(porPar)) {
    const [a, b] = porPar[p];
    await revelar(page, a);
    await revelar(page, b);
    await expect(page.locator('.pa34-memcard[data-idx="' + a + '"]')).toHaveClass(/matchable/);
    await unir(page, a, b);
    await expect(page.locator('.pa34-memcard[data-idx="' + a + '"]')).toHaveClass(/matched/);
    estrellas++;
    // economía #8: cada pareja confirmada suma una estrella, sin esperar al final
    await expect(page.locator('#starCount')).toHaveText(String(estrellas));
  }
  await page.waitForTimeout(500);
  await expect(page.locator('#pa34mmwin')).toBeVisible();
  await expect(page.locator('#pa34mmwp')).toContainText('Encontraste 3 parejas');
  // ganar desbloquea el nivel 2 pero NO regala estrella extra (#8)
  await expect(page.locator('#starCount')).toHaveText('3');
  await page.click('#pa34mmwmap');
  await page.waitForTimeout(300);
  await expect(page.locator('.pa34-lvl.done')).toHaveCount(1);
});

test('Fase 4 · #34 Memoria: dos cartas distintas se voltean de vuelta y no dan estrella', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(1500);
  await mk(page, 'Mem3');
  await abrirMemoria(page, 'science', 'sci:memory');
  await expect(page.locator('.pa34-memcard')).toHaveCount(6);
  const pids = await page.$$eval('.pa34-memcard', (els) => els.map((e) => e.getAttribute('data-pid')));
  const a = 0;
  let b = -1;
  for (let i = 1; i < pids.length; i++) { if (pids[i] !== pids[a]) { b = i; break; } }
  await revelar(page, a);
  await revelar(page, b);
  await expect(page.locator('.pa34-memcard[data-idx="' + a + '"]')).toHaveClass(/mismatch/);
  await page.waitForTimeout(1100); // el flip de vuelta llega a los 900ms
  await expect(page.locator('.pa34-memcard[data-idx="' + a + '"]')).not.toHaveClass(/face-up/);
  await expect(page.locator('.pa34-memcard[data-idx="' + b + '"]')).not.toHaveClass(/face-up/);
  await expect(page.locator('#starCount')).toHaveText('0');
});
