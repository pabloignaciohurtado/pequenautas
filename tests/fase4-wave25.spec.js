const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #59 no añade contenido: conecta dos módulos que llevaban olas sin hablarse.
// Lo que puede romperse aquí no es un juego, es el puente:
//   · que el botón aparezca dentro de la tarjeta de #05 sin editar #05;
//   · que sea la PRIMERA opción, porque es la única que ofrece algo en vez
//     de cortar el juego o ignorar la señal;
//   · que al pulsarlo se cierre la tarjeta y se abra la respiración de #58,
//     que es literalmente la razón de existir del módulo;
//   · que la razón ofrecidas/usadas se cuente y se resuma, porque es el
//     único dato que dice si la alerta de #05 llega en buen momento;
//   · y que el panel de Progreso no se ensucie cuando no ha pasado nada.

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Nil');
  await page.click('#createBtn');
  await page.waitForTimeout(3400); // los diferidos; #59 es el último de la cadena
}

// La tarjeta de #05 sólo se muestra si el adulto puede verla AHORA, es decir
// estando en 'game'. Entramos a una materia antes de forzar el aviso.
async function entrarYJugar(page) {
  await entrar(page);
  await page.click('.subject[data-game="math"]');
  await page.waitForTimeout(300);
  await page.click('[data-pa34-app="math"]');
  await page.waitForTimeout(200);
  await page.click('.pa34-lvl.cur');
  await page.waitForTimeout(600);
}

async function avisar(page) {
  await page.evaluate(() => window.__frustration.forceTrigger('frustMsgStreak'));
  await page.waitForTimeout(1200); // el poll de #59 busca la tarjeta cada 700ms
}

test('Fase 4 · #59: el aviso de #05 gana una tercera salida, y va primera', async ({ page }) => {
  await entrarYJugar(page);
  await expect(page.locator('#frustCard.show')).toHaveCount(0); // nadie se ha frustrado todavía
  await expect(page.locator('#pa59Btn')).toHaveCount(0);
  await avisar(page);

  await expect(page.locator('#frustCard.show')).toHaveCount(1);
  await expect(page.locator('#pa59Btn')).toHaveCount(1);
  const fila = await page.$$eval('#frustCard .frustBtns button', (bs) => bs.map((b) => b.id));
  expect(fila[0]).toBe('pa59Btn');
  expect(fila).toContain('frustPauseBtn');
  expect(fila).toContain('frustDismissBtn');
  // y dice algo, en el idioma de la app
  const txt = await page.textContent('#pa59Btn');
  expect(txt.trim().length).toBeGreaterThan(3);
});

test('Fase 4 · #59: pulsar respirar cierra el aviso y abre la calma de #58', async ({ page }) => {
  await entrarYJugar(page);
  await avisar(page);
  await page.click('#pa59Btn');
  await page.waitForTimeout(700);

  await expect(page.locator('#frustCard.show')).toHaveCount(0);
  await expect(page.locator('.pa58-play.show')).toHaveCount(1);
  await expect(page.locator('.pa58-breathe')).toHaveCount(1);
  // sigue siendo una herramienta, no un reto: nada que acertar ni que fallar
  await expect(page.locator('.pa58-tile')).toHaveCount(0);
  await expect(page.locator('.pa58-skip')).toHaveCount(1);
});

test('Fase 4 · #59: cuenta ofrecidas y usadas', async ({ page }) => {
  await entrarYJugar(page);
  await avisar(page);
  const tras = await page.evaluate(() => window.pa59.stats());
  expect(tras.offered).toBe(1);
  expect(tras.taken).toBe(0);

  await page.click('#pa59Btn');
  await page.waitForTimeout(600);
  const usado = await page.evaluate(() => window.pa59.stats());
  expect(usado.offered).toBe(1);
  expect(usado.taken).toBe(1);

  // y sobrevive al guardado, que es lo que permite mirar la razón con el tiempo
  const guardado = await page.evaluate(() => {
    const p = currentProfile();
    return { o: p.calmOffered, u: p.calmTaken };
  });
  expect(guardado).toEqual({ o: 1, u: 1 });
});

test('Fase 4 · #59: el resumen aparece en Progreso sólo cuando hubo algo que contar', async ({ page }) => {
  await entrarYJugar(page);

  // Antes de cualquier aviso el panel no se toca.
  await page.evaluate(() => { $('sheet').classList.add('show'); showSheetView('adultView'); showTab('prog'); });
  await page.waitForTimeout(500);
  await expect(page.locator('#pa59Insight')).toHaveCount(0);
  await page.evaluate(() => { $('sheet').classList.remove('show'); });
  await page.waitForTimeout(300);

  await avisar(page);
  await page.click('#pa59Btn');
  await page.waitForTimeout(600);
  await page.locator('.pa58-skip').click();
  await page.waitForTimeout(400);

  await page.evaluate(() => { $('sheet').classList.add('show'); showSheetView('adultView'); showTab('prog'); });
  await page.waitForTimeout(600);
  await expect(page.locator('#pa59Insight')).toHaveCount(1);
  const t = await page.textContent('#pa59Insight');
  expect(t.length).toBeGreaterThan(8);
});

test('Fase 4 · #59: registrado, aditivo y enganchado sólo a las APIs públicas', async () => {
  const loader = fs.readFileSync(path.resolve(__dirname, '../fase4/fase4.js'), 'utf8');
  const sw = fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8');
  expect(loader).toContain('59-puente-calma');
  expect(sw).toContain('59-puente-calma');

  const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const js = sinComentarios(fs.readFileSync(path.resolve(__dirname, '../fase4/59-puente-calma/spec.js'), 'utf8'));
  const css = sinComentarios(fs.readFileSync(path.resolve(__dirname, '../fase4/59-puente-calma/spec.css'), 'utf8'));
  expect(js).not.toContain('STORE_KEY');
  expect(css).not.toContain('STORE_KEY');
  // el puente se apoya en lo que #05 y #58 ya exponían; si algún día alguien
  // lo "arregla" editando esos módulos, este test lo cantará.
  expect(js).toContain('__frustration');
  expect(js).toContain('pa58Breathe');

  // y #05 y #58 siguen sin saber nada el uno del otro
  const cinco = fs.readFileSync(path.resolve(__dirname, '../fase4/05-deteccion-frustracion/spec.js'), 'utf8');
  expect(cinco).not.toContain('pa58Breathe');
});
