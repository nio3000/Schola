import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build:renderer && npm run build:electron',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
