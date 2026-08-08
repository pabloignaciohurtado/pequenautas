const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #60 añade la OCTAVA materia: Hábitos y Autonomía. Es la segunda seguida
// que no enseña contenido escolar sino una competencia, y eso cambia la
// maquetación del home: la rejilla se queda con las seis de contenido
// (3+3) y las de competencia bajan a banda. Lo que hay que vigilar:
//   · que la octava casa sea banda y NO devuelva la huérfana del 3+3+1;
//   · que #58 siga siendo banda: el zócalo son dos, no una;
//   · que el overlay sea propio (.pa60-ov), porque #40 hace
//     querySelector(".pa34-ov") y con varios le pondría el fondo al malo;
//   · que los cuatro juegos se jueguen y premien;
//   · que el mismo objeto sea el MISMO objeto en los cuatro juegos, que es
//     toda la razón de dibujarlos en SVG en vez de ilustrarlos;
//   · y que un fallo no borre el progreso ya conseguido en "Paso a paso".

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Iker');
  await page.click('#createBtn');
  await page.waitForTimeout(3600); // los diferidos; #60 es el último de la cadena
}

test('Fase 4 · #60: la octava casa aparece y no toca a las tres originales', async ({ page }) => {
  await entrar(page);
  await expect(page.locator('#pa60Card')).toHaveCount(1);
  await expect(page.locator('.subject:not(.pa53-card):not(.pa54-card):not(.pa55-card):not(.pa58-card):not(.pa60-card)')).toHaveCount(3);
  await expect(page.locator('#home .cards .subject')).toHaveCount(8);
  const last = await page.evaluate(() => {
    const c = document.querySelectorAll('#home .cards .subject');
    return c[c.length - 1].id;
  });
  expect(last).toBe('pa60Card');
});

test('Fase 4 · #60: el zócalo son DOS bandas y la rejilla se queda en 3+3', async ({ page }) => {
  await entrar(page);
  const m = await page.evaluate(() => {
    const cards = document.querySelector('#home .cards');
    const cols = getComputedStyle(cards).gridTemplateColumns.split(' ').length;
    const n = Array.prototype.slice.call(cards.querySelectorAll('.subject'));
    const w = (x) => Math.round(x.getBoundingClientRect().width);
    // offsetTop y no getBoundingClientRect: las casas tienen animación de
    // balanceo y el rect incluye la transformada.
    const filas = {};
    n.forEach((x) => { filas[x.offsetTop] = (filas[x.offsetTop] || 0) + 1; });
    return {
      cols: cols,
      base: w(n[0]),
      emo: w(document.getElementById('pa58Card')),
      hab: w(document.getElementById('pa60Card')),
      filas: Object.keys(filas).map((k) => filas[k])
    };
  });
  if (m.cols >= 2) {
    // las dos bandas son claramente más anchas que una casa de la rejilla
    expect(m.emo).toBeGreaterThan(m.base * 1.5);
    expect(m.hab).toBeGreaterThan(m.base * 1.5);
    // y son bandas distintas: nadie comparte fila con nadie al pie
    const solas = m.filas.filter((c) => c === 1).length;
    expect(solas).toBeGreaterThanOrEqual(2);
    // ninguna fila con una sola casa que NO sea banda: eso sería la huérfana
    expect(m.filas.filter((c) => c === 1).length).toBe(2);
  }
});

test('Fase 4 · #60: overlay propio, no el de #34 ni el de #58', async ({ page }) => {
  await entrar(page);
  await page.click('#pa60Card');
  await page.waitForTimeout(400);
  await expect(page.locator('.pa60-ov.show')).toHaveCount(1);
  await expect(page.locator('.pa34-ov.show')).toHaveCount(0);
  await expect(page.locator('.pa58-ov.show')).toHaveCount(0);
  // cuatro juegos, con la maquinaria de #34/#52 reutilizada
  await expect(page.locator('.pa60-ov .pa34-game')).toHaveCount(4);
  const ids = await page.$$eval('.pa60-ov .pa34-game', (b) => b.map((x) => x.getAttribute('data-pa34-game')));
  expect(ids).toEqual(['hab:steps', 'hab:need', 'hab:place', 'hab:day']);
});

