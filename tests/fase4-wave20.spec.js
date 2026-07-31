const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #55 añade la SEXTA sección —Música y Sonidos—. Trae dos fronteras nuevas
// que ninguna ola anterior había tocado:
//   1. el audio. Todo se sintetiza con WebAudio, así que el navegador de
//      test (sin gesto real y a menudo sin dispositivo de salida) no puede
//      ser la referencia: NINGUNA aserción de aquí depende de que suene
//      algo. Lo que sí se comprueba es que el AudioContext no se crea al
//      cargar el módulo —crearlo fuera de un gesto rompe iOS— y que la app
//      es jugable de punta a punta con el sonido inerte.
//   2. la rejilla de Home pasa de cinco a seis casas: 3+3.

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  await page.waitForTimeout(3000); // #34/#52/#53/#54/#55 son diferidos
}

async function abrirMusica(page, i) {
  await page.locator('.subject[data-game="music"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa55-ov .pa34-game').nth(i).click();
  await page.waitForTimeout(400);
  await page.locator('.pa55-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(900);
}

test('Fase 4 · #55: la sexta tarjeta entra sin desplazar a las otras cinco', async ({ page }) => {
  await entrar(page);
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('#home .subject')].map((c) => c.getAttribute('data-game'))
  );
  expect(cards).toEqual(['math', 'reading', 'science', 'shapes', 'brain', 'music', 'emotions']);
  await expect(page.locator('#pa55Card .label')).toHaveText(/Música|Music/);
  await expect(page.locator('#pa55Lv')).toHaveText(/Nivel 1|Level 1/);
});

test('Fase 4 · #55: seis casas caben en dos filas de tres', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await entrar(page);
  const rows = await page.evaluate(() => {
    // offsetTop: el rect incluiría el transform del balanceo de las tarjetas.
    const tops = [...document.querySelectorAll('#home .subject')].map((c) => c.offsetTop);
    return [...new Set(tops)].length;
  });
  expect(rows).toBe(3); // 3+3 y la banda de #58
});

test('Fase 4 · #55: no se crea AudioContext hasta que el niño toca', async ({ page }) => {
  await page.addInitScript(() => {
    window.__acCount = 0;
    const C = window.AudioContext || window.webkitAudioContext;
    if (C) {
      const Wrapped = function (...a) {
        window.__acCount++;
        return new C(...a);
      };
      window.AudioContext = Wrapped;
      window.webkitAudioContext = Wrapped;
    }
  });
  await entrar(page);
  expect(await page.evaluate(() => window.__acCount)).toBe(0);
  await page.locator('.subject[data-game="music"]').click();
  await page.waitForTimeout(400);
  // tras el gesto puede o no existir (según soporte del navegador), pero
  // nunca debe crearse más de uno: el contexto es único y se reutiliza.
  expect(await page.evaluate(() => window.__acCount)).toBeLessThanOrEqual(1);
});

test('Fase 4 · #55: los cuatro juegos con su viñeta de arte', async ({ page }) => {
  await entrar(page);
  await page.locator('.subject[data-game="music"]').click();
  await page.waitForTimeout(500);
  const games = await page.evaluate(() =>
    [...document.querySelectorAll('.pa55-ov .pa34-game')].map((c) => {
      const m = c.querySelector('.mech');
      const cs = getComputedStyle(m);
      return {
        id: c.getAttribute('data-pa34-game'),
        h: parseFloat(cs.height),
        img: cs.backgroundImage,
        name: (c.querySelector('.gn') || {}).textContent,
      };
    })
  );
  expect(games.map((g) => g.id)).toEqual([
    'music:instr',
    'music:echo',
    'music:loud',
    'music:pitch',
  ]);
  for (const g of games) {
    expect(g.img).toContain('data:image/webp');
    expect(g.h).toBeGreaterThan(80); // hereda la banda grande de #52
    expect((g.name || '').length).toBeGreaterThan(3);
  }
});

