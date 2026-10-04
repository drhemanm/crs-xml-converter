// Non-functional checks that must hold on every change: accessibility, the
// production security headers, layout at phone width, and a performance budget.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const h = require('./helpers');

const ROUTES = ['/', '/documentation', '/privacy', '/terms', '/data-request', '/cookie-settings'];

// Reveal animations and colour transitions settle within ~1s; scanning
// mid-animation reports colours no user ever sees at rest.
const settle = (page) => page.waitForTimeout(2500);

const wcag = (page) => new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  .analyze();

const summarise = (violations) => violations.map((v) =>
  `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes[0]?.target.join(' ')}`);

test.describe('accessibility (WCAG 2.2 AA)', () => {
  for (const route of ROUTES) {
    test(`${route} has no violations`, async ({ page }) => {
      await page.goto(route);
      await settle(page);
      expect(summarise((await wcag(page)).violations)).toEqual([]);
    });
  }

  test('the converter has no violations after a file is loaded', async ({ page }) => {
    await page.goto('/');
    const { file } = await h.templateRows(page);
    await h.upload(page, file);
    await settle(page);
    expect(summarise((await wcag(page)).violations)).toEqual([]);
  });

  test('the home page has no violations at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await settle(page);
    expect(summarise((await wcag(page)).violations)).toEqual([]);
  });

  // axe does not see focus behaviour, so dialogs are driven with the keyboard.
  const focusIsIn = (page, dialog) => dialog.evaluate((node) => node.contains(document.activeElement));

  test('the sign-in dialog holds focus, closes on Escape and returns focus', async ({ page }) => {
    await page.goto('/');
    const opener = page.getByRole('button', { name: 'Sign in', exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Sign in' });
    await expect(dialog).toBeVisible();
    expect(await focusIsIn(page, dialog)).toBe(true);
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab');
      expect(await focusIsIn(page, dialog), `focus left the dialog after ${i + 1} presses`).toBe(true);
    }
    await settle(page);
    expect(summarise((await wcag(page)).violations)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('the mobile menu is a labelled dialog that Escape closes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const opener = page.getByRole('button', { name: 'Open menu' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Menu' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close menu' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('the cookie preferences dialog has labelled toggles and closes on Escape', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Customize' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cookie Preferences' });
    await expect(dialog).toBeVisible();
    for (const name of ['Analytics cookies', 'Functional cookies', 'Marketing cookies']) {
      await expect(dialog.getByRole('checkbox', { name })).toHaveCount(1);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('a file can be chosen with the keyboard alone', async ({ page }) => {
    await page.goto('/');
    let reached = false;
    for (let i = 0; i < 120 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => /Choose an Excel or CSV file/.test(document.activeElement?.innerText || ''));
    }
    expect(reached, 'upload control reachable by Tab').toBe(true);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
    expect(chooser).toBeTruthy();
  });
});

test.describe('security', () => {
  test('production headers are served and the app runs under the CSP without violations', async ({ page }) => {
    const violations = [];
    page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
    const response = await page.goto('/');
    const headers = response.headers();
    for (const name of ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) {
      expect(headers[name], name).toBeTruthy();
    }
    const { file } = await h.templateRows(page);
    await h.upload(page, file);
    // Third-party origins (analytics, Firebase) are unreachable in CI; only
    // refusals of the app's own resources are failures.
    expect(violations.filter((v) => /127\.0\.0\.1|'self'|inline/i.test(v))).toEqual([]);
  });

  test('nothing third-party is requested before the visitor consents', async ({ page }) => {
    const requested = [];
    page.on('request', (r) => requested.push(r.url()));
    await page.goto('/');
    await page.waitForTimeout(3000);
    const tracking = requested.filter((u) =>
      /google-analytics\.com|googletagmanager\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|paypal\.com/.test(u));
    expect(tracking).toEqual([]);
  });

  test('the CSP refuses an injected inline script', async ({ page }) => {
    await page.goto('/');
    const ran = await page.evaluate(() => {
      const s = document.createElement('script');
      s.textContent = 'window.__inline = 1';
      document.body.appendChild(s);
      return window.__inline === 1;
    });
    expect(ran).toBe(false);
  });
});

test.describe('layout', () => {
  for (const width of [390, 768, 1280]) {
    test(`no horizontal scroll at ${width}px on any page`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ROUTES) {
        await page.goto(route);
        await page.waitForTimeout(500);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${route} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe('performance', () => {
  // 5,000 accounts took ~1s to read and ~0.5s to generate on a CI-class
  // machine. The budgets leave headroom for a slow runner while still catching
  // a regression of an order of magnitude.
  test('5,000 accounts are read, generated and schema-valid within budget', async ({ page }) => {
    await page.goto('/');
    const { rows } = await h.templateRows(page);
    const many = Array.from({ length: 5000 }, (_, i) => ({ ...rows[i % 2], account_number: `MU${String(i).padStart(10, '0')}` }));
    const file = h.writeXlsx('perf-5000', many);
    await h.fillInstitution(page, { year: 2026 });

    let t = Date.now();
    await h.upload(page, file);
    const readMs = Date.now() - t;

    t = Date.now();
    const out = await h.generate(page);
    const generateMs = Date.now() - t;

    expect(h.count(out.xml, 'AccountReport')).toBe(5000);
    h.expectSchemaValid(out.path);
    test.info().annotations.push({ type: 'timing', description: `read ${readMs}ms, generate ${generateMs}ms` });
    expect(readMs, 'read + validate').toBeLessThan(15_000);
    expect(generateMs, 'generate').toBeLessThan(15_000);
  });

  test('a file over the upload limit is refused at once', async ({ page }) => {
    await page.goto('/');
    const fs = require('fs'); const os = require('os'); const path = require('path');
    const file = path.join(os.tmpdir(), 'too-big.csv');
    fs.writeFileSync(file, 'account_number\n' + 'x'.repeat(16 * 1024 * 1024));
    await page.locator('input[type=file]').setInputFiles(file);
    await expect(page.getByText(/The limit is 15MB/)).toBeVisible({ timeout: 5000 });
  });
});