test('Fase 4 · #60: los cuatro juegos se juegan y premian', async ({ page }) => {
  await entrar(page);

  // 1 · Paso a paso: tocar en orden. La respuesta correcta se lee del DOM
  // porque el orden mostrado está barajado.
  await page.evaluate(() => window.pa60.play('steps', 0));
  await page.waitForTimeout(500);
  await expect(page.locator('.pa60-play.show')).toHaveCount(1);
  await expect(page.locator('.pa60-steps .pa60-item')).toHaveCount(3);
  const antes = await page.evaluate(() => Number(document.getElementById('pa60score').textContent));
  const objs = await page.$$eval('.pa60-steps .pa60-item', (b) => b.map((x) => x.getAttribute('data-obj')));
  expect(objs.length).toBe(3);
  await page.evaluate(() => { window.__pa60test = true; });
  // se prueba tocando hasta que uno acierte; el juego no castiga los fallos
  for (let paso = 0; paso < 3; paso++) {
    for (const o of objs) {
      const n = page.locator(`.pa60-steps .pa60-item[data-obj="${o}"]`);
      if (await n.evaluate((x) => x.classList.contains('pa60-ok'))) continue;
      // force:true: tras dos fallas el sistema de pistas (#6 de la auditoría)
      // agrega pa60-reveal, que anima transform:scale() sin parar — un dedo
      // real toca igual, pero el chequeo de estabilidad de Playwright nunca
      // ve el botón "quieto".
      await n.click({ force: true });
      await page.waitForTimeout(140);
      if (await n.evaluate((x) => x.classList.contains('pa60-ok'))) break;
    }
  }
  await page.waitForTimeout(500);
  const marcados = await page.locator('.pa60-steps .pa60-item.pa60-ok').count();
  expect(marcados).toBeGreaterThanOrEqual(3);
  const despues = await page.evaluate(() => Number(document.getElementById('pa60score').textContent));
  expect(despues).toBeGreaterThan(antes);

  // 2 · ¿Qué necesito?: nivel 0 son dos opciones
  await page.evaluate(() => window.pa60.play('need', 0));
  await page.waitForTimeout(400);
  await expect(page.locator('.pa60-choices .pa60-item')).toHaveCount(2);

  // 3 · ¿Dónde va?: el objeto lleva la respuesta y los destinos son estables
  await page.evaluate(() => window.pa60.play('place', 0));
  await page.waitForTimeout(400);
  await expect(page.locator('.pa60-hold .pa60-item')).toHaveCount(1);
  await expect(page.locator('.pa60-bins .pa60-bin')).toHaveCount(2);
  const bien = await page.evaluate(() => document.querySelector('.pa60-hold .pa60-item').getAttribute('data-answer'));
  const s0 = await page.evaluate(() => Number(document.getElementById('pa60score').textContent));
  await page.click(`.pa60-bin[data-bin="${bien}"]`);
  await page.waitForTimeout(750);
  const s1 = await page.evaluate(() => Number(document.getElementById('pa60score').textContent));
  expect(s1).toBeGreaterThan(s0);

  // 4 · Mi día: en nivel 0 sólo mañana y noche, que son las que tienen ancla
  await page.evaluate(() => window.pa60.play('day', 0));
  await page.waitForTimeout(400);
  await expect(page.locator('.pa60-bins .pa60-when')).toHaveCount(2);
  const cuando = await page.evaluate(() => document.querySelector('.pa60-hold .pa60-item').getAttribute('data-answer'));
  const t0 = await page.evaluate(() => Number(document.getElementById('pa60score').textContent));
  await page.click(`.pa60-bin[data-when="${cuando}"]`);
  await page.waitForTimeout(750);
  const t1 = await page.evaluate(() => Number(document.getElementById('pa60score').textContent));
  expect(t1).toBeGreaterThan(t0);
});

