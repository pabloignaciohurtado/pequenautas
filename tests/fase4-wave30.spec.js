const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// La auditoría de coherencia encontró que #53/#54/#55/#58/#60 (formas,
// ingenio, música, emociones, hábitos) no tenían sistema de pistas: fallar
// solo hacía temblar la ficha, sin la escalada de dos pasos (pista suave en
// la 1a falla, brillo + narración de la respuesta en la 2a) que ya usa
// onWrong() en app.js para números/letras/animales. Como S/onWrong de
// app.js no son alcanzables desde estos módulos aditivos, cada uno
// reimplementó el mismo contrato en local (bad(node,hintFn) + resetHint()).
// Estos tests prueban ese contrato en un juego representativo de cada
// materia, más el interruptor "Pistas guiadas" que debe apagar la escalada
// sin apagar el temblor de la falla.

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Pin');
  await page.click('#createBtn');
  await page.waitForTimeout(3000); // #34/#52/#53-#60 son diferidos
}

// Instala el espía de voz ANTES de abrir el juego: la pista de la 1a falla
// se dice apenas se falla, así que si el spy llegara tarde se perdería.
async function espiarVoz(page) {
  await page.evaluate(() => {
    window.__oidas = [];
    window.speak = function (t) { if (t) window.__oidas.push(t); };
  });
}

