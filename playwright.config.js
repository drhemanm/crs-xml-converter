// Browser tests for the live app (e2e/). Unit tests stay with react-scripts.
//
// Runs against the production build, served with the production headers, so
// what passes here is what ships. Build first: `npm run build`.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  // The 10,000-account test needs room; everything else finishes in seconds.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      // Set where a browser is pre-installed; CI installs its own.
      launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
    },
  }],
  webServer: {
    command: 'node e2e/serve.mjs',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