test('Fase 4 · #55: mapa de cinco niveles con solo el primero abierto', async ({ page }) => {
  await entrar(page);
  await page.locator('.subject[data-game="music"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa55-ov .pa34-game').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('.pa55-ov .pa34-lvl')).toHaveCount(5);
  await expect(page.locator('.pa55-ov .pa34-lvl.cur')).toHaveCount(1);
  await expect(page.locator('.pa55-ov .pa34-lvl.lock')).toHaveCount(4);
});

test('Fase 4 · #55: ¿qué suena? se puede completar sin oír nada', async ({ page }) => {
  await entrar(page);
  await abrirMusica(page, 0);
  await expect(page.locator('.pa55-play.show')).toHaveCount(1);
  const total = await page.locator('#pa55prog i').count();
  expect(total).toBe(4);
  // El acierto no se puede adivinar por el sonido, pero el módulo marca la
  // ficha correcta con .pa55-ok: se prueban todas hasta que una lo sea.
  for (let paso = 0; paso < total; paso++) {
    const n = await page.locator('.pa55-tile').count();
    for (let i = 0; i < n; i++) {
      await page.locator('.pa55-tile').nth(i).click();
      await page.waitForTimeout(120);
      if ((await page.locator('#pa55prog i.on').count()) > paso) break;
    }
    await page.waitForTimeout(1000);
  }
  await expect(page.locator('#pa55win.show')).toHaveCount(1);
  await expect(page.locator('#pa55wt')).toHaveText(/Muy bien|Great job/);
});

test('Fase 4 · #55: el progreso vive en su propia clave y no toca el resto', async ({ page }) => {
  await entrar(page);
  const antes = await page.evaluate(() => Object.keys(localStorage).sort());
  await abrirMusica(page, 2); // fuerte o suave
  const n = await page.locator('.pa55-tile').count();
  expect(n).toBe(2);
  for (let paso = 0; paso < 5; paso++) {
    for (let i = 0; i < 2; i++) {
      await page.locator('.pa55-tile').nth(i).click();
      await page.waitForTimeout(150);
      if ((await page.locator('#pa55prog i.on').count()) > paso) break;
    }
    await page.waitForTimeout(1000);
  }
  await expect(page.locator('#pa55win.show')).toHaveCount(1);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('pequenautas.f4.musica.v1') || '{}')
  );
  expect(saved['music:loud']).toBe(1);
  const despues = await page.evaluate(() => Object.keys(localStorage).sort());
  const nuevas = despues.filter((k) => !antes.includes(k));
  expect(nuevas).toEqual(['pequenautas.f4.musica.v1']);
});

test('Fase 4 · #55: agudo o grave ordena barras de menor a mayor en experto', async ({ page }) => {
  test.setTimeout(120000); // recarga + los seis módulos diferidos otra vez
  await entrar(page);
  await page.evaluate(() => {
    localStorage.setItem(
      'pequenautas.f4.musica.v1',
      JSON.stringify({ 'music:pitch': 4 })
    );
  });
  await page.reload();
  await page.waitForTimeout(2500);
  await page.locator('.subject[data-game="music"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa55-ov .pa34-game').nth(3).click();
  await page.waitForTimeout(400);
  await page.locator('.pa55-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(900);
  const notas = await page.locator('.pa55-note').count();
  expect(notas).toBe(4);
  // la barra más alta corresponde a la frecuencia más alta: la pista visual
  // que hace jugable el nivel en silencio.
  const pares = await page.evaluate(() =>
    [...document.querySelectorAll('.pa55-note')].map((b) => ({
      f: Number(b.getAttribute('data-f')),
      h: parseFloat(getComputedStyle(b.querySelector('.bar')).height),
    }))
  );
  const porF = pares.slice().sort((a, b) => a.f - b.f);
  for (let i = 1; i < porF.length; i++) {
    expect(porF[i].h).toBeGreaterThan(porF[i - 1].h);
  }
});

test('Fase 4 · #55: cerrar con Escape devuelve al mapa sin romper Home', async ({ page }) => {
  await entrar(page);
  await abrirMusica(page, 1); // repite la melodía
  await expect(page.locator('.pa55-play.show')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await expect(page.locator('.pa55-play.show')).toHaveCount(0);
  await expect(page.locator('#home .subject')).toHaveCount(7);
});
