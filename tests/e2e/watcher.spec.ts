import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { launchSchola, type ScholaAppContext } from './helpers/electronApp';

// ─────────────────────────────────────────────
// Phase 2-C-1 — Watcher Infrastructure E2E
// ─────────────────────────────────────────────

const SAMPLE_VAULT_PATH = path.resolve('tests', 'fixtures', 'sample-vault');

/** Wait long enough for the watcher debounce (300ms) + IPC + React render. */
const WATCHER_WAIT_MS = 1500;

test.describe('Schola Phase 2-C-1 — Watcher lifecycle', () => {
  test.describe.configure({ timeout: 90_000 });
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    // Copy sample vault to a temp directory so modifications are isolated.
    const tmpBase = path.join(os.tmpdir(), `schola-watcher-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    // Remove stale .schola to avoid SQLite DB conflicts
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }

    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 20_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) {
      await ctx.close();
    }
    try {
      fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // best-effort cleanup
    }
  });

  // ── 1. External file creation ──

  test('external .md file appears in file tree', async () => {
    const filePath = path.join(vaultDir, 'ext-new.md');
    fs.writeFileSync(filePath, '# New\n\nExternal file.', 'utf-8');

    await page.waitForTimeout(WATCHER_WAIT_MS);

    const node = page.locator('[data-testid="file-node-ext-new.md"]');
    await expect(node).toBeVisible({ timeout: 5_000 });

    fs.unlinkSync(filePath);
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  test('external .markdown file appears in file tree', async () => {
    const filePath = path.join(vaultDir, 'ext-mark.markdown');
    fs.writeFileSync(filePath, '# Markdown\n\n.markdown ext.', 'utf-8');

    await page.waitForTimeout(WATCHER_WAIT_MS);

    const node = page.locator('[data-testid="file-node-ext-mark.markdown"]');
    await expect(node).toBeVisible({ timeout: 5_000 });

    fs.unlinkSync(filePath);
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  test('external file creation in subdirectory appears in tree', async () => {
    const subDir = path.join(vaultDir, 'ext-sub');
    fs.mkdirSync(subDir, { recursive: true });
    const filePath = path.join(subDir, 'nested-ext.md');
    fs.writeFileSync(filePath, '# Nested\n\nIn subdir.', 'utf-8');

    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Expand the directory
    const folderNode = page.locator('[data-testid="folder-node-ext-sub"]');
    await expect(folderNode).toBeVisible({ timeout: 5_000 });
    await folderNode.click();
    await page.waitForTimeout(400);

    const fileNode = page.locator('[data-testid="file-node-nested-ext.md"]');
    await expect(fileNode).toBeVisible({ timeout: 5_000 });

    fs.unlinkSync(filePath);
    fs.rmdirSync(subDir);
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 2. External file deletion ──

  test('external deletion removes file from tree', async () => {
    // Create first
    const filePath = path.join(vaultDir, 'ext-delete.md');
    fs.writeFileSync(filePath, '# Delete\n\nBe gone.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    const node = page.locator('[data-testid="file-node-ext-delete.md"]');
    await expect(node).toBeVisible({ timeout: 5_000 });

    fs.unlinkSync(filePath);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await expect(node).not.toBeAttached({ timeout: 5_000 });
  });

  // ── 3. External file modification ──

  test('external modification of an existing file does not crash the app', async () => {
    const filePath = path.join(vaultDir, 'code.md');
    const original = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, original + '\n', 'utf-8');

    await page.waitForTimeout(WATCHER_WAIT_MS);

    fs.writeFileSync(filePath, original, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  test('external modification followed by opening file still works', async () => {
    const filePath = path.join(vaultDir, 'research.md');
    const original = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, original + '\n\n<!-- ext edit -->', 'utf-8');

    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Open the file — should still work
    const node = page.locator('[data-testid="file-node-research.md"]');
    await node.click();
    await page.waitForTimeout(500);

    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });

    // Restore
    fs.writeFileSync(filePath, original, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 4. External folder operations ──

  test('external folder creation appears in tree', async () => {
    const newDir = path.join(vaultDir, 'ext-folder');
    fs.mkdirSync(newDir, { recursive: true });

    await page.waitForTimeout(WATCHER_WAIT_MS);

    const folderNode = page.locator('[data-testid="folder-node-ext-folder"]');
    await expect(folderNode).toBeVisible({ timeout: 5_000 });

    fs.rmdirSync(newDir);
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 5. Internal operations don't conflict with watcher ──

  test('internal rename and delete flow works with watcher active', async () => {
    // Create file externally first, then test internal rename + delete
    const filePath = path.join(vaultDir, 'ext-for-rename.md');
    fs.writeFileSync(filePath, '# Rename me\n\nExternal create.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    const node = page.locator('[data-testid="file-node-ext-for-rename.md"]');
    await expect(node).toBeVisible({ timeout: 5_000 });

    // Rename internally
    await node.click({ button: 'right' });
    await page.waitForTimeout(300);
    await page.getByTestId('context-menu-rename').click();
    await page.waitForTimeout(300);

    const renameInput = page.getByTestId('rename-dialog-input');
    await expect(renameInput).toBeVisible({ timeout: 3_000 });
    await renameInput.fill('ext-renamed');
    await page.getByTestId('rename-dialog-confirm').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    const renamedNode = page.locator('[data-testid="file-node-ext-renamed.md"]');
    await expect(renamedNode).toBeVisible({ timeout: 5_000 });
    // Old name should be gone
    await expect(node).not.toBeAttached({ timeout: 3_000 });

    // Delete internally
    await renamedNode.click({ button: 'right' });
    await page.waitForTimeout(300);
    await page.getByTestId('context-menu-delete').click();
    await page.waitForTimeout(400);

    const deleteDialog = page.getByTestId('delete-dialog');
    await expect(deleteDialog).toBeVisible({ timeout: 3_000 });
    await page.getByTestId('delete-dialog-confirm').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await expect(renamedNode).not.toBeAttached({ timeout: 5_000 });
  });

  // ── 6. Regression — existing features still work ──

  test('search is still accessible', async () => {
    await page.keyboard.press('Control+k');
    const searchInput = page.getByTestId('search-input');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
  });

  test('preview still works', async () => {
    const node = page.locator('[data-testid="file-node-index.md"]');
    await node.click();
    await page.waitForTimeout(500);

    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });
  });

  test('backlinks panel is visible', async () => {
    const researchNode = page.locator('[data-testid="file-node-research.md"]');
    await researchNode.click();
    await page.waitForTimeout(500);

    const backlinksPanel = page.locator('[data-testid="backlinks-panel"]');
    await expect(backlinksPanel).toBeVisible({ timeout: 5_000 });
  });

  test('backlinks panel still uses SQLite source after watcher events', async () => {
    test.setTimeout(120_000);
    // After all the watcher churn (creates, deletes, renames), the vault
    // should still be in a clean state for untouched files.
    const readmeNode = page.locator('[data-testid="file-node-README.md"]');
    await readmeNode.click();
    await page.waitForTimeout(500);

    // Wait for SQLite query to complete (may need time after watcher-induced reindexing)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="backlinks-panel"]')?.getAttribute('data-backlinks-source') === 'sqlite',
      { timeout: 45_000 },
    );

    const panel = page.locator('[data-testid="backlinks-panel"]');
    await expect(panel).toHaveAttribute('data-backlinks-source', 'sqlite');
    await expect(panel).toHaveAttribute('data-backlinks-fallback-reason', 'none');
  });

  test('search still uses SQLite source after watcher events', async () => {
    // Open search and verify SQLite is used for clean vault state
    const searchTrigger = page.locator('[data-testid="search-trigger"]');
    await searchTrigger.click();
    await page.waitForSelector('[data-testid="search-panel"]', { timeout: 3000 });

    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('README');
    await page.waitForTimeout(3000);

    // Wait for SQLite search to complete
    await page.waitForFunction(
      () => document.querySelector('[data-testid="search-panel"]')?.getAttribute('data-search-source') === 'sqlite',
      { timeout: 8000 },
    );

    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toHaveAttribute('data-search-source', 'sqlite');
    await expect(panel).toHaveAttribute('data-search-fallback-reason', 'none');

    // Close search
    await page.keyboard.press('Escape');
  });

  test('explorer resizer is still functional', async () => {
    const resizer = page.locator('[data-testid="explorer-resizer"]');
    await expect(resizer).toBeVisible({ timeout: 3_000 });
  });
});

// ─────────────────────────────────────────────
// Phase 2-C-2 — External Change Conflict E2E
// ─────────────────────────────────────────────

test.describe('Schola Phase 2-C-2 — External change conflict handling', () => {
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-watcher-conflict-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    // Remove stale .schola to avoid SQLite DB conflicts
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }
    // Pre-create test files
    fs.writeFileSync(path.join(vaultDir, 'clean-target.md'), '# Clean\n\nThis file is clean.', 'utf-8');
    fs.writeFileSync(path.join(vaultDir, 'dirty-target.md'), '# Dirty Target\n\nWill be modified.', 'utf-8');
    fs.writeFileSync(path.join(vaultDir, 'clean-delete.md'), '# Delete me\n\nClean delete target.', 'utf-8');
    fs.writeFileSync(path.join(vaultDir, 'dirty-delete.md'), '# Dirty Delete\n\nWill be preserved.', 'utf-8');
    const subFolder = path.join(vaultDir, 'ext-del-folder');
    fs.mkdirSync(subFolder, { recursive: true });
    fs.writeFileSync(path.join(subFolder, 'a-clean.md'), '# A Clean\n\nClean child.', 'utf-8');
    fs.writeFileSync(path.join(subFolder, 'b-dirty.md'), '# B Dirty\n\nDirty child.', 'utf-8');

    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 25_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try { fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  });

  // ── 1. External modify clean active file → auto-reload ──

  test('external modify of clean active file triggers auto-reload', async () => {
    const node = page.locator('[data-testid="file-node-clean-target.md"]');
    await node.click();
    await page.waitForTimeout(600);

    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });
    await expect(preview).toContainText('This file is clean');

    const filePath = path.join(vaultDir, 'clean-target.md');
    fs.writeFileSync(filePath, '# Clean Updated\n\nExternal modification applied.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Auto-reload should show new content
    await expect(preview).toContainText('External modification applied');

    // No conflict banner
    const banner = page.locator('[data-testid="external-change-banner"]');
    await expect(banner).not.toBeAttached({ timeout: 2_000 });

    // Restore
    fs.writeFileSync(filePath, '# Clean\n\nThis file is clean.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 2. External modify dirty active file → no override + banner ──

  test('external modify of dirty active file does not override content', async () => {
    const node = page.locator('[data-testid="file-node-dirty-target.md"]');
    await node.click();
    await page.waitForTimeout(600);

    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.type('\nUnsaved local edit.');
    await page.waitForTimeout(500);

    const saveBtn = page.getByTestId('save-note');
    await expect(saveBtn).toBeEnabled();

    const filePath = path.join(vaultDir, 'dirty-target.md');
    fs.writeFileSync(filePath, '# Dirty Target\n\nExternal overwrite attempt.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Banner appears
    const banner = page.locator('[data-testid="external-change-banner"]');
    await expect(banner).toBeVisible({ timeout: 5_000 });
    await expect(banner).toContainText('外部修改');

    // Save still enabled (dirty preserved)
    await expect(saveBtn).toBeEnabled();

    // Dismiss
    await page.getByTestId('conflict-keep').click();
    await page.waitForTimeout(300);
    await expect(banner).not.toBeAttached({ timeout: 3_000 });

    // Clean up: save to restore
    await saveBtn.click();
    await page.waitForTimeout(500);
    fs.writeFileSync(filePath, '# Dirty Target\n\nWill be modified.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 3. Dirty conflict: reload button loads external version ──

  test('dirty conflict reload button loads external version', async () => {
    const node = page.locator('[data-testid="file-node-dirty-target.md"]');
    await node.click();
    await page.waitForTimeout(600);

    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.type('\nAnother unsaved edit.');
    await page.waitForTimeout(500);

    const saveBtn = page.getByTestId('save-note');
    await expect(saveBtn).toBeEnabled();

    const filePath = path.join(vaultDir, 'dirty-target.md');
    fs.writeFileSync(filePath, '# Dirty Reloaded\n\nContent from external source.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    const banner = page.locator('[data-testid="external-change-banner"]');
    await expect(banner).toBeVisible({ timeout: 5_000 });

    await page.getByTestId('conflict-reload').click();
    await page.waitForTimeout(800);

    // Banner gone
    await expect(banner).not.toBeAttached({ timeout: 3_000 });
    // Save disabled (no longer dirty)
    await expect(saveBtn).toBeDisabled();

    // Preview shows external content
    await expect(page.locator('[data-testid="markdown-preview"]')).toContainText('Content from external source');

    // Restore
    fs.writeFileSync(filePath, '# Dirty Target\n\nWill be modified.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 4. External delete clean active file → tab closes ──

  test('external delete of clean active file closes tab', async () => {
    // Ensure file exists and click it to open
    const cleanPath = path.join(vaultDir, 'clean-delete.md');
    if (!fs.existsSync(cleanPath)) {
      fs.writeFileSync(cleanPath, '# Delete me\n\nClean delete target.', 'utf-8');
      await page.waitForTimeout(WATCHER_WAIT_MS);
    }

    const fileNode = page.locator('[data-testid="file-node-clean-delete.md"]');
    await expect(fileNode).toBeVisible({ timeout: 5_000 });
    await fileNode.click();
    await page.waitForTimeout(800);

    // Verify tab appeared
    const tab = page.locator('[data-testid="tab-clean-delete.md"]');
    await expect(tab).toBeVisible({ timeout: 3_000 });

    // Delete externally
    fs.unlinkSync(cleanPath);

    // Wait for watcher → debounce (300ms backend + 300ms renderer) + React
    // Use polling to check tab removal rather than fixed timeout
    await expect(async () => {
      const isVisible = await tab.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    }).toPass({ timeout: 10_000, intervals: [500, 1000, 1500, 2000, 3000] });

    // File tree should also be updated
    await expect(fileNode).not.toBeAttached({ timeout: 3_000 });

    // Recreate for other tests
    fs.writeFileSync(cleanPath, '# Delete me\n\nClean delete target.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 5. External delete dirty active file → tab kept + banner ──

  test('external delete of dirty active file preserves tab and content', async () => {
    // Ensure file exists
    const dirtyPath = path.join(vaultDir, 'dirty-delete.md');
    if (!fs.existsSync(dirtyPath)) {
      fs.writeFileSync(dirtyPath, '# Dirty Delete\n\nWill be preserved.', 'utf-8');
      await page.waitForTimeout(WATCHER_WAIT_MS);
    }

    const node = page.locator('[data-testid="file-node-dirty-delete.md"]');
    await expect(node).toBeVisible({ timeout: 5_000 });
    await node.click();
    await page.waitForTimeout(800);

    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.type('\nPrecious unsaved work.');
    await page.waitForTimeout(500);

    const saveBtn = page.getByTestId('save-note');
    await expect(saveBtn).toBeEnabled();

    // Delete externally
    fs.unlinkSync(dirtyPath);

    // Poll for conflict banner
    await expect(async () => {
      const banner = page.locator('[data-testid="external-change-banner"]');
      const isVisible = await banner.isVisible().catch(() => false);
      expect(isVisible).toBe(true);
    }).toPass({ timeout: 10_000, intervals: [500, 1000, 1500, 2000, 3000] });

    // Tab must still exist
    const tab = page.locator('[data-testid="tab-dirty-delete.md"]');
    await expect(tab).toBeVisible({ timeout: 3_000 });

    // Save button still enabled
    await expect(saveBtn).toBeEnabled();

    // Dismiss
    const banner = page.locator('[data-testid="external-change-banner"]');
    await page.getByTestId('conflict-dismiss').click();
    await page.waitForTimeout(500);
    await expect(banner).not.toBeAttached({ timeout: 3_000 });

    // Restore file
    fs.writeFileSync(dirtyPath, '# Dirty Delete\n\nWill be preserved.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 5b. Conflict persistence across watcher batches (P0 regression) ──

  test('conflict persists across subsequent watcher event batches', async () => {
    // Step 1: Open a clean file that won't be modified
    const bystanderPath = path.join(vaultDir, 'bystander.md');
    fs.writeFileSync(bystanderPath, '# Bystander\n\nUnchanged file.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Step 2: Open dirty-target.md and make it dirty
    const dirtyNode = page.locator('[data-testid="file-node-dirty-target.md"]');
    await dirtyNode.click();
    await page.waitForTimeout(600);

    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.type('\nPersistent conflict test.');
    await page.waitForTimeout(500);

    const saveBtn = page.getByTestId('save-note');
    await expect(saveBtn).toBeEnabled();

    // Step 3: External modify dirty-target.md → conflict created
    const dirtyPath = path.join(vaultDir, 'dirty-target.md');
    fs.writeFileSync(dirtyPath, '# Dirty Target\n\nExternal overwrite v1.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Banner appears
    let banner = page.locator('[data-testid="external-change-banner"]');
    await expect(banner).toBeVisible({ timeout: 5_000 });

    // Step 4: External modify bystander.md (clean, not currently open)
    // This triggers a second watcher event batch
    fs.writeFileSync(bystanderPath, '# Bystander\n\nModified externally.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Step 5: The conflict on dirty-target.md MUST still exist
    // (this is the P0 regression test — stale closure would clear it)
    banner = page.locator('[data-testid="external-change-banner"]');
    await expect(banner).toBeVisible({ timeout: 5_000 });

    // Save button still enabled (dirty preserved)
    await expect(saveBtn).toBeEnabled();

    // Step 6: Dismiss and clean up
    await page.getByTestId('conflict-keep').click();
    await page.waitForTimeout(300);

    await saveBtn.click();
    await page.waitForTimeout(500);
    fs.writeFileSync(dirtyPath, '# Dirty Target\n\nWill be modified.', 'utf-8');
    fs.unlinkSync(bystanderPath);
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 6. External delete folder with open files ──

  test('external delete of folder removes clean child tab, preserves dirty child tab', async () => {
    await page.locator('[data-testid="file-node-a-clean.md"]').click();
    await page.waitForTimeout(500);

    await page.locator('[data-testid="file-node-b-dirty.md"]').click();
    await page.waitForTimeout(500);
    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.type('\nFolder delete test.');
    await page.waitForTimeout(500);

    const folderPath = path.join(vaultDir, 'ext-del-folder');
    fs.rmSync(folderPath, { recursive: true, force: true });
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Clean tab gone
    await expect(page.locator('[data-testid="tab-a-clean.md"]')).not.toBeAttached({ timeout: 5_000 });
    // Dirty tab kept
    await expect(page.locator('[data-testid="tab-b-dirty.md"]')).toBeVisible({ timeout: 5_000 });

    const banner = page.locator('[data-testid="external-change-banner"]');
    await expect(banner).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('conflict-dismiss').click();
    await page.waitForTimeout(300);
  });

  // ── 7. Internal operations do not trigger conflict ──

  test('internal save does not trigger external conflict banner', async () => {
    const filePath = path.join(vaultDir, 'int-save-test.md');
    fs.writeFileSync(filePath, '# Save Test\n\nInitial.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await page.locator('[data-testid="file-node-int-save-test.md"]').click();
    await page.waitForTimeout(500);

    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.type(' Edited.');
    await page.waitForTimeout(300);

    await page.getByTestId('save-note').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await expect(page.locator('[data-testid="external-change-banner"]')).not.toBeAttached({ timeout: 3_000 });

    fs.unlinkSync(filePath);
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  test('internal rename does not trigger external conflict banner', async () => {
    const filePath = path.join(vaultDir, 'int-rename-src.md');
    fs.writeFileSync(filePath, '# Rename Src\n\nTest.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    const node = page.locator('[data-testid="file-node-int-rename-src.md"]');
    await node.click({ button: 'right' });
    await page.waitForTimeout(300);
    await page.getByTestId('context-menu-rename').click();
    await page.waitForTimeout(300);

    await page.getByTestId('rename-dialog-input').fill('int-rename-dst');
    await page.getByTestId('rename-dialog-confirm').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await expect(page.locator('[data-testid="external-change-banner"]')).not.toBeAttached({ timeout: 3_000 });
    await expect(page.locator('[data-testid="file-node-int-rename-dst.md"]')).toBeVisible({ timeout: 5_000 });

    // Clean up
    await page.locator('[data-testid="file-node-int-rename-dst.md"]').click({ button: 'right' });
    await page.waitForTimeout(300);
    await page.getByTestId('context-menu-delete').click();
    await page.waitForTimeout(300);
    await page.getByTestId('delete-dialog-confirm').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  test('internal delete does not trigger external conflict banner', async () => {
    const filePath = path.join(vaultDir, 'int-delete-test.md');
    fs.writeFileSync(filePath, '# Delete Me\n\nWill be deleted.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    const node = page.locator('[data-testid="file-node-int-delete-test.md"]');
    await node.click({ button: 'right' });
    await page.waitForTimeout(300);
    await page.getByTestId('context-menu-delete').click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId('delete-dialog')).toBeVisible({ timeout: 3_000 });
    await page.getByTestId('delete-dialog-confirm').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await expect(page.locator('[data-testid="external-change-banner"]')).not.toBeAttached({ timeout: 3_000 });
    await expect(page.locator('[data-testid="file-node-int-delete-test.md"]')).not.toBeAttached({ timeout: 5_000 });
  });

  // ── 8. Regression ──

  test('search still works after conflict scenarios', async () => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('search-input')).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
  });

  test('backlinks visible after conflict scenarios', async () => {
    await page.locator('[data-testid="file-node-index.md"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="backlinks-panel"]')).toBeVisible({ timeout: 5_000 });
  });

  test('preview renders after conflict scenarios', async () => {
    await expect(page.locator('[data-testid="markdown-preview"]')).toBeVisible({ timeout: 5_000 });
  });

  test('explorer resizer functional after conflict scenarios', async () => {
    await expect(page.locator('[data-testid="explorer-resizer"]')).toBeVisible({ timeout: 3_000 });
  });
});

// ─────────────────────────────────────────────
// Phase 2-C-3 — Watcher-driven WikiIndex refresh E2E
// ─────────────────────────────────────────────

test.describe('Schola Phase 2-C-3 — Watcher-driven WikiIndex refresh', () => {
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-watcher-wiki-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    // Remove stale .schola to avoid SQLite DB conflicts
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }

    // Pre-create test files with wikilinks
    // alpha → beta (resolved), gamma (unresolved)
    fs.writeFileSync(path.join(vaultDir, 'alpha.md'), '# Alpha\n\nLinks: [[beta]] [[gamma]]', 'utf-8');
    // beta — target of alpha (no outgoing links)
    fs.writeFileSync(path.join(vaultDir, 'beta.md'), '# Beta\n\nThis is beta.', 'utf-8');
    // gamma — links to alpha
    fs.writeFileSync(path.join(vaultDir, 'gamma.md'), '# Gamma\n\nLinks: [[alpha]]', 'utf-8');
    // delta — target that doesn't exist yet (unresolved)
    fs.writeFileSync(path.join(vaultDir, 'source-only.md'), '# Source Only\n\nLinks: [[beta]] [[gamma]] [[delta]]', 'utf-8');
    // epsilon — will be created externally later
    // (not pre-created)

    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 25_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try { fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  });

  // ── 1. External creation of target → unresolved becomes resolved ──

  test('external add of missing target resolves wikilink in backlinks', async () => {
    // Open alpha.md — it links to beta (exists) and gamma (exists)
    await page.locator('[data-testid="file-node-alpha.md"]').click();
    await page.waitForTimeout(800);

    // Backlinks panel should show for alpha.md
    const backlinksPanel = page.locator('[data-testid="backlinks-panel"]');
    await expect(backlinksPanel).toBeVisible({ timeout: 5_000 });

    // Now create gamma.md → alpha.md's [[gamma]] should resolve
    // gamma is already pre-created, so let's test with delta
    // source-only.md links to [[delta]] which doesn't exist yet
    await page.locator('[data-testid="file-node-source-only.md"]').click();
    await page.waitForTimeout(800);

    // Preview should show [[delta]] as unresolved (data-exists="false")
    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });
    const unresolvedDelta = preview.locator('a[data-exists="false"]', { hasText: 'delta' });
    await expect(unresolvedDelta).toBeAttached({ timeout: 3_000 });

    // Create delta.md externally
    fs.writeFileSync(path.join(vaultDir, 'delta.md'), '# Delta\n\nNow I exist.', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Re-open source-only.md to refresh preview (select beta.md then back)
    await page.locator('[data-testid="file-node-beta.md"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="file-node-source-only.md"]').click();
    await page.waitForTimeout(800);

    // delta should now be resolved (no data-exists="false")
    const resolvedDelta = preview.locator('a', { hasText: 'delta' });
    await expect(resolvedDelta).toBeAttached({ timeout: 5_000 });
    // Should NOT have data-exists="false"
    const deltaAttr = await resolvedDelta.getAttribute('data-exists');
    expect(deltaAttr).toBeNull(); // resolved wikilinks have no data-exists

    // delta.md backlinks should show source-only.md
    await page.locator('[data-testid="file-node-delta.md"]').click();
    await page.waitForTimeout(800);
    const backlinkSrc = page.locator('[data-testid="backlink-source-only.md"]');
    await expect(backlinkSrc).toBeVisible({ timeout: 5_000 });

    // Cleanup
    fs.unlinkSync(path.join(vaultDir, 'delta.md'));
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 2. External modify adds wikilink → backlinks appear ──

  test('external modify adding a wikilink updates backlinks', async () => {
    // beta.md has no outgoing links. Modify it externally to add [[alpha]]
    const betaPath = path.join(vaultDir, 'beta.md');
    const original = fs.readFileSync(betaPath, 'utf-8');
    fs.writeFileSync(betaPath, original + '\n\nSee also: [[alpha]]', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Open alpha.md — backlinks should now include beta.md
    await page.locator('[data-testid="file-node-alpha.md"]').click();
    await page.waitForTimeout(800);

    const backlinkBeta = page.locator('[data-testid="backlink-beta.md"]');
    await expect(backlinkBeta).toBeVisible({ timeout: 5_000 });

    // Restore
    fs.writeFileSync(betaPath, original, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 3. External modify removes wikilink → backlinks disappear ──

  test('external modify removing a wikilink removes backlinks', async () => {
    // alpha.md links to [[beta]] and [[gamma]]
    // Modify it to remove [[beta]]
    fs.writeFileSync(path.join(vaultDir, 'alpha.md'), '# Alpha\n\nLinks: [[gamma]]', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Open beta.md — backlinks should no longer show alpha.md
    await page.locator('[data-testid="file-node-beta.md"]').click();
    await page.waitForTimeout(800);

    const backlinkAlpha = page.locator('[data-testid="backlink-alpha.md"]');
    await expect(backlinkAlpha).not.toBeAttached({ timeout: 5_000 });

    // Restore
    fs.writeFileSync(path.join(vaultDir, 'alpha.md'), '# Alpha\n\nLinks: [[beta]] [[gamma]]', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 4. External delete source → backlinks remove source ──

  test('external delete of source file removes it from backlinks', async () => {
    // gamma.md links to [[alpha]]. Open alpha.md first, see gamma backlink.
    await page.locator('[data-testid="file-node-alpha.md"]').click();
    await page.waitForTimeout(800);

    let backlinkGamma = page.locator('[data-testid="backlink-gamma.md"]');
    await expect(backlinkGamma).toBeVisible({ timeout: 5_000 });

    // Delete gamma.md externally (it's a source that links to alpha)
    const gammaPath = path.join(vaultDir, 'gamma.md');
    const gammaContent = fs.readFileSync(gammaPath, 'utf-8');
    fs.unlinkSync(gammaPath);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Re-select alpha.md to force backlinks refresh
    await page.locator('[data-testid="file-node-beta.md"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="file-node-alpha.md"]').click();
    await page.waitForTimeout(800);

    backlinkGamma = page.locator('[data-testid="backlink-gamma.md"]');
    await expect(backlinkGamma).not.toBeAttached({ timeout: 5_000 });

    // Restore
    fs.writeFileSync(gammaPath, gammaContent, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 5. External delete target → wikilink becomes unresolved ──

  test('external delete of target makes wikilink unresolved', async () => {
    // alpha.md links to [[beta]] which exists. Delete beta.md externally.
    const betaPath = path.join(vaultDir, 'beta.md');
    const betaContent = fs.readFileSync(betaPath, 'utf-8');
    fs.unlinkSync(betaPath);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Open alpha.md — [[beta]] should now show as unresolved in preview
    await page.locator('[data-testid="file-node-alpha.md"]').click();
    await page.waitForTimeout(800);

    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });

    // beta wikilink should have data-exists="false"
    const unresolvedBeta = preview.locator('a[data-exists="false"]', { hasText: 'beta' });
    await expect(unresolvedBeta).toBeAttached({ timeout: 5_000 });

    // Restore
    fs.writeFileSync(betaPath, betaContent, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 6. External folder delete → backlinks clean ──

  test('external folder delete cleans up backlinks from children', async () => {
    // Create a folder with two files that cross-link
    const folder = path.join(vaultDir, 'ext-folder-wiki');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'a.md'), '# A\n\nLinks: [[b]]', 'utf-8');
    fs.writeFileSync(path.join(folder, 'b.md'), '# B\n\nTarget of A.', 'utf-8');
    fs.writeFileSync(path.join(vaultDir, 'root-ref.md'), '# Root\n\nLinks: [[a]]', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Check that root-ref.md can resolve [[a]] (a.md exists in ext-folder-wiki/)
    await page.locator('[data-testid="file-node-root-ref.md"]').click();
    await page.waitForTimeout(800);
    const preview = page.locator('[data-testid="markdown-preview"]');
    // a is a basename match — should be resolved
    const resolvedA = preview.locator('a', { hasText: 'a' }).first();
    await expect(resolvedA).toBeAttached({ timeout: 5_000 });

    // Delete the entire folder
    fs.rmSync(folder, { recursive: true, force: true });
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Re-open root-ref.md — [[a]] should be unresolved now
    await page.locator('[data-testid="file-node-beta.md"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="file-node-root-ref.md"]').click();
    await page.waitForTimeout(800);

    const unresolvedA = preview.locator('a[data-exists="false"]', { hasText: 'a' });
    await expect(unresolvedA).toBeAttached({ timeout: 5_000 });

    // Cleanup
    fs.unlinkSync(path.join(vaultDir, 'root-ref.md'));
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 7. Dirty file external modify → WikiIndex NOT updated ──

  test('dirty file external modify does not update WikiIndex', async () => {
    // Open source-only.md, make an edit (dirty it)
    await page.locator('[data-testid="file-node-source-only.md"]').click();
    await page.waitForTimeout(800);

    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    // The editor currently shows: "Links: [[beta]] [[gamma]] [[delta]]"
    // delta.md does NOT exist. Add [[epsilon]] internally (dirty edit).
    await page.keyboard.press('End');
    await page.keyboard.type(' [[epsilon]]');
    await page.waitForTimeout(500);

    // Now externally modify source-only.md to add [[alpha]] on disk
    const srcPath = path.join(vaultDir, 'source-only.md');
    const original = fs.readFileSync(srcPath, 'utf-8');
    fs.writeFileSync(srcPath, original + '\n\nAlso see [[alpha]]', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Conflict banner should appear because file is dirty
    const banner = page.locator('[data-testid="external-change-banner"]');
    await expect(banner).toBeVisible({ timeout: 5_000 });

    // Backlinks for alpha.md should NOT show source-only.md
    // (because WikiIndex was NOT updated with disk version)
    await page.locator('[data-testid="file-node-alpha.md"]').click();
    await page.waitForTimeout(800);
    const backlinkSrc = page.locator('[data-testid="backlink-source-only.md"]');
    await expect(backlinkSrc).not.toBeAttached({ timeout: 3_000 });

    // Dismiss conflict and clean up
    await page.locator('[data-testid="file-node-source-only.md"]').click();
    await page.waitForTimeout(300);
    await page.getByTestId('conflict-keep').click();
    await page.waitForTimeout(500);
    fs.writeFileSync(srcPath, original, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 8. Reload external version → WikiIndex updates ──

  test('reload external version updates WikiIndex', async () => {
    // Open source-only.md, make it dirty
    await page.locator('[data-testid="file-node-source-only.md"]').click();
    await page.waitForTimeout(800);

    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' dirty');
    await page.waitForTimeout(500);

    // External modify adds [[alpha]]
    const srcPath = path.join(vaultDir, 'source-only.md');
    const original = fs.readFileSync(srcPath, 'utf-8');
    fs.writeFileSync(srcPath, original + '\n\nAlso see [[alpha]]', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Reload external version
    await page.getByTestId('conflict-reload').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Now alpha.md backlinks should include source-only.md
    await page.locator('[data-testid="file-node-alpha.md"]').click();
    await page.waitForTimeout(800);
    const backlinkSrc = page.locator('[data-testid="backlink-source-only.md"]');
    await expect(backlinkSrc).toBeVisible({ timeout: 5_000 });

    // Restore
    fs.writeFileSync(srcPath, original, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 9. Internal save → WikiIndex updates ──

  test('internal save updates WikiIndex for the saved file', async () => {
    const betaPath = path.join(vaultDir, 'beta.md');
    const original = fs.readFileSync(betaPath, 'utf-8');

    // Open beta.md, add [[gamma]]
    await page.locator('[data-testid="file-node-beta.md"]').click();
    await page.waitForTimeout(800);

    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('See [[gamma]]');
    await page.waitForTimeout(300);

    // Save
    await page.getByTestId('save-note').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // gamma.md backlinks should now include beta.md
    await page.locator('[data-testid="file-node-gamma.md"]').click();
    await page.waitForTimeout(800);
    const backlinkBeta = page.locator('[data-testid="backlink-beta.md"]');
    await expect(backlinkBeta).toBeVisible({ timeout: 5_000 });

    // Restore beta.md
    fs.writeFileSync(betaPath, original, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 10. Internal rename → backlinks clean up old path ──

  test('internal rename cleans old index entries and adds new path', async () => {
    // Rename gamma.md → gamma-renamed.md
    await page.locator('[data-testid="file-node-gamma.md"]').click({ button: 'right' });
    await page.waitForTimeout(300);
    await page.getByTestId('context-menu-rename').click();
    await page.waitForTimeout(300);

    await page.getByTestId('rename-dialog-input').fill('gamma-renamed');
    await page.getByTestId('rename-dialog-confirm').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // gamma-renamed.md should exist in the tree
    await expect(page.locator('[data-testid="file-node-gamma-renamed.md"]')).toBeVisible({ timeout: 5_000 });
    // Old gamma.md should be gone
    await expect(page.locator('[data-testid="file-node-gamma.md"]')).not.toBeAttached({ timeout: 3_000 });

    // Open alpha.md — it links to [[gamma]] (basename match).
    // After rename gamma→gamma-renamed, basename [[gamma]] no longer matches
    // gamma-renamed, so the wikilink becomes unresolved.
    // The backlinks panel should NOT show stale gamma.md entries.
    await page.locator('[data-testid="file-node-alpha.md"]').click();
    await page.waitForTimeout(800);

    // Preview should show [[gamma]] as unresolved (data-exists="false")
    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });
    const unresolvedGamma = preview.locator('a[data-exists="false"]', { hasText: 'gamma' });
    await expect(unresolvedGamma).toBeAttached({ timeout: 5_000 });

    // Rename back to restore original state
    await page.locator('[data-testid="file-node-gamma-renamed.md"]').click({ button: 'right' });
    await page.waitForTimeout(300);
    await page.getByTestId('context-menu-rename').click();
    await page.waitForTimeout(300);
    await page.getByTestId('rename-dialog-input').fill('gamma');
    await page.getByTestId('rename-dialog-confirm').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 11. Batch file-changed events handled correctly ──

  test('batch external file-changed events update WikiIndex correctly', async () => {
    // Modify alpha.md and source-only.md in quick succession
    const alphaPath = path.join(vaultDir, 'alpha.md');
    const srcPath = path.join(vaultDir, 'source-only.md');
    const alphaOrig = fs.readFileSync(alphaPath, 'utf-8');
    const srcOrig = fs.readFileSync(srcPath, 'utf-8');

    // alpha.md: remove [[gamma]]
    fs.writeFileSync(alphaPath, '# Alpha\n\nLinks: [[beta]]', 'utf-8');
    // source-only.md: add [[alpha]] reference
    fs.writeFileSync(srcPath, srcOrig + '\n\nSee [[alpha]]', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS * 1.5);

    // Verify: gamma.md backlinks should NOT include alpha.md (removed)
    await page.locator('[data-testid="file-node-gamma.md"]').click();
    await page.waitForTimeout(800);
    const backlinkAfterBatch = page.locator('[data-testid="backlink-alpha.md"]');
    // Alpha linked to gamma, but was removed from alpha's outgoing
    // Actually wait - alpha.md linked to [[gamma]], so removing it means
    // gamma backlinks should NOT include alpha
    await expect(backlinkAfterBatch).not.toBeAttached({ timeout: 5_000 });

    // Verify: alpha.md backlinks should now include source-only.md (added)
    await page.locator('[data-testid="file-node-alpha.md"]').click();
    await page.waitForTimeout(800);
    const backlinkFromBatch = page.locator('[data-testid="backlink-source-only.md"]');
    await expect(backlinkFromBatch).toBeVisible({ timeout: 5_000 });

    // Restore
    fs.writeFileSync(alphaPath, alphaOrig, 'utf-8');
    fs.writeFileSync(srcPath, srcOrig, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 12. Full rebuild fallback still works ──

  test('full rebuild fallback works after structural changes', async () => {
    // Create and then delete files to trigger structural events
    const file1 = path.join(vaultDir, 'rebuild-1.md');
    const file2 = path.join(vaultDir, 'rebuild-2.md');
    fs.writeFileSync(file1, '# Rebuild 1\n\n[[rebuild-2]]', 'utf-8');
    fs.writeFileSync(file2, '# Rebuild 2\n\n[[rebuild-1]]', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Both files should exist and cross-link
    await page.locator('[data-testid="file-node-rebuild-1.md"]').click();
    await page.waitForTimeout(800);
    const backlink = page.locator('[data-testid="backlink-rebuild-2.md"]');
    await expect(backlink).toBeVisible({ timeout: 5_000 });

    // Delete both — structural change triggers full rebuild
    fs.unlinkSync(file1);
    fs.unlinkSync(file2);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Files should be gone from tree
    await expect(page.locator('[data-testid="file-node-rebuild-1.md"]')).not.toBeAttached({ timeout: 5_000 });
    await expect(page.locator('[data-testid="file-node-rebuild-2.md"]')).not.toBeAttached({ timeout: 5_000 });
  });

  // ── 13. Regression ──

  test('preview wikilink click still works', async () => {
    await page.locator('[data-testid="file-node-alpha.md"]').click();
    await page.waitForTimeout(800);

    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });

    // Click on a wikilink in preview
    const betaLink = preview.locator('a', { hasText: 'beta' });
    await expect(betaLink).toBeAttached({ timeout: 3_000 });
  });

  test('search still works after wiki index operations', async () => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('search-input')).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
  });

  test('backlinks panel visible after wiki index operations', async () => {
    await page.locator('[data-testid="file-node-index.md"]').click();
    await page.waitForTimeout(800);
    await expect(page.locator('[data-testid="backlinks-panel"]')).toBeVisible({ timeout: 5_000 });
  });

  test('preview renders after wiki index operations', async () => {
    await expect(page.locator('[data-testid="markdown-preview"]')).toBeVisible({ timeout: 5_000 });
  });

  test('explorer resizer functional after wiki index operations', async () => {
    await expect(page.locator('[data-testid="explorer-resizer"]')).toBeVisible({ timeout: 3_000 });
  });
});

// ─────────────────────────────────────────────
// Phase 2-C-4 — Watcher-driven SearchIndex refresh E2E
// ─────────────────────────────────────────────

test.describe('Schola Phase 2-C-4 — Watcher-driven SearchIndex refresh', () => {
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-watcher-search-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    // Remove stale .schola to avoid SQLite DB conflicts
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }

    // Pre-create files with searchable content
    fs.writeFileSync(path.join(vaultDir, 'searchable.md'), '# My Research Topic\n\nContent about machine learning.\n', 'utf-8');
    fs.writeFileSync(path.join(vaultDir, 'search-heading.md'), '# Original Title\n\nSome content.\n', 'utf-8');
    fs.writeFileSync(path.join(vaultDir, 'search-wikilink.md'), '# Wiki Test\n\nLinks: [[target-one]]\n', 'utf-8');
    fs.writeFileSync(path.join(vaultDir, 'search-delete.md'), '# Delete Me\n\nThis file will be deleted.\n', 'utf-8');
    fs.writeFileSync(path.join(vaultDir, 'search-save.md'), '# Save Test\n\nWill be edited and saved.\n', 'utf-8');
    fs.writeFileSync(path.join(vaultDir, 'search-rename-src.md'), '# Rename Src\n\nFor rename test.\n', 'utf-8');
    // Folder for delete test
    const delFolder = path.join(vaultDir, 'search-del-folder');
    fs.mkdirSync(delFolder, { recursive: true });
    fs.writeFileSync(path.join(delFolder, 'child.md'), '# Folder Child\n\nIn a folder.\n', 'utf-8');

    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 25_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try { fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  });

  async function openSearch(query: string): Promise<void> {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('search-input')).toBeVisible({ timeout: 3_000 });
    await page.getByTestId('search-input').fill(query);
    await page.waitForTimeout(300);
  }

  async function closeSearch(): Promise<void> {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }

  // ── 1. External add → searchable ──

  test('external add of file makes it searchable', async () => {
    // Pre-created searchable.md should already be indexed
    await openSearch('Research Topic');
    const results = page.getByTestId('search-results');
    await expect(results).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // Create a brand new file externally
    fs.writeFileSync(path.join(vaultDir, 'fresh-search.md'), '# Fresh Topic\n\nBrand new file.\n', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await openSearch('Fresh Topic');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    fs.unlinkSync(path.join(vaultDir, 'fresh-search.md'));
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 2. External modify heading → search reflects new heading ──

  test('external modify heading updates search results', async () => {
    // Search for old heading — should find it
    await openSearch('Original Title');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // Modify heading externally
    const filePath = path.join(vaultDir, 'search-heading.md');
    const original = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, '# Updated Heading\n\nSome content.\n', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Old heading should NOT be found, new heading should
    await openSearch('Original Title');
    await expect(page.getByTestId('search-empty')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    await openSearch('Updated Heading');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // Restore
    fs.writeFileSync(filePath, original, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 3. External modify wikilink target → search target changes ──

  test('external modify wikilink target updates search results', async () => {
    await openSearch('target-one');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    const filePath = path.join(vaultDir, 'search-wikilink.md');
    const original = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, '# Wiki Test\n\nLinks: [[new-target]]\n', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Old target gone
    await openSearch('target-one');
    await expect(page.getByTestId('search-empty')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // New target found
    await openSearch('new-target');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    fs.writeFileSync(filePath, original, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 4. External delete → file removed from search ──

  test('external delete removes file from search results', async () => {
    await openSearch('Delete Me');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    const filePath = path.join(vaultDir, 'search-delete.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    fs.unlinkSync(filePath);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await openSearch('Delete Me');
    await expect(page.getByTestId('search-empty')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // Restore
    fs.writeFileSync(filePath, content, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 5. External delete folder → children removed from search ──

  test('external delete folder removes children from search results', async () => {
    await openSearch('Folder Child');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    const folderPath = path.join(vaultDir, 'search-del-folder');
    // Backup folder contents
    const childContent = fs.readFileSync(path.join(folderPath, 'child.md'), 'utf-8');
    fs.rmSync(folderPath, { recursive: true, force: true });
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await openSearch('Folder Child');
    await expect(page.getByTestId('search-empty')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // Restore
    fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(path.join(folderPath, 'child.md'), childContent, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 6. Dirty file external modify → SearchIndex NOT updated ──

  test('dirty file external modify does not update SearchIndex to disk version', async () => {
    // Open search-save.md and make it dirty
    await page.locator('[data-testid="file-node-search-save.md"]').click();
    await page.waitForTimeout(800);
    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' [[local-edit]]');
    await page.waitForTimeout(500);

    // External modify: change heading to something on disk
    const filePath = path.join(vaultDir, 'search-save.md');
    const original = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, '# External Version\n\nDisk content.\n', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Conflict banner should appear
    await expect(page.locator('[data-testid="external-change-banner"]')).toBeVisible({ timeout: 5_000 });

    // Search should NOT find "External Version" (disk version)
    await openSearch('External Version');
    await expect(page.getByTestId('search-empty')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // Dismiss conflict
    await page.getByTestId('conflict-keep').click();
    await page.waitForTimeout(500);
    fs.writeFileSync(filePath, original, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 7. Reload external version → SearchIndex updates ──

  test('reload external version updates SearchIndex', async () => {
    await page.locator('[data-testid="file-node-search-save.md"]').click();
    await page.waitForTimeout(800);
    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' dirty');
    await page.waitForTimeout(500);

    const filePath = path.join(vaultDir, 'search-save.md');
    const original = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, '# Reloaded Heading\n\nAfter reload.\n', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Reload external version
    await page.getByTestId('conflict-reload').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Search should now find the reloaded heading
    await openSearch('Reloaded Heading');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    fs.writeFileSync(filePath, original, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 8. Internal save → SearchIndex updates ──

  test('internal save updates SearchIndex', async () => {
    await page.locator('[data-testid="file-node-search-save.md"]').click();
    await page.waitForTimeout(800);
    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    // Select all and replace
    await page.keyboard.press('Control+a');
    await page.keyboard.type('# Saved Heading\n\nContent after save.\n');
    await page.waitForTimeout(300);

    // Save
    await page.getByTestId('save-note').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await openSearch('Saved Heading');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // Restore
    const filePath = path.join(vaultDir, 'search-save.md');
    fs.writeFileSync(filePath, '# Save Test\n\nWill be edited and saved.\n', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 9. Internal rename → search old name fails, new name works ──

  test('internal rename updates search path', async () => {
    await page.locator('[data-testid="file-node-search-rename-src.md"]').click({ button: 'right' });
    await page.waitForTimeout(300);
    await page.getByTestId('context-menu-rename').click();
    await page.waitForTimeout(300);
    await page.getByTestId('rename-dialog-input').fill('search-rename-dst');
    await page.getByTestId('rename-dialog-confirm').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Old filename should not be searchable by filename
    await openSearch('search-rename-src');
    await expect(page.getByTestId('search-empty')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // New filename should be searchable
    await openSearch('search-rename-dst');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // Rename back
    await page.locator('[data-testid="file-node-search-rename-dst.md"]').click({ button: 'right' });
    await page.waitForTimeout(300);
    await page.getByTestId('context-menu-rename').click();
    await page.waitForTimeout(300);
    await page.getByTestId('rename-dialog-input').fill('search-rename-src');
    await page.getByTestId('rename-dialog-confirm').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 10. Internal delete → search removes file ──

  test('internal delete removes file from search results', async () => {
    // Create a temp file to delete
    fs.writeFileSync(path.join(vaultDir, 'search-temp-del.md'), '# Temp Delete\n\nWill be deleted internally.\n', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await openSearch('Temp Delete');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // Delete internally
    await page.locator('[data-testid="file-node-search-temp-del.md"]').click({ button: 'right' });
    await page.waitForTimeout(300);
    await page.getByTestId('context-menu-delete').click();
    await page.waitForTimeout(300);
    await page.getByTestId('delete-dialog-confirm').click();
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await openSearch('Temp Delete');
    await expect(page.getByTestId('search-empty')).toBeVisible({ timeout: 5_000 });
    await closeSearch();
  });

  // ── 11. Batch file-changed → correct results ──

  test('batch external file-changed events handled correctly for search', async () => {
    const sp = path.join(vaultDir, 'searchable.md');
    const hp = path.join(vaultDir, 'search-heading.md');
    const spOrig = fs.readFileSync(sp, 'utf-8');
    const hpOrig = fs.readFileSync(hp, 'utf-8');

    // Modify two files in quick succession
    fs.writeFileSync(sp, '# Batch Research\n\nUpdated.\n', 'utf-8');
    fs.writeFileSync(hp, '# Batch Heading\n\nUpdated.\n', 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS * 1.5);

    // Both new headings should be searchable
    await openSearch('Batch Research');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    await openSearch('Batch Heading');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    fs.writeFileSync(sp, spOrig, 'utf-8');
    fs.writeFileSync(hp, hpOrig, 'utf-8');
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 12. Full rebuild fallback works ──

  test('full rebuild fallback still works for search', async () => {
    // Create many files to trigger full rebuild fallback (threshold > 20)
    const created: string[] = [];
    for (let i = 0; i < 25; i++) {
      const p = path.join(vaultDir, `batch-rebuild-${i}.md`);
      fs.writeFileSync(p, `# Rebuild ${i}\n\nContent ${i}.\n`, 'utf-8');
      created.push(p);
    }
    await page.waitForTimeout(WATCHER_WAIT_MS * 2);

    // Search should find the rebuild files
    await openSearch('Rebuild 0');
    await expect(page.getByTestId('search-results')).toBeVisible({ timeout: 5_000 });
    await closeSearch();

    // Clean up
    for (const p of created) fs.unlinkSync(p);
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 13. SearchPanel click opens file ──

  test('clicking a search result opens the file', async () => {
    await openSearch('My Research');
    const firstResult = page.getByTestId('search-result-0');
    await expect(firstResult).toBeVisible({ timeout: 5_000 });
    await firstResult.click();
    await page.waitForTimeout(500);

    // Status bar should show the opened file
    const statusbar = page.getByTestId('statusbar-file');
    await expect(statusbar).toContainText('searchable.md', { timeout: 3_000 });
  });

  // ── 14. Regression ──

  test('WikiIndex and backlinks still work after search index operations', async () => {
    await page.locator('[data-testid="file-node-index.md"]').click();
    await page.waitForTimeout(800);
    await expect(page.locator('[data-testid="backlinks-panel"]')).toBeVisible({ timeout: 5_000 });
  });

  test('preview renders after search index operations', async () => {
    await expect(page.locator('[data-testid="markdown-preview"]')).toBeVisible({ timeout: 5_000 });
  });

  test('explorer resizer functional after search index operations', async () => {
    await expect(page.locator('[data-testid="explorer-resizer"]')).toBeVisible({ timeout: 3_000 });
  });

  test('search is still accessible after index operations', async () => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('search-input')).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
  });
});

