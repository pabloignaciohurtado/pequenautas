// Capturas de tienda para Google Play y para el campo `screenshots` del
// manifest. Horizontal 16:9 a 1920x1080 (la app va fija en horizontal).
// Uso: node tools/twa/screenshots.js  (desde la raíz del repo; requiere
// @playwright/test instalado). Escribe screenshots/*.png.
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const URL = 'file://' + path.resolve(__dirname, '../../index.html');
const OUT = path.resolve(__dirname, '../../screenshots');

async function entrar(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  await page.click('.pcard.add');
  await page.waitForTimeout(300);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  await page.waitForTimeout(3500); // módulos diferidos y arte
}

async function seccion(page, card, ov, juego) {
  await page.click(card);
  await page.waitForTimeout(900);
  if (juego === undefined) return;
  await page.locator(ov + ' .pa34-game').nth(juego).click();
  await page.waitForTimeout(500);
  await page.locator(ov + ' .pa34-lvl.cur').first().click();
  await page.waitForTimeout(1500);
}

// En un teléfono los emoji siempre salen en color. En el runner de CI no:
// GNU FreeFont trae caritas en contorno monocromo y Chromium las elige antes
// que Noto Color Emoji, así que "Triste" o "Enojado" salían como dibujos de
// línea. Se antepone a cada elemento una familia que solo cubre los rangos de
// emoji y apunta a la fuente de color; el resto del texto no cambia.
async function emojiEnColor(page) {
  await page.addStyleTag({ content:
    '@font-face{font-family:"PEmojiColor";src:local("Noto Color Emoji");' +
    'unicode-range:U+1F000-1FAFF,U+2600-27BF,U+2B00-2BFF,U+FE0F,U+200D;}' });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body *')) {
      const ff = getComputedStyle(el).fontFamily;
      if (ff && ff.indexOf('PEmojiColor') === -1) el.style.fontFamily = '"PEmojiColor", ' + ff;
    }
  });
  await page.waitForTimeout(300);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const launch = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(launch);
  // Lo que mejor cuenta la app en ocho segundos de scroll en la ficha: el
  // bosque de inicio, dos secciones con sus juegos ilustrados y dos juegos
  // en curso de materias distintas.
  const tomas = [
    ['01-inicio', async (p) => {}],
    ['02-numeros-juego', async (p) => {
      await p.click('.subject[data-game="math"]');
      await p.waitForTimeout(900);
      await p.click('[data-pa34-app="math"]');
      await p.waitForTimeout(500);
      await p.click('.pa34-lvl.cur');
      await p.waitForTimeout(1800);
    }],
    ['03-formas', async (p) => seccion(p, '.subject.pa53-card', '.pa53-ov')],
    ['04-emociones-juego', async (p) => seccion(p, '#pa58Card', '.pa58-ov', 0)],
    ['05-habitos', async (p) => seccion(p, '.subject.pa60-card', '.pa60-ov')],
  ];
  for (const [nombre, paso] of tomas) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2});
    const page = await ctx.newPage();
    await entrar(page);
    await paso(page);
    await emojiEnColor(page);
    await page.screenshot({ path: path.join(OUT, nombre + '.png') });
    console.log(nombre);
    await ctx.close();
  }
  await browser.close();
})();
