const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #58 añade la SÉPTIMA materia: Emociones y Convivencia. Lo que puede
// romperse aquí no es el contenido —eso se lee— sino la convivencia con lo
// que ya había:
//   · que la tarjeta se inyecte sin robarle el clic a las tres originales
//     (app.js engancha .subject una sola vez, al cargar);
//   · que el overlay sea PROPIO (.pa58-ov): #40 hace querySelector(".pa34-ov")
//     y con dos overlays le pondría el fondo al equivocado;
//   · que la séptima tarjeta ocupe la fila entera, que es la decisión que
//     evita la huérfana del 3+3+1;
//   · que la cara sea la MISMA cara con distinta expresión, que es todo el
//     diseño pedagógico del juego 1;
//   · que "Respira con Rufo" sea alcanzable desde fuera, porque #05 detecta
//     frustración y hasta ahora no tenía nada que ofrecer.

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  await page.waitForTimeout(3200); // los módulos diferidos, #58 el último
}

test('Fase 4 · #58: la séptima tarjeta aparece y no toca a las tres originales', async ({ page }) => {
  await entrar(page);
  await expect(page.locator('#pa58Card')).toHaveCount(1);
  // las tres materias de app.js siguen intactas
  await expect(page.locator('.subject:not(.pa53-card):not(.pa54-card):not(.pa55-card):not(.pa58-card):not(.pa60-card)')).toHaveCount(3);
  // ocho casas en total desde #60
  await expect(page.locator('#home .cards .subject')).toHaveCount(8);
  // y va después de las tres originales, para que su clic propio no se cuele
  // en el binding que app.js hace una sola vez al cargar. Desde #60 ya no es
  // la última: el zócalo son dos bandas y #58 es la de arriba.
  const orden = await page.evaluate(() => {
    const c = document.querySelectorAll('#home .cards .subject');
    return Array.prototype.map.call(c, (n) => n.id);
  });
  expect(orden.indexOf('pa58Card')).toBe(orden.length - 2);
  expect(orden[orden.length - 1]).toBe('pa60Card');
});

test('Fase 4 · #58: ocupa la fila entera (nada de huérfana en 3+3+1)', async ({ page }) => {
  await entrar(page);
  const w = await page.evaluate(() => {
    const card = document.getElementById('pa58Card');
    const first = document.querySelector('#home .cards .subject');
    return {
      span: getComputedStyle(card).gridColumnStart + '/' + getComputedStyle(card).gridColumnEnd,
      cardW: Math.round(card.getBoundingClientRect().width),
      otherW: Math.round(first.getBoundingClientRect().width),
      cols: getComputedStyle(document.querySelector('#home .cards')).gridTemplateColumns.split(' ').length
    };
  });
  // con 3 columnas la banda tiene que ser claramente más ancha que una casa
  if (w.cols >= 2) expect(w.cardW).toBeGreaterThan(w.otherW * 1.5);
});

test('Fase 4 · #58: overlay propio, no el de #34', async ({ page }) => {
  await entrar(page);
  await page.click('#pa58Card');
  await page.waitForTimeout(400);
  await expect(page.locator('.pa58-ov.show')).toHaveCount(1);
  // el overlay de #34 no se abre a la vez: #40 se guía por él
  await expect(page.locator('.pa34-ov.show')).toHaveCount(0);
  // cuatro juegos, y estampan data-pa34-game para heredar el papercraft de #52
  await expect(page.locator('.pa58-ov .pa34-game')).toHaveCount(4);
  const ids = await page.$$eval('.pa58-ov .pa34-game', ns => ns.map(n => n.getAttribute('data-pa34-game')));
  expect(ids).toEqual(['emo:face', 'emo:what', 'emo:help', 'emo:breathe']);
});

