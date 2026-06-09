import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { AppInfo } from '../../src/lib/contracts/app.types';
import { launchSchola, type ScholaAppContext, dumpScholaLogs } from './helpers/electronApp';

interface RendererSecuritySnapshot {
  readonly hasScholaApi: boolean;
  readonly hasNodeRequire: boolean;
  readonly hasNodeProcessVersion: boolean;
}

// ─────────────────────────────────────────────
// Phase 0  Startup Smoke
// ─────────────────────────────────────────────
// The first describe block verifies ONLY the Electron shell:
// window exists, React booted, preload API is exposed, Node
// APIs are NOT exposed, welcome page is visible.
//
// Theme assertions live in a separate describe below so that
// a theme bug never pollutes the fundamental shell diagnosis.

test.describe('Schola startup smoke (Phase 0 shell)', () => {
  let ctx: ScholaAppContext | undefined;
  let page: Page | undefined;

  test.beforeAll(async () => {
    ctx = await launchSchola();
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) {
      await ctx.close();
    }
  });

  test('starts the secure Electron React shell', async () => {
<<<<<<< Updated upstream
    await expect(page).toHaveTitle(/Schola/);
    await expect(page.getByRole('heading', { name: 'Schola' })).toBeVisible();
    await expect(page.getByText('window.schola.app.getInfo')).toBeVisible();
=======
    const p = page!;
>>>>>>> Stashed changes

    // Page title must contain "Schola" soon after launch.
    try {
      await expect(p).toHaveTitle(/Schola/, { timeout: 5_000 });
    } catch {
      const actualTitle = await p.evaluate(() => document.title);
      if (ctx) dumpScholaLogs(ctx);
      throw new Error(
        `Expected page title to match /Schola/ but got ${JSON.stringify(actualTitle)}. ` +
          'This is likely an app regression: React may be clearing document.title.',
      );
    }

    // Welcome page heading must be visible
    await expect(p.getByRole('heading', { name: 'Schola' })).toBeVisible();

    // schola-ready marker must be set by React App useEffect
    await p.waitForFunction(
      () => document.documentElement.dataset.scholaReady === 'true',
      { timeout: 5_000 },
    );

    // Welcome page DOM testid must exist
    await expect(p.locator('[data-testid="welcome-page"]')).toBeVisible();
  });

  test('preload API is exposed and Node APIs are not', async () => {
    const p = page!;

    const appInfo = await p.evaluate(() => window.schola.app.getInfo());
    expect(appInfo satisfies AppInfo).toMatchObject({
      name: 'Schola',
      phase: 'phase-0',
    });

    const securitySnapshot = await p.evaluate<RendererSecuritySnapshot>(() => {
      const possibleProcess = (window as Window & { process?: { versions?: { node?: string } } })
        .process;

      return {
        hasScholaApi: typeof window.schola?.app.getInfo === 'function',
        hasNodeRequire: typeof (window as Window & { require?: unknown }).require !== 'undefined',
        hasNodeProcessVersion: typeof possibleProcess?.versions?.node === 'string',
      };
    });

    expect(securitySnapshot).toEqual({
      hasScholaApi: true,
      hasNodeRequire: false,
      hasNodeProcessVersion: false,
    });
  });
<<<<<<< Updated upstream
});
=======
});

// ─────────────────────────────────────────────
// App Theme Tests
// ─────────────────────────────────────────────
// Theme assertions are isolated in their own describe so that
// intermittent theme-timing issues never shadow a true launch
// failure in the smoke test above.

test.describe('Schola app theme system', () => {
  let ctx: ScholaAppContext | undefined;
  let page: Page | undefined;

  test.beforeAll(async () => {
    ctx = await launchSchola();
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) {
      await ctx.close();
    }
  });

  test('app theme selector exists in status bar', async () => {
    const selector = page!.getByTestId('app-theme-selector');
    await expect(selector).toBeVisible();
    await expect(selector).toBeAttached();
  });

  test('defaults to neutral-dark', async () => {
    await page!.waitForFunction(
      () => document.documentElement.getAttribute('data-app-theme') !== null,
      { timeout: 5_000 },
    );

    const attr = await page!.evaluate(() =>
      document.documentElement.getAttribute('data-app-theme'),
    );
    expect(attr).toBe('neutral-dark');
  });

  test('switch to warm-dark sets data-app-theme', async () => {
    await page!.getByTestId('app-theme-selector').selectOption('warm-dark');
    await page!.waitForTimeout(200);
    const attr = await page!.evaluate(() =>
      document.documentElement.getAttribute('data-app-theme'),
    );
    expect(attr).toBe('warm-dark');
  });

  test('switch to light sets data-app-theme', async () => {
    await page!.getByTestId('app-theme-selector').selectOption('light');
    await page!.waitForTimeout(200);
    const attr = await page!.evaluate(() =>
      document.documentElement.getAttribute('data-app-theme'),
    );
    expect(attr).toBe('light');
  });

  test('switch to paper sets data-app-theme', async () => {
    await page!.getByTestId('app-theme-selector').selectOption('paper');
    await page!.waitForTimeout(200);
    const attr = await page!.evaluate(() =>
      document.documentElement.getAttribute('data-app-theme'),
    );
    expect(attr).toBe('paper');
  });

  test('localStorage saves schola.appTheme', async () => {
    await page!.getByTestId('app-theme-selector').selectOption('warm-dark');
    await page!.waitForTimeout(200);
    const stored = await page!.evaluate(() =>
      localStorage.getItem('schola.appTheme'),
    );
    expect(stored).toBe('warm-dark');
  });

  test('reload restores the app theme', async () => {
    await page!.getByTestId('app-theme-selector').selectOption('deep-dark');
    await page!.waitForTimeout(300);

    await page!.reload();

    const attr = await page!.evaluate(() =>
      document.documentElement.getAttribute('data-app-theme'),
    );
    expect(attr).toBe('deep-dark');
  });

  test('app theme change does not reset preview theme', async () => {
    const previewBefore = await page!.evaluate(() => {
      const previewEl = document.querySelector('.schola-markdown-preview');
      return previewEl ? previewEl.getAttribute('data-preview-theme') : 'not-mounted';
    });

    await page!.getByTestId('app-theme-selector').selectOption('light');
    await page!.waitForTimeout(200);

    const previewAfter = await page!.evaluate(() => {
      const previewEl = document.querySelector('.schola-markdown-preview');
      return previewEl ? previewEl.getAttribute('data-preview-theme') : 'not-mounted';
    });

    expect(previewAfter).toBe(previewBefore);
  });

  test('status bar is visible and styled', async () => {
    const statusbar = page!.getByTestId('statusbar');
    await expect(statusbar).toBeVisible();
  });
});
>>>>>>> Stashed changes