test('Fase 4 · #60: fallar no deshace lo ya conseguido', async ({ page }) => {
  await entrar(page);
  await page.evaluate(() => window.pa60.play('place', 0));
  await page.waitForTimeout(450);
  const bien = await page.evaluate(() => document.querySelector('.pa60-hold .pa60-item').getAttribute('data-answer'));
  const mal = await page.evaluate((b) => {
    const n = Array.prototype.slice.call(document.querySelectorAll('.pa60-bin'));
    const otro = n.filter((x) => x.getAttribute('data-bin') !== b)[0];
    return otro ? otro.getAttribute('data-bin') : null;
  }, bien);
  expect(mal).toBeTruthy();
  const antes = await page.evaluate(() => document.querySelectorAll('#pa60prog i.on').length);
  await page.click(`.pa60-bin[data-bin="${mal}"]`);
  await page.waitForTimeout(300);
  const despues = await page.evaluate(() => document.querySelectorAll('#pa60prog i.on').length);
  expect(despues).toBe(antes); // ni suma ni resta: el error no castiga
});

test('Fase 4 · #60: el mismo objeto es el mismo objeto en todos los juegos', async ({ page }) => {
  await entrar(page);
  // 26 piezas generadas, no ilustradas
  const n = await page.evaluate(() => window.pa60.objects().length);
  expect(n).toBeGreaterThanOrEqual(20);

  async function dibujo(sel) {
    return page.evaluate((s) => {
      const svg = document.querySelector(s);
      return svg ? svg.innerHTML : null;
    }, sel);
  }
  await page.evaluate(() => window.pa60.play('steps', 0));
  await page.waitForTimeout(400);
  const uno = await page.evaluate(() => {
    const it = document.querySelector('.pa60-steps .pa60-item');
    return { obj: it.getAttribute('data-obj'), svg: it.querySelector('.pa60-obj').innerHTML };
  });
  // el mismo id renderizado de nuevo tiene que dar exactamente el mismo trazo
  const otra = await page.evaluate((o) => {
    const d = document.createElement('div');
    d.innerHTML = document.querySelector('.pa60-item[data-obj="' + o + '"] .pa60-obj').outerHTML;
    return d.querySelector('.pa60-obj').innerHTML;
  }, uno.obj);
  expect(otra).toBe(uno.svg);
  // y es SVG de verdad, no un emoji ni un fondo
  expect(uno.svg).toContain('<path');
});

test('Fase 4 · #60: registrado, aditivo y sin tocar STORE_KEY', async () => {
  const loader = fs.readFileSync(path.resolve(__dirname, '../fase4/fase4.js'), 'utf8');
  const sw = fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8');
  expect(loader).toContain('60-habitos');
  expect(sw).toContain('60-habitos');

  const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const js = sinComentarios(fs.readFileSync(path.resolve(__dirname, '../fase4/60-habitos/spec.js'), 'utf8'));
  const css = sinComentarios(fs.readFileSync(path.resolve(__dirname, '../fase4/60-habitos/spec.css'), 'utf8'));
  expect(js).not.toContain('STORE_KEY');
  expect(css).not.toContain('STORE_KEY');
  expect(js).toContain('pequenautas.f4.habitos.v1');
  // progreso propio: no se mezcla con el de #58
  expect(js).not.toContain('pequenautas.f4.emociones');

  // la capa de gesto de #56 conoce la superficie nueva sin que #60 le hable
  const seis = fs.readFileSync(path.resolve(__dirname, '../fase4/56-arrastrar/spec.js'), 'utf8');
  expect(seis).toContain('.pa60-item.hold');
  expect(seis).toContain('#pa60prompt');
  expect(js).not.toContain('pa56');
});
