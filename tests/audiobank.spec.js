const { test, expect } = require('@playwright/test');
const path = require('path');
const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');

async function createProfile(page, name) {
  await page.goto(fileUrl);
  await expect(page.locator('#profiles')).toBeVisible();
  await page.click('.pcard.add');
  await page.waitForTimeout(300);
  await page.locator('.avopt').first().click();
  await page.fill('#nameInput', name || 'Test');
  await page.click('#createBtn');
  await page.waitForTimeout(300);
  await expect(page.locator('#home')).toBeVisible();
}

test('AudioBank existe, queda inerte bajo file:// y no rompe la app', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(fileUrl);
  const info = await page.evaluate(() => ({
    hasBank: typeof window.AudioBank === 'object' && !!window.AudioBank,
    enabled: window.AudioBank.enabled,
    keysLen: window.AudioBank.keys().length,
    available: window.AudioBank.available(),
    missing: window.AudioBank.missing().length,
    url: window.AudioBank.url('intro_tap', 'es'),
    hasUnknown: window.AudioBank.has('nope', 'es'),
    speakOk: (() => { try { speak('hola', { key: 'intro_tap' }); speakSeq([{ t: 'a', key: 'cheer_great' }, { t: 'b' }]); return true; } catch (e) { return false; } })()
  }));
  expect(info.hasBank).toBe(true);
  expect(info.enabled).toBe(false);
  expect(info.available).toEqual([]);
  expect(info.missing).toBe(info.keysLen);
  expect(info.url).toBe('audio/es/intro_tap.mp3');
  expect(info.hasUnknown).toBe(false);
  expect(info.speakOk).toBe(true);
  expect(errors).toEqual([]);
});

test('con el banco cargado, el fallback TTS sigue premiando la ronda de numeros', async ({ page }) => {
  await createProfile(page, 'Voz');
  await page.click('.subject[data-game="math"]');
  await page.waitForTimeout(500);
  const count = await page.$$eval('#stage .obj', (els) => els.length);
  const btns = await page.$$('#stage .choice');
  for (const b of btns) {
    const n = await b.$eval('.cnum', (el) => parseInt(el.textContent, 10)).catch(() => null);
    if (n === count) { await b.click(); break; }
  }
  await page.waitForTimeout(400);
  await expect(page.locator('#starCount')).toHaveText('1');
});
