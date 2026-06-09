import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  // Only one worker so Electron instances never overlap.
  // Multiple Electron processes cannot occupy the same resources
  // (locking, userData) on the same machine.
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  // playwright.config.ts
  webServer: {
    command: 'npm run build:renderer:e2e && npm run build:electron',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
