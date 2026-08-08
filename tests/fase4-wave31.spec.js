const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// La auditoría de coherencia (#4, recomendación #7) encontró que el progreso
// de #34 y #53-#60 vivía en llaves de localStorage de DISPOSITIVO, sin
// referencia al perfil activo, mientras estrellas y `best` sí eran por niño.
// Con dos hermanos en la misma tablet, el segundo encontraba todo
// desbloqueado y sus logros se acreditaban al perfil que estuviera abierto.
// Estos tests prueban las dos mitades del arreglo en un módulo
// representativo (#53): que la llave vieja de dispositivo se migra UNA VEZ
// al primer perfil que abre la app, y que dos perfiles distintos no
// comparten desbloqueos a partir de ahí.

async function crearPrimerPerfil(page, nombre) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', nombre);
  await page.click('#createBtn');
  await page.waitForTimeout(3000); // #34/#52/#53-#60 son diferidos
}

test('Fase 4 · progreso por perfil (#7): la llave vieja de dispositivo se migra al primer perfil y desaparece', async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  // Progreso "de antes de la ola": llave única de dispositivo, el defecto
  // que describe la auditoría.
  await page.evaluate(() => {
    localStorage.setItem('pequenautas.f4.formas.v1', JSON.stringify({ 'shape:tap': 2 }));
  });
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Mica');
  await page.click('#createBtn');
  await page.waitForTimeout(3000); // #34/#52/#53-#60 diferidos

  // La migración es perezosa (corre dentro de loadP(), disparada por
  // unlocked()): la tarjeta del home puede pintarse una vez con #home
  // .cards ya presente en el HTML estático pero SIN perfil todavía, así
  // que lo que garantiza la migración es la primera lectura real con un
  // perfil activo — abrir el juego, como haría cualquier peque.
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(500);

  const r = await page.evaluate(() => {
    const pid = window.currentProfile().id;
    return {
      nueva: JSON.parse(localStorage.getItem('pequenautas.f4.formas.v1.' + pid) || '{}'),
      vieja: localStorage.getItem('pequenautas.f4.formas.v1'),
    };
  });
  expect(r.nueva['shape:tap']).toBe(2);
  expect(r.vieja).toBeNull(); // la llave vieja se borra: no vuelve a migrarse a un segundo perfil

  // Y se refleja de verdad en el mapa de niveles: dos ya desbloqueados de más.
  await page.locator('.pa53-ov .pa34-game').first().click(); // shape:tap
  await page.waitForTimeout(400);
  await expect(page.locator('.pa53-ov .pa34-lvl.lock')).toHaveCount(2);
});

test('Fase 4 · progreso por perfil (#7): dos hermanos en la misma tablet no comparten desbloqueos', async ({ page }) => {
  await crearPrimerPerfil(page, 'Ana');

  // Ana juega y gana shape:tap nivel 1 -> desbloquea el 2.
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa53-ov .pa34-game').first().click(); // shape:tap
  await page.waitForTimeout(400);
  await page.locator('.pa53-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(600);
  for (let r = 0; r < 8; r++) {
    if ((await page.locator('.pa53-win.show').count()) > 0) break;
    const prompt = await page.locator('#pa53prompt').textContent();
    const m = prompt.match(/el\s+(.+)\?/);
    if (!m) break;
    await page.locator(`.pa53-tile[aria-label="${m[1]}"]`).first().click();
    await page.waitForTimeout(900);
  }
  await expect(page.locator('.pa53-win.show')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const pidAna = await page.evaluate(() => window.currentProfile().id);

  // Crea un segundo perfil de la misma forma en que ya lo hace
  // tests/educator.spec.js (manipulando DB directamente): no hace falta
  // resolver el candado parental para probar el aislamiento del progreso.
  await page.evaluate(() => {
    const b = {
      id: 'pa7-hermano-beto', avatar: '🐼', name: 'Beto', stars: 0,
      best: { math: 0, reading: 0, science: 0 }, ev: [], seenIntro: false,
    };
    DB.profiles.push(b);
    selectProfile(b.id);
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.currentProfile().id)).toBe('pa7-hermano-beto');

  // Beto abre el mismo juego y lo ve de cero: nada heredado de Ana.
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa53-ov .pa34-game').first().click(); // shape:tap
  await page.waitForTimeout(400);
  await expect(page.locator('.pa53-ov .pa34-lvl.lock')).toHaveCount(4);
  await expect(page.locator('.pa53-ov .pa34-lvl.cur')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Y el progreso de Ana sigue intacto en su propia llave al volver a ella.
  await page.evaluate((pid) => selectProfile(pid), pidAna);
  await page.waitForTimeout(500);
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa53-ov .pa34-game').first().click(); // shape:tap
  await page.waitForTimeout(400);
  await expect(page.locator('.pa53-ov .pa34-lvl.lock')).toHaveCount(3);

  // Beto solo miró el mapa de niveles, no ganó ninguno: la escritura es
  // perezosa (solo al ganar), así que su llave ni siquiera llega a existir
  // — la prueba más fuerte de que no hay nada compartido con Ana.
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.indexOf('pequenautas.f4.formas.v1.') === 0).sort());
  expect(keys).toEqual(['pequenautas.f4.formas.v1.' + pidAna]);
});

test('Fase 4 · progreso por perfil (#7): las seis capas migran igual, sin STORE_KEY ni referencias cruzadas', async () => {
  const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const modulos = [
    ['34-juegos', 'pequenautas.f4.juegos.v1'],
    ['53-formas-colores', 'pequenautas.f4.formas.v1'],
    ['54-ingenio', 'pequenautas.f4.ingenio.v1'],
    ['55-musica', 'pequenautas.f4.musica.v1'],
    ['58-emociones', 'pequenautas.f4.emociones.v1'],
    ['60-habitos', 'pequenautas.f4.habitos.v1'],
  ];
  for (const [carpeta, llave] of modulos) {
    const js = sinComentarios(fs.readFileSync(path.resolve(__dirname, `../fase4/${carpeta}/spec.js`), 'utf8'));
    expect(js).not.toContain('STORE_KEY');
    expect(js).toContain(llave); // PKEY_BASE se conserva: el resto de olas lo buscan literal
    expect(js).toContain('currentProfile'); // la llave real depende del perfil activo
    expect(js).toMatch(/function\s+migrar\s*\(/); // migra la llave vieja de dispositivo una sola vez
  }
});
