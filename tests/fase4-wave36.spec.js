const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const fileUrl = 'file://' + path.join(root, 'index.html');

// Empaquetado para Google Play (TWA). La app está dirigida a niños de 3 a 5
// años, así que la política de Familias pesa más que cualquier otra: estos
// tests fijan lo que esa política y la ficha de la tienda necesitan para que
// un cambio futuro no lo rompa sin que nadie se entere.

function pngSize(p) {
  const b = fs.readFileSync(p);
  expect(b.slice(1, 4).toString()).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('Play · la app no hace NINGUNA petición a terceros (fuentes servidas desde el dominio)', async ({ page }) => {
  const fuera = [];
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('blob:')) fuera.push(u);
  });
  await page.goto(fileUrl);
  await page.waitForTimeout(800);
  await page.click('.pcard.add');
  await page.waitForTimeout(250);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', 'Lea');
  await page.click('#createBtn');
  await page.waitForTimeout(3500); // #51/#52 cargan Baloo 2 de forma diferida
  expect(fuera).toEqual([]);
  // y la tipografía de verdad llegó desde fonts/
  const ok = await page.evaluate(() => document.fonts.check('600 20px "Baloo 2"') && document.fonts.check('500 16px Fredoka'));
  expect(ok).toBe(true);
});

test('Play · fuentes locales: cada woff2 que cita fonts.css existe y el sw las precachea', async () => {
  const css = fs.readFileSync(path.join(root, 'fonts/fonts.css'), 'utf8');
  const files = [...new Set([...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => m[1]))];
  expect(files.length).toBe(4);
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  for (const f of files) {
    const buf = fs.readFileSync(path.join(root, 'fonts', f));
    expect(buf.slice(0, 4).toString()).toBe('wOF2');
    expect(sw).toContain('./fonts/' + f);
  }
  expect(sw).toContain('./fonts/fonts.css');
  for (const f of ['index.html', 'fase4/51-hero-globo/spec.js', 'fase4/52-juegos-tarjetas/spec.js']) {
    expect(fs.readFileSync(path.join(root, f), 'utf8')).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  }
});

test('Play · manifest: íconos PNG any + maskable a 192 y 512, capturas 16:9 y orientación horizontal', async () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  expect(m.orientation).toBe('landscape');
  expect(m.display).toBe('standalone');
  for (const purpose of ['any', 'maskable']) {
    for (const size of [192, 512]) {
      const ic = m.icons.find((i) => i.purpose === purpose && i.sizes === size + 'x' + size);
      expect(ic, purpose + ' ' + size).toBeTruthy();
      expect(ic.type).toBe('image/png');
      expect(pngSize(path.join(root, ic.src))).toEqual({ w: size, h: size });
    }
  }
  expect(m.screenshots.length).toBeGreaterThanOrEqual(2);
  for (const s of m.screenshots) {
    expect(s.form_factor).toBe('wide');
    expect(pngSize(path.join(root, s.src))).toEqual({ w: 1920, h: 1080 });
  }
});

test('Play · arte de la ficha hecho con Grok: ícono definitivo y gráfico destacado 1024x500', async () => {
  // Regla del proyecto: todo el arte lo dibuja Grok. Las fuentes viven en
  // assets/brand/ (las trae tools/twa/fetch_art.py verificando su sha256); si
  // faltaran, make_icons.py caería al ícono provisorio sin avisar.
  const arte = JSON.parse(fs.readFileSync(path.join(root, 'tools/twa/arte-grok.json'), 'utf8'));
  for (const a of arte) {
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
    const buf = fs.readFileSync(path.join(root, a.archivo));
    expect(buf.slice(8, 12).toString()).toBe('WEBP');
  }
  const fg = path.join(root, 'store/feature-graphic.png');
  expect(pngSize(fg)).toEqual({ w: 1024, h: 500 });
  // Play lo pide en JPEG o PNG de 24 bits sin alfa: tipo de color 2 (RGB)
  expect(fs.readFileSync(fg)[25]).toBe(2);
});

test('Play · assetlinks verifica el paquete com.pequenautas.bosque y la TWA apunta al mismo dominio', async () => {
  const al = JSON.parse(fs.readFileSync(path.join(root, '.well-known/assetlinks.json'), 'utf8'));
  const t = al[0].target;
  expect(al[0].relation).toContain('delegate_permission/common.handle_all_urls');
  expect(t.package_name).toBe('com.pequenautas.bosque');
  expect(t.sha256_cert_fingerprints.length).toBeGreaterThanOrEqual(1);
  for (const fp of t.sha256_cert_fingerprints) expect(fp).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  const twa = JSON.parse(fs.readFileSync(path.join(root, 'tools/twa/twa-manifest.json'), 'utf8'));
  expect(twa.packageId).toBe(t.package_name);
  expect(twa.orientation).toBe('landscape');
  expect(twa.enableNotifications).toBe(false);
  expect(twa.enableSiteSettingsShortcut).toBe(false); // un niño no debe llegar a los ajustes de Chrome
  expect(twa.iconUrl).toContain(twa.host);
});

test('Play · política de privacidad publicada (ES/EN, con contacto) y enlazada desde Ajustes', async ({ page }) => {
  const html = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
  expect(html).toContain('id="es"');
  expect(html).toContain('id="en"');
  expect(html).toMatch(/mailto:[^"]+@/);
  expect(html).not.toMatch(/\[(EMAIL|PENDIENTE|RAZÓN|LEGAL)/);
  expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);

  await page.goto(fileUrl);
  await page.waitForTimeout(1500);
  const a = page.locator('#pa28Privacy');
  await expect(a).toHaveCount(1);
  expect(await a.getAttribute('href')).toBe('privacy.html#es');
  expect(await a.getAttribute('target')).toBe('_blank');
  expect(await a.textContent()).toBe('Política de privacidad');
  // está dentro de Ajustes, detrás del gate de adultos
  expect(await page.evaluate(() => !!document.querySelector('#setView #pa28Privacy'))).toBe(true);
});
