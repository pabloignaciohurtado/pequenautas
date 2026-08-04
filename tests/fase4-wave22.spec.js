const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

// #57 cambia la política de sonido de toda la app: fuera los efectos
// sintetizados (sonaban a electrodoméstico), dentro una cama de bosque
// procedural. Lo que hay que demostrar aquí es lo que puede romperse de
// verdad, que no es "¿suena?" —eso el navegador de test no lo puede juzgar—
// sino:
//   · que el AudioContext sigue sin nacer durante el alta de perfil, que es
//     la regla que protege a iOS y que la ola 20 ya vigilaba;
//   · que chime() queda mudo mientras el bosque suena —la cama sustituye al
//     pitido— pero vuelve a pasar con el ambiente en Apagado, porque el
//     ajuste "Voz y sonidos" tiene que seguir mandando;
//   · que speak() NO se toca, porque es la única instrucción que entiende
//     un niño que no lee;
//   · que la fila de Ajustes se clona bien y el volumen no escribe en
//     localStorage hasta que un adulto lo cambia.

async function entrar(page) {
  await page.goto(fileUrl);
  await page.waitForTimeout(400);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  await page.waitForTimeout(3000); // los módulos diferidos, #57 el último
}

// Ajustes vive detrás de la puerta de adulto: hay que mantener pulsado.
async function abrirAjustes(page) {
  await page.click('#adultBtn');
  await page.waitForTimeout(250);
  const box = await (await page.$('#holdBtn')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  await page.waitForTimeout(250);
  await page.click('#tabSet');
  await page.waitForTimeout(450);
}

test('Fase 4 · #57: el módulo carga y no crea AudioContext durante el alta', async ({ page }) => {
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
  expect(await page.evaluate(() => !!window.PA57)).toBe(true);
  // el alta de perfil son tres toques y ninguno debe abrir el audio
  expect(await page.evaluate(() => window.__acCount)).toBe(0);
  expect(await page.evaluate(() => window.PA57.running())).toBe(false);
});

test('Fase 4 · #57: el bosque arranca en el primer gesto ya fuera de perfiles', async ({ page }) => {
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
  await page.locator('.subject[data-game="math"]').click();
  await page.waitForTimeout(500);
  // uno y sólo uno: el contexto es único y se reutiliza para siempre
  expect(await page.evaluate(() => window.__acCount)).toBe(1);
  // y no se vuelve a construir por más gestos que haya
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.locator('.subject[data-game="shapes"]').click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__acCount)).toBe(1);
});

test('Fase 4 · #57: chime queda mudo pero speak sigue vivo', async ({ page }) => {
  await entrar(page);
  const r = await page.evaluate(() => ({
    chime: typeof window.chime,
    mudo: !!(window.chime && window.chime.__pa57),
    original: typeof window.__pa57chime,
    speak: typeof window.speak,
    speakSeq: typeof window.speakSeq,
  }));
  expect(r.chime).toBe('function');
  expect(r.mudo).toBe(true);       // envuelta por #57
  expect(r.original).toBe('function'); // el original queda accesible
  expect(r.speak).toBe('function'); // la narración NO se toca
  expect(r.speakSeq).toBe('function');
  // y llamarla no explota: sigue siendo segura para todo app.js
  expect(await page.evaluate(() => { window.chime(true); return true; })).toBe(true);
  // con el bosque encendido (nivel 2 por defecto), el original NO suena
  const conBosque = await page.evaluate(() => {
    let llamado = 0;
    window.__pa57chime = function () { llamado++; };
    window.chime('ok');
    return llamado;
  });
  expect(conBosque).toBe(0);
});

