import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as path from 'node:path';
import { launchSchola, type ScholaAppContext } from './helpers/electronApp';

const SAMPLE_VAULT_PATH = path.resolve('tests', 'fixtures', 'sample-vault');

test.describe('Schola Phase 2-B-3 — Move', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
  });

  async function rightClickFile(fileName: string): Promise<void> {
    const fileNode = page.locator(`[data-testid="file-node-${fileName}"]`);
    await fileNode.click({ button: 'right' });
    await page.waitForSelector('[data-testid="explorer-context-menu"]', { timeout: 3_000 });
  }

  // ── Context menu ──

  test('right-click .md file shows move in context menu', async () => {
    await rightClickFile('research.md');
    const moveBtn = page.getByTestId('context-menu-move');
    await expect(moveBtn).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('right-click blank area does not show move', async () => {
    const toolbar = page.locator('.vault-toolbar');
    await toolbar.click({ button: 'right' });
    const moveBtn = page.getByTestId('context-menu-move');
    await expect(moveBtn).not.toBeAttached({ timeout: 2_000 });
    await page.keyboard.press('Escape');
  });

  // ── Move dialog ──

  test('click move opens dialog with folder tree and source name', async () => {
    await rightClickFile('code.md');
    await page.getByTestId('context-menu-move').click();
    const dialog = page.getByTestId('move-dialog');
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId('move-dialog-source')).toContainText('code.md');
    await expect(page.getByTestId('move-target-root')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('cancel closes move dialog', async () => {
    await rightClickFile('code.md');
    await page.getByTestId('context-menu-move').click();
    await page.getByTestId('move-dialog-cancel').click();
    await expect(page.getByTestId('move-dialog')).not.toBeAttached({ timeout: 2_000 });
  });

  // ── Regression ──

  test('create still works after move menu', async () => {
    await rightClickFile('code.md');
    await expect(page.getByTestId('context-menu-create-file')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('rename still works after move menu', async () => {
    await rightClickFile('code.md');
    await expect(page.getByTestId('context-menu-rename')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('delete still works after move menu', async () => {
    await rightClickFile('code.md');
    await expect(page.getByTestId('context-menu-delete')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('backlinks still work', async () => {
    const node = page.locator('[data-testid="file-node-code.md"]');
    await node.click(); await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="backlinks-panel"]')).toBeVisible({ timeout: 5_000 });
  });

  test('search is still accessible', async () => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('search-input')).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
  });

  test('preview still works', async () => {
    await page.locator('[data-testid="file-node-code.md"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="markdown-preview"]')).toBeVisible({ timeout: 3_000 });
  });
});
