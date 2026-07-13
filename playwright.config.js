const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', timeout: 60000, workers: 1,
  use: { headless: true, viewport: { width: 1024, height: 768 } },
  reporter: 'list',
});