test('Fase 4 · #57: con el ambiente en Apagado, el chime original vuelve a pasar', async ({ page }) => {
  // el nivel 0 se fija antes de que la app cargue, como lo dejaría un adulto
  await page.addInitScript(() => {
    try { localStorage.setItem('pequenautas.f4.ambiente.v1', '0'); } catch (e) { }
  });
  await entrar(page);
  const r = await page.evaluate(() => {
    let llamado = 0;
    window.__pa57chime = function () { llamado++; };
    window.chime('ok');
    return { nivel: window.PA57.level(), llamado };
  });
  expect(r.nivel).toBe(0);
  // apagado el bosque, el pitido de acierto/error vuelve a ser el de app.js
  expect(r.llamado).toBe(1);
});

test('Fase 4 · #57: la fila de Ajustes se clona con su ramita y su nivel', async ({ page }) => {
  await entrar(page);
  await abrirAjustes(page);
  await expect(page.locator('#setAmb')).toHaveCount(1);
  await expect(page.locator('#setAmbN')).toHaveText(/Bosque|Forest/);
  await expect(page.locator('#tgAmb')).toHaveCount(1);
  await expect(page.locator('#ambLvl')).toHaveText(/Normal/);
  // la ramita de Grok entra por CSS, así que lo comprobable es que la
  // variable llegó viva desde el @import del módulo.
  const sprig = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--pa57-sprig').slice(0, 24)
  );
  expect(sprig).toContain('data:image/webp');
  // abrir Ajustes dos veces no duplica la fila
  await page.locator('#tabSet').click();
  await page.waitForTimeout(300);
  await expect(page.locator('#setAmb')).toHaveCount(1);
});

test('Fase 4 · #57: el nivel no se guarda hasta que un adulto lo cambia', async ({ page }) => {
  await entrar(page);
  await abrirAjustes(page);
  const antes = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(antes).not.toContain('pequenautas.f4.ambiente.v1');
  expect(await page.evaluate(() => window.PA57.touched())).toBe(false);
  await page.locator('#ambLvl').click();
  await page.waitForTimeout(200);
  await expect(page.locator('#ambLvl')).toHaveText(/Presente|Full/);
  expect(await page.evaluate(() => localStorage.getItem('pequenautas.f4.ambiente.v1'))).toBe('3');
  // el interruptor apaga, deja el nivel en 0 y deshabilita el botón
  await page.locator('#tgAmb').click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.PA57.level())).toBe(0);
  await expect(page.locator('#ambLvl')).toBeDisabled();
  // y al reencender vuelve al nivel que el adulto había elegido
  await page.locator('#tgAmb').click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.PA57.level())).toBe(3);
});

test('Fase 4 · #55 tras #57: "quién hace PUM PUM" se resuelve mirando', async ({ page }) => {
  await entrar(page);
  await page.locator('.subject[data-game="music"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa55-ov .pa34-game').first().click();
  await page.waitForTimeout(400);
  await page.locator('.pa55-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(900);
  // el enunciado lleva la onomatopeya, y una de las fichas es su dueña:
  // el juego ya no depende de haber oído nada.
  const ono = await page.locator('#pa55prompt').getAttribute('data-ono');
  expect(ono).toBeTruthy();
  await expect(page.locator('#pa55prompt')).toHaveText(new RegExp(ono.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const fichas = await page.locator('.pa55-tile[data-instr]').count();
  expect(fichas).toBeGreaterThan(1);
});

test('Fase 4 · #55 tras #57: agudo o grave dibuja la onda que hay que juzgar', async ({ page }) => {
  await entrar(page);
  await page.locator('.subject[data-game="music"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pa55-ov .pa34-game').nth(3).click();
  await page.waitForTimeout(400);
  await page.locator('.pa55-ov .pa34-lvl.cur').click();
  await page.waitForTimeout(900);
  await expect(page.locator('.pa55-sig svg polyline')).toHaveCount(1);
  const cy = Number(await page.locator('.pa55-sig').getAttribute('data-cy'));
  const alta = await page.evaluate(() => document.querySelector('.pa55-sig').classList.contains('high'));
  // pocas crestas = grave, muchas = agudo. La correspondencia es la pista.
  if (alta) expect(cy).toBeGreaterThanOrEqual(9);
  else expect(cy).toBeLessThanOrEqual(3);
});