test('Fase 4 · #53: fallar dos veces en formas y sombras hace brillar la sombra correcta', async ({ page }) => {
  await entrar(page);
  await espiarVoz(page);
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa53-ov .pa34-game').nth(1).click(); // shape:match
  await page.waitForTimeout(350);
  await page.locator('.pa53-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(500);

  // Selecciona la primera figura de la izquierda: eso fija cuál sombra es
  // la correcta (data-k), leído del DOM y no adivinado por texto.
  await page.locator('.pa53-col').first().locator('.pa53-tile').first().click();
  await page.waitForTimeout(200);
  const targetK = await page.evaluate(() => document.querySelector('.pa53-col .pa53-sel').dataset.k);
  const wrongShadow = page.locator(`.pa53-tile.pa53-sh:not([data-k="${targetK}"])`).first();

  await wrongShadow.click(); // 1a falla
  await page.waitForTimeout(150);
  const dichoTrasUna = await page.evaluate(() => window.__oidas.slice());
  expect(dichoTrasUna.length).toBeGreaterThan(0); // pista suave: repite el nombre

  await wrongShadow.click(); // 2a falla -> brillo + revelado
  await page.waitForTimeout(200);
  const brillante = await page.locator(`.pa53-tile.pa53-sh[data-k="${targetK}"].pa53-reveal`);
  await expect(brillante).toHaveCount(1);
  const dichoTrasDos = await page.evaluate(() => window.__oidas.slice());
  const ultima = dichoTrasDos[dichoTrasDos.length - 1];
  expect(ultima).toMatch(/brilla/i);

  // Acertar limpia el brillo (good() lo quita, no se queda pulsando para
  // siempre en una figura ya resuelta). force:true porque hintPulse anima
  // transform:scale() sin parar, y el chequeo de estabilidad de Playwright
  // nunca lo ve "quieto" — un dedo real no tiene ese problema.
  await page.locator(`.pa53-tile.pa53-sh[data-k="${targetK}"]`).click({ force: true });
  await page.waitForTimeout(200);
  await expect(page.locator(`.pa53-tile.pa53-sh[data-k="${targetK}"].pa53-reveal`)).toHaveCount(0);
});

test('Fase 4 · #54: fallar dos veces en silueta hace brillar la sombra correcta', async ({ page }) => {
  await entrar(page);
  await espiarVoz(page);
  await page.locator('.subject[data-game="brain"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa54-ov .pa34-game').nth(1).click(); // brain:shadow
  await page.waitForTimeout(350);
  await page.locator('.pa54-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(500);

  await page.locator('.pa54-row').first().locator('.pa54-tile').first().click();
  await page.waitForTimeout(200);
  const targetK = await page.evaluate(() => document.querySelector('.pa54-row .pa54-sel').dataset.k);
  const wrongShadow = page.locator(`.pa54-tile.pa54-sh:not([data-k="${targetK}"])`).first();

  await wrongShadow.click();
  await wrongShadow.click();
  await page.waitForTimeout(200);
  await expect(page.locator(`.pa54-tile.pa54-sh[data-k="${targetK}"].pa54-reveal`)).toHaveCount(1);
  const dicho = await page.evaluate(() => window.__oidas.slice());
  expect(dicho[dicho.length - 1]).toMatch(/glowing one|brilla/i);
});

test('Fase 4 · #55: fallar dos veces en "¿Qué suena?" hace brillar el instrumento correcto', async ({ page }) => {
  // Mapa espejo del que vive en fase4/55-musica/spec.js: lo trae el propio
  // test porque el módulo no expone su tabla INSTR, y la onomatopeya
  // hablada en el enunciado es la única pista de cuál tocó.
  const ONO = {
    drum: 'PUM PUM', flute: 'TU-TUUU', bell: 'TILÍN TILÍN',
    maraca: 'CHIS CHIS', xylo: 'TIN TIN TIN',
  };
  await entrar(page);
  await espiarVoz(page);
  await page.locator('.subject[data-game="music"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa55-ov .pa34-game').nth(0).click(); // music:instr
  await page.waitForTimeout(350);
  await page.locator('.pa55-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(500);

  const ono = await page.evaluate(() => document.getElementById('pa55prompt').dataset.ono);
  const targetId = Object.keys(ONO).filter((k) => ONO[k] === ono)[0];
  expect(targetId).toBeTruthy();
  const wrongTile = page.locator(`.pa55-tile:not([data-instr="${targetId}"])`).first();

  await wrongTile.click();
  await wrongTile.click();
  await page.waitForTimeout(200);
  await expect(page.locator(`.pa55-tile[data-instr="${targetId}"].pa55-reveal`)).toHaveCount(1);
  const dicho = await page.evaluate(() => window.__oidas.slice());
  expect(dicho[dicho.length - 1]).toMatch(/glowing one|brilla/i);
});

test('Fase 4 · #58: fallar dos veces en "¿Cómo se siente?" hace brillar la emoción correcta y la frase calca a #11', async ({ page }) => {
  await entrar(page);
  await espiarVoz(page);
  await page.locator('.subject[data-game="emotions"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa58-ov .pa34-game').nth(0).click(); // emo:face
  await page.waitForTimeout(350);
  await page.locator('.pa58-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(500);

  const targetId = await page.evaluate(() => document.querySelector('.pa58-stage[data-face]').dataset.face);
  const wrongTile = page.locator(`.pa58-tile:not([data-emo="${targetId}"])`).first();

  await wrongTile.click();
  await wrongTile.click();
  await page.waitForTimeout(200);
  await expect(page.locator(`.pa58-tile[data-emo="${targetId}"].pa58-reveal`)).toHaveCount(1);
  const dicho = await page.evaluate(() => window.__oidas.slice());
  const ultima = dicho[dicho.length - 1];
  // Mismo molde que #11: "Se siente <emoción>. Toca el que brilla."
  expect(ultima).toMatch(/^Se siente .+\. Toca el que brilla\.$/);
});

test('Fase 4 · #60: fallar dos veces en "¿Dónde va?" hace brillar la canasta correcta', async ({ page }) => {
  await entrar(page);
  await espiarVoz(page);
  await page.locator('.subject[data-game="habits"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa60-ov .pa34-game').nth(2).click(); // hab:place
  await page.waitForTimeout(350);
  await page.locator('.pa60-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(500);

  const targetBin = await page.evaluate(() => document.querySelector('.pa60-hold .pa60-item').dataset.answer);
  const wrongBin = page.locator(`.pa60-bin:not([data-bin="${targetBin}"])`).first();

  await wrongBin.click();
  await wrongBin.click();
  await page.waitForTimeout(200);
  await expect(page.locator(`.pa60-bin[data-bin="${targetBin}"].pa60-reveal`)).toHaveCount(1);
  const dicho = await page.evaluate(() => window.__oidas.slice());
  expect(dicho[dicho.length - 1]).toMatch(/brilla/i);
});

test('Fase 4 · pistas: "Pistas guiadas" apagado quita el brillo y la narración, no el temblor', async ({ page }) => {
  await entrar(page);
  await page.evaluate(() => document.getElementById('tgGuide').classList.remove('on'));
  await espiarVoz(page);
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa53-ov .pa34-game').nth(1).click(); // shape:match
  await page.waitForTimeout(350);
  await page.locator('.pa53-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(500);

  await page.locator('.pa53-col').first().locator('.pa53-tile').first().click();
  await page.waitForTimeout(200);
  const targetK = await page.evaluate(() => document.querySelector('.pa53-col .pa53-sel').dataset.k);
  const wrongShadow = page.locator(`.pa53-tile.pa53-sh:not([data-k="${targetK}"])`).first();

  // window.speak ya se llamó una vez al seleccionar la figura (dice su
  // nombre); lo que nos importa es que las DOS fallas no agreguen nada más.
  await page.evaluate(() => { window.__oidas = []; });
  await wrongShadow.click();
  await page.waitForTimeout(150);
  await expect(wrongShadow).toHaveClass(/pa53-no/); // el temblor sigue vivo
  await wrongShadow.click();
  await page.waitForTimeout(200);
  await expect(page.locator(`.pa53-tile.pa53-sh[data-k="${targetK}"].pa53-reveal`)).toHaveCount(0);
  const dicho = await page.evaluate(() => window.__oidas.slice());
  expect(dicho.length).toBe(0);
});

test('Fase 4 · pistas: los cinco módulos siguen siendo aditivos, sin errores de consola', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await entrar(page);
  const flags = await page.evaluate(() => ({
    pa53: window.__pa53 === true,
    pa54: window.__pa54 === true,
    pa55: window.__pa55 === true,
    pa58: window.__pa58 === true,
    pa60: window.__pa60 === true,
    core: typeof window.startGame === 'function' && typeof window.addStar === 'function',
  }));
  expect(flags).toEqual({ pa53: true, pa54: true, pa55: true, pa58: true, pa60: true, core: true });
  expect(errors).toEqual([]);
});
