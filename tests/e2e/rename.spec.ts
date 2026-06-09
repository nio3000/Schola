import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as path from 'node:path';
import { launchSchola, type ScholaAppContext } from './helpers/electronApp';

const SAMPLE_VAULT_PATH = path.resolve('tests', 'fixtures', 'sample-vault');

test.describe('Schola Phase 2-B-1 — Rename', () => {
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

  async function rightClickFolder(folderName: string): Promise<void> {
    const folderNode = page.locator(`[data-testid="folder-node-${folderName}"]`);
    await folderNode.click({ button: 'right' });
    await page.waitForSelector('[data-testid="explorer-context-menu"]', { timeout: 3_000 });
  }

  async function clickMenuRename(): Promise<void> {
    const renameBtn = page.getByTestId('context-menu-rename');
    await renameBtn.click();
    await page.waitForSelector('[data-testid="rename-dialog"]', { timeout: 3_000 });
  }

  async function confirmRename(name: string): Promise<void> {
    const input = page.getByTestId('rename-dialog-input');
    await input.fill(name);
    const confirm = page.getByTestId('rename-dialog-confirm');
    await confirm.click();
  }

  async function cancelRename(): Promise<void> {
    const cancel = page.getByTestId('rename-dialog-cancel');
    await cancel.click();
  }

  // ── 1. Context menu ──

  test('right-click .md file shows rename in context menu', async () => {
    await rightClickFile('research.md');
    const renameBtn = page.getByTestId('context-menu-rename');
    await expect(renameBtn).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('right-click folder shows rename in context menu', async () => {
    await rightClickFolder('assets');
    const renameBtn = page.getByTestId('context-menu-rename');
    await expect(renameBtn).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('right-click blank area does not show rename', async () => {
    // Right-click on the vault toolbar area (not on a file/folder node)
    const toolbar = page.locator('.vault-toolbar');
    await toolbar.click({ button: 'right' });
    const renameBtn = page.getByTestId('context-menu-rename');
    await expect(renameBtn).not.toBeAttached({ timeout: 3_000 });
    await page.keyboard.press('Escape');
  });

  // ── 2. File rename ──

  test('rename note.md to paper (preserves extension)', async () => {
    await rightClickFile('research.md');
    await clickMenuRename();
    await confirmRename('paper');
    await page.waitForTimeout(500);
    const renamedNode = page.locator('[data-testid="file-node-paper.md"]');
    await expect(renamedNode).toBeVisible({ timeout: 3_000 });

    // Rename back
    await rightClickFile('paper.md');
    await clickMenuRename();
    await confirmRename('research');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="file-node-research.md"]')).toBeVisible({ timeout: 3_000 });
  });

  test('rename note.md to paper.md (explicit extension)', async () => {
    await rightClickFile('research.md');
    await clickMenuRename();
    await confirmRename('paper.md');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="file-node-paper.md"]')).toBeVisible({ timeout: 3_000 });

    // Rename back
    await rightClickFile('paper.md');
    await clickMenuRename();
    await confirmRename('research');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="file-node-research.md"]')).toBeVisible({ timeout: 3_000 });
  });

  test('rename with empty name shows error', async () => {
    await rightClickFile('research.md');
    await clickMenuRename();
    await confirmRename('');
    const error = page.getByTestId('rename-dialog-error');
    await expect(error).toBeVisible();
    await cancelRename();
  });

  test('rename to existing file name shows error', async () => {
    await rightClickFile('research.md');
    await clickMenuRename();
    await confirmRename('index');
    const error = page.getByTestId('rename-dialog-error');
    await expect(error).toBeVisible({ timeout: 3_000 });
    await cancelRename();
  });

  test('rename file with ../ in name shows error', async () => {
    await rightClickFile('research.md');
    await clickMenuRename();
    await confirmRename('../escape');
    const error = page.getByTestId('rename-dialog-error');
    await expect(error).toBeVisible({ timeout: 3_000 });
    await cancelRename();
  });

  // ── 3. Open file state sync ──

  test('renamed open file updates tabs and editor', async () => {
    const researchNode = page.locator('[data-testid="file-node-research.md"]');
    await researchNode.click();
    await page.waitForTimeout(500);

    await expect(page.locator('.cm-content')).toBeVisible({ timeout: 3_000 });

    await rightClickFile('research.md');
    await clickMenuRename();
    await confirmRename('study');
    await page.waitForTimeout(800);

    const tab = page.locator('[data-testid="tab-study.md"]');
    await expect(tab).toBeVisible({ timeout: 3_000 });

    await expect(page.locator('.cm-content')).toBeVisible({ timeout: 3_000 });

    // Rename back
    await rightClickFile('study.md');
    await clickMenuRename();
    await confirmRename('research');
    await page.waitForTimeout(500);
  });

  // ── 4. Folder rename ──

  test('rename folder updates child file paths in tree', async () => {
    await rightClickFolder('assets');
    await clickMenuRename();
    await confirmRename('assets2');
    await page.waitForTimeout(500);

    // Old folder should be gone
    await expect(page.locator('[data-testid="folder-node-assets"]')).not.toBeAttached({ timeout: 2_000 });
    // New folder should exist
    await expect(page.locator('[data-testid="folder-node-assets2"]')).toBeVisible({ timeout: 3_000 });

    // Rename back
    await rightClickFolder('assets2');
    await clickMenuRename();
    await confirmRename('assets');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="folder-node-assets"]')).toBeVisible({ timeout: 3_000 });
  });

  test('rename folder with empty name shows error', async () => {
    await rightClickFolder('assets');
    await clickMenuRename();
    await confirmRename('');
    const error = page.getByTestId('rename-dialog-error');
    await expect(error).toBeVisible();
    await cancelRename();
  });

  // ── 5. Create/Cancel flow still works ──

  test('create file still works after rename', async () => {
    await rightClickFile('research.md');
    const createBtn = page.getByTestId('context-menu-create-file');
    await expect(createBtn).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('backlinks still work after rename', async () => {
    const researchNode = page.locator('[data-testid="file-node-research.md"]');
    await researchNode.click();
    await page.waitForTimeout(500);

    const backlinksPanel = page.locator('[data-testid="backlinks-panel"]');
    await expect(backlinksPanel).toBeVisible({ timeout: 5_000 });
  });

  // ── 6. No regression on existing features ──

  test('backlinks panel is visible after rename operations', async () => {
    await page.waitForTimeout(500);

    // Backlinks panel should be visible (research.md links to README.md)
    const backlinksPanel = page.locator('[data-testid="backlinks-panel"]');
    await expect(backlinksPanel).toBeVisible({ timeout: 5_000 });
  });

  test('search is still accessible', async () => {
    // Open search with Ctrl+K
    await page.keyboard.press('Control+k');
    const searchInput = page.getByTestId('search-input');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
  });

  test('preview still works', async () => {
    // Click a file
    const researchNode = page.locator('[data-testid="file-node-research.md"]');
    await researchNode.click();
    await page.waitForTimeout(500);

    // Preview should appear
    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 3_000 });
  });
});