test('Fase 4 · #58: la cara es la misma cara con distinta expresión', async ({ page }) => {
  await entrar(page);
  // Lo que tiene que cambiar entre emociones son cejas, ojos y boca; lo que
  // NO puede cambiar es el animal. Si cambiara, el niño aprendería "el erizo
  // está triste" en vez de "las cejas caídas son tristeza".
  await page.click('#pa58Card');
  await page.waitForTimeout(350);
  await page.locator('.pa58-ov .pa34-game').first().click();
  await page.waitForTimeout(300);
  await page.locator('.pa34-lvl.cur').first().click();
  await page.waitForTimeout(600);

  await expect(page.locator('.pa58-play.show')).toHaveCount(1);
  const face = await page.evaluate(() => {
    const s = document.querySelector('.pa58-stage');
    const svg = s && s.querySelector('svg.pa58-fsvg');
    return {
      emo: s && s.getAttribute('data-face'),
      head: !!(svg && svg.querySelector('.head')),
      ears: svg ? svg.querySelectorAll('.ear').length : 0,
      brow: !!(svg && svg.querySelector('.brow')),
      mouth: !!(svg && svg.querySelector('.mouth')),
      viewBox: svg && svg.getAttribute('viewBox')
    };
  });
  expect(['happy', 'sad', 'angry', 'scared', 'surp', 'calm']).toContain(face.emo);
  expect(face.head).toBe(true);
  expect(face.ears).toBe(2);          // el mismo zorro siempre
  expect(face.brow).toBe(true);       // las cejas son la mitad de la emoción
  expect(face.mouth).toBe(true);
  expect(face.viewBox).toBe('0 0 100 100');

  // y hay fichas de emoción para responder, con su color propio
  const tiles = await page.$$eval('.pa58-tile', ns => ns.map(n => n.getAttribute('data-emo')));
  expect(tiles.length).toBeGreaterThanOrEqual(2);
  expect(new Set(tiles).size).toBe(tiles.length); // sin repetidas
});

test('Fase 4 · #58: acertar suma estrella y avanza el progreso', async ({ page }) => {
  await entrar(page);
  await page.click('#pa58Card');
  await page.waitForTimeout(350);
  await page.locator('.pa58-ov .pa34-game').first().click();
  await page.waitForTimeout(300);
  await page.locator('.pa34-lvl.cur').first().click();
  await page.waitForTimeout(600);

  const target = await page.evaluate(() => document.querySelector('.pa58-stage').getAttribute('data-face'));
  await page.locator('.pa58-tile[data-emo="' + target + '"]').click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.getElementById('pa58score').textContent)).toBe('1');
  await expect(page.locator('.pa58-prog i.on')).toHaveCount(1);
});

test('Fase 4 · #58: "Respira con Rufo" es una herramienta, no un reto', async ({ page }) => {
  await entrar(page);
  // alcanzable desde fuera: es lo que #05 necesita para ofrecer calma
  expect(await page.evaluate(() => typeof window.pa58Breathe)).toBe('function');
  await page.evaluate(() => window.pa58Breathe(2));
  await page.waitForTimeout(500);
  await expect(page.locator('.pa58-play.show')).toHaveCount(1);
  await expect(page.locator('.pa58-breathe')).toHaveCount(1);
  // no hay nada que fallar: ni fichas ni botón de repetir
  await expect(page.locator('.pa58-tile')).toHaveCount(0);
  expect(await page.evaluate(() => document.getElementById('pa58replay').style.display)).toBe('none');
  // y siempre hay una salida digna
  await expect(page.locator('.pa58-skip')).toHaveCount(1);
  // el ciclo late: entra, sostiene, suelta
  const cls = await page.evaluate(() => document.querySelector('.pa58-breathe').className);
  expect(cls).toMatch(/pa58-breathe (in|hold|out)/);
  await page.locator('.pa58-skip').click();
  await page.waitForTimeout(300);
  await expect(page.locator('.pa58-play.show')).toHaveCount(0);
});

test('Fase 4 · #58: registrado en el cargador y en el service worker', async () => {
  const loader = fs.readFileSync(path.resolve(__dirname, '../fase4/fase4.js'), 'utf8');
  const sw = fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8');
  expect(loader).toContain('58-emociones');
  expect(sw).toContain('58-emociones');
  // y #56 sabe arrastrar sus fichas (si no, la capa de gesto se saltaría
  // justo la materia más nueva)
  const drag = fs.readFileSync(path.resolve(__dirname, '../fase4/56-arrastrar/spec.js'), 'utf8');
  expect(drag).toContain('.pa58-tile');
  expect(drag).toContain('#pa58prompt');
  // No se toca el núcleo. Se comparan los ficheros SIN comentarios, porque
  // la cabecera de ambos dice justamente "no toca STORE_KEY" y si no la
  // quitáramos el test se estaría leyendo a sí mismo.
  const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const css = sinComentarios(fs.readFileSync(path.resolve(__dirname, '../fase4/58-emociones/spec.css'), 'utf8'));
  const js = sinComentarios(fs.readFileSync(path.resolve(__dirname, '../fase4/58-emociones/spec.js'), 'utf8'));
  expect(css).not.toContain('STORE_KEY');
  expect(js).not.toContain('STORE_KEY');
  expect(js).toContain('pequenautas.f4.emociones.v1');
});