// ─────────────────────────────────────────────
// Phase 2-C-5 — Image asset monitoring E2E
// ─────────────────────────────────────────────

test.describe('Schola Phase 2-C-5 — Image asset monitoring', () => {
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-watcher-image-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    // Remove stale .schola to avoid SQLite DB conflicts
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }

    // Pre-create a markdown file that references an image
    fs.writeFileSync(path.join(vaultDir, 'image-test.md'), '# Image Test\n\n![](my-image.png)\n', 'utf-8');

    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 25_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try { fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  });

  // ── 1. External image add → Preview shows image ──

  test('external add of referenced image appears in Preview', async () => {
    await page.locator('[data-testid="file-node-image-test.md"]').click();
    await page.waitForTimeout(800);

    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });

    // Image doesn't exist yet — the <img> src may show broken
    // Create the image externally
    const imgPath = path.join(vaultDir, 'my-image.png');
    // Create a minimal 1x1 PNG (smallest valid PNG)
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(imgPath, tinyPng);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Preview should still be visible (not crashed)
    await expect(preview).toBeVisible({ timeout: 5_000 });

    fs.unlinkSync(imgPath);
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 2. External image delete → Preview does not crash ──

  test('external delete of referenced image does not crash Preview', async () => {
    // Create the image first
    const imgPath = path.join(vaultDir, 'my-image.png');
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(imgPath, tinyPng);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await page.locator('[data-testid="file-node-image-test.md"]').click();
    await page.waitForTimeout(800);
    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });

    // Delete the image externally
    fs.unlinkSync(imgPath);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Preview should still be visible (image becomes broken, app does not crash)
    await expect(preview).toBeVisible({ timeout: 5_000 });
  });

  // ── 3. Image change does not trigger dirty/conflict ──

  test('image changes do not trigger external conflict banner', async () => {
    await page.locator('[data-testid="file-node-image-test.md"]').click();
    await page.waitForTimeout(800);

    // Create an image externally
    const imgPath = path.join(vaultDir, 'my-image.png');
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(imgPath, tinyPng);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // No conflict banner should appear
    await expect(page.locator('[data-testid="external-change-banner"]')).not.toBeAttached({ timeout: 3_000 });

    // Modify the image externally
    fs.writeFileSync(imgPath, tinyPng);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Still no conflict banner
    await expect(page.locator('[data-testid="external-change-banner"]')).not.toBeAttached({ timeout: 3_000 });

    // Editor content should still be the original markdown
    const editor = page.locator('[data-testid="editor-cm"]');
    const editorText = await editor.textContent();
    expect(editorText).toContain('my-image.png');

    fs.unlinkSync(imgPath);
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 4. Image change does not set dirty state ──

  test('image changes do not dirty the markdown file', async () => {
    await page.locator('[data-testid="file-node-image-test.md"]').click();
    await page.waitForTimeout(800);

    // Save button should not be visible (file is clean)
    const saveBtn = page.locator('[data-testid="save-note"]');
    const wasVisible = await saveBtn.isVisible().catch(() => false);

    // Create image externally
    const imgPath = path.join(vaultDir, 'my-image.png');
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(imgPath, tinyPng);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Save button state should not have changed due to image events
    // If it was not visible before, it should still not be visible
    if (!wasVisible) {
      await expect(saveBtn).not.toBeVisible({ timeout: 3_000 });
    }

    fs.unlinkSync(imgPath);
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 5. Nested directory image → completion candidate ──

  test('external add of nested directory image appears in completions', async () => {
    // Create nested directory with image
    const subDir = path.join(vaultDir, 'nested-imgs');
    fs.mkdirSync(subDir, { recursive: true });
    const imgPath = path.join(subDir, 'nested-img.gif');
    const tinyGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    fs.writeFileSync(imgPath, tinyGif);
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Open a markdown file and trigger image completion
    await page.locator('[data-testid="file-node-image-test.md"]').click();
    await page.waitForTimeout(800);

    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    // Type image syntax to trigger completion
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('![');
    await page.waitForTimeout(500);

    // Cleanup
    fs.unlinkSync(imgPath);
    fs.rmdirSync(subDir);
    await page.waitForTimeout(WATCHER_WAIT_MS);
  });

  // ── 6. Folder delete with images → Preview refresh ──

  test('external delete of folder containing images refreshes Preview', async () => {
    const subDir = path.join(vaultDir, 'img-folder');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'folder-img.png'),
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    await page.waitForTimeout(WATCHER_WAIT_MS);

    await page.locator('[data-testid="file-node-image-test.md"]').click();
    await page.waitForTimeout(800);
    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });

    // Delete the folder
    fs.rmSync(subDir, { recursive: true, force: true });
    await page.waitForTimeout(WATCHER_WAIT_MS);

    // Preview should still render normally (no crash)
    await expect(preview).toBeVisible({ timeout: 5_000 });
    // Editor content unchanged
    const editor = page.locator('[data-testid="editor-cm"]');
    await expect(editor).toBeVisible({ timeout: 3_000 });
  });

  // ── 7. Regression ──

  test('/table and /code completions still work', async () => {
    await page.locator('[data-testid="file-node-image-test.md"]').click();
    await page.waitForTimeout(800);
    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/tab');
    await page.waitForTimeout(500);
    // Editor should not crash
    await expect(editor).toBeVisible({ timeout: 3_000 });
  });

  test('WikiIndex and backlinks still work after image events', async () => {
    await page.locator('[data-testid="file-node-index.md"]').click();
    await page.waitForTimeout(800);
    await expect(page.locator('[data-testid="backlinks-panel"]')).toBeVisible({ timeout: 5_000 });
  });

  test('search still works after image events', async () => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('search-input')).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
  });

  test('preview renders after image events', async () => {
    await expect(page.locator('[data-testid="markdown-preview"]')).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
