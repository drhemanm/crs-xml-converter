import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end tests.
 *
 * These exist because the unit tests prove the domain is correct while saying
 * nothing about whether a filer can actually complete a return. Every filing
 * mode is exercised here, including the ones that must fail.
 */
export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env["CI"] ? "line" : "list",
  // The app loads a ~1 MB WebAssembly chunk on first generate. On a loaded
  // machine the default 5s assertion timeout produced occasional false
  // failures; 10s is still short enough to catch a genuine hang.
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Provided by the environment; do not download a browser.
          executablePath: process.env["CHROMIUM_PATH"] ?? undefined,
        },
      },
    },
  ],
  webServer: {
    command: "pnpm --filter @crs/web build && pnpm --filter @crs/web preview --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    // Never reuse a running server. A stale preview left over from an earlier
    // build silently serves an old bundle, so the suite reports green on code
    // that is not the code under test — which is exactly how this config was
    // caught producing one spurious failure.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
