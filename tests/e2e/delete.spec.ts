import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as path from 'node:path';
import { launchSchola, type ScholaAppContext } from './helpers/electronApp';

const SAMPLE_VAULT_PATH = path.resolve('tests', 'fixtures', 'sample-vault');

test.describe('Schola Phase 2-B-2 — Delete', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) {
      await ctx.close();
    }
  });

  async function rightClickFile(fileName: string): Promise<void> {
    const fileNode = page.locator(`[data-testid="file-node-${fileName}"]`);
    await fileNode.click({ button: 'right' });
    await page.waitForSelector('[data-testid="explorer-context-menu"]', { timeout: 3_000 });
  }

  // ── 1. Context menu ──

  test('right-click .md file shows delete in context menu', async () => {
    await rightClickFile('research.md');
    const deleteBtn = page.getByTestId('context-menu-delete');
    await expect(deleteBtn).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('right-click blank area does not show delete', async () => {
    const toolbar = page.locator('.vault-toolbar');
    await toolbar.click({ button: 'right' });
    const deleteBtn = page.getByTestId('context-menu-delete');
    await expect(deleteBtn).not.toBeAttached({ timeout: 2_000 });
    await page.keyboard.press('Escape');
  });

  // ── 2. Delete dialog ──

  test('click delete opens confirmation dialog', async () => {
    await rightClickFile('code.md');
    const deleteBtn = page.getByTestId('context-menu-delete');
    await deleteBtn.click();
    const dialog = page.getByTestId('delete-dialog');
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    // Cancel
    await page.getByTestId('delete-dialog-cancel').click();
    await expect(dialog).not.toBeAttached({ timeout: 2_000 });
  });

  test('delete dialog shows file name and trash message', async () => {
    await rightClickFile('code.md');
    await page.getByTestId('context-menu-delete').click();
    const msg = page.getByTestId('delete-dialog-message');
    await expect(msg).toContainText('code.md');
    await expect(msg).toContainText('回收站');
    await page.keyboard.press('Escape');
  });

  // ── 3. Confirm/Cancel ──

  test('cancel closes delete dialog without removing file', async () => {
    await rightClickFile('code.md');
    await page.getByTestId('context-menu-delete').click();
    await page.getByTestId('delete-dialog-cancel').click();
    // File still exists
    await expect(page.locator('[data-testid="file-node-code.md"]')).toBeVisible({ timeout: 3_000 });
  });

  // ── 4. Regression ──

  test('create file still works after delete menu', async () => {
    await rightClickFile('code.md');
    const createBtn = page.getByTestId('context-menu-create-file');
    await expect(createBtn).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('rename still works after delete menu', async () => {
    await rightClickFile('code.md');
    const renameBtn = page.getByTestId('context-menu-rename');
    await expect(renameBtn).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('backlinks still work', async () => {
    const node = page.locator('[data-testid="file-node-code.md"]');
    await node.click();
    await page.waitForTimeout(500);
    const backlinksPanel = page.locator('[data-testid="backlinks-panel"]');
    await expect(backlinksPanel).toBeVisible({ timeout: 5_000 });
  });

  test('search is still accessible', async () => {
    await page.keyboard.press('Control+k');
    const searchInput = page.getByTestId('search-input');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
  });

  test('preview still works', async () => {
    const node = page.locator('[data-testid="file-node-code.md"]');
    await node.click();
    await page.waitForTimeout(500);
    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 3_000 });
  });
});
