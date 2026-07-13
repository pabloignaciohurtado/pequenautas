const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

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

async function openAdultGate(page) {
  await page.click('#adultBtn');
  await page.waitForTimeout(200);
  const hb = await page.$('#holdBtn');
  const box = await hb.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  await page.waitForTimeout(200);
}

test('el panel educador aparece como pestaña tras el gate y agrega datos', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createProfile(page, 'Sofia');
  await page.evaluate(() => {
    logRound('math', 'math-3', true, 1, 1200, false);
    logRound('reading', 'read-A', false, 2, 3000, false);
    logRound('science', 'sci-water', true, 1, 900, false);
  });
  await openAdultGate(page);
  await page.click('#tabEdu');
  await expect(page.locator('#eduView')).toBeVisible();
  await expect(page.locator('#eduBody .stat')).toHaveCount(4);
  await expect(page.locator('#eduBody .eduChild')).toHaveCount(1);
  await expect(page.locator('#eduBody')).toContainText('Sofia');
  expect(errors).toEqual([]);
});

test('el panel agrega TODOS los perfiles (por niño)', async ({ page }) => {
  await page.goto(fileUrl);
  const count = await page.evaluate(() => {
    DB.profiles = [
      { id: 'a', avatar: '🦊', name: 'Ana', stars: 1, best: { math: 0, reading: 0, science: 0 },
        ev: [{ g: 'math', k: 'math-3', ft: 1, at: 1, ms: 1000, as: 0 },
             { g: 'math', k: 'math-5', ft: 0, at: 2, ms: 2000, as: 0 }] },
      { id: 'b', avatar: '🐼', name: 'Beto', stars: 0, best: { math: 0, reading: 0, science: 0 },
        ev: [{ g: 'reading', k: 'read-A', ft: 1, at: 1, ms: 1500, as: 0 }] },
    ];
    DB.currentId = 'a';
    saveDB();
    renderEducator();
    return document.querySelectorAll('#eduBody .eduChild').length;
  });
  expect(count).toBe(2);
  const exportOk = await page.evaluate(() => typeof eduExportCSV === 'function');
  expect(exportOk).toBe(true);
});

test('el flag backendSync está OFF y el doc de backend existe', async ({ page }) => {
  await page.goto(fileUrl);
  const flag = await page.evaluate(() => window.PEQUE_FLAGS && window.PEQUE_FLAGS.backendSync);
  expect(flag).toBe(false);
  const docPath = path.resolve(__dirname, '../docs/backend-supabase.md');
  expect(fs.existsSync(docPath)).toBe(true);
  const doc = fs.readFileSync(docPath, 'utf8');
  expect(doc).toContain('RLS');
  expect(doc).toContain('COPPA');
  expect(doc).toContain('backendSync');
});

test('la pestaña educador cambia a EN al alternar idioma', async ({ page }) => {
  await createProfile(page, 'Nil');
  await page.click('#langBtn');
  await expect(page.locator('#tabEduTxt')).toHaveText('Educator');
});
