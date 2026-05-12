import { expect, test, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import type { AppInfo } from '../../src/lib/contracts/app.types';

interface RendererSecuritySnapshot {
  readonly hasScholaApi: boolean;
  readonly hasNodeRequire: boolean;
  readonly hasNodeProcessVersion: boolean;
}

test.describe('Schola Phase 0 app smoke test', () => {
  let electronApp: ElectronApplication | undefined;
  let page: Page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['dist-electron/electron/main.js'],
    });
    page = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('starts the secure Electron React shell', async () => {
    await expect(page).toHaveTitle(/Schola/);
    await expect(page.getByRole('heading', { name: 'Schola' })).toBeVisible();
    await expect(page.getByText('window.schola.app.getInfo')).toBeVisible();

    const appInfo = await page.evaluate(() => window.schola.app.getInfo());
    expect(appInfo satisfies AppInfo).toMatchObject({
      name: 'Schola',
      phase: 'phase-0',
    });

    const securitySnapshot = await page.evaluate<RendererSecuritySnapshot>(() => {
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
});