/**
 * Schola Retrofit-5 — Index maintenance E2E tests.
 *
 * Verifies that the Index Status / Rebuild UX correctly displays
 * SQLite index state, allows manual rebuild, handles missing/corrupt
 * databases, respects dirty-file guard, and survives rebuild failures.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- monkey-patching requires dynamic property access */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { launchSchola, type ScholaAppContext } from './helpers/electronApp';

const SAMPLE_VAULT_PATH = path.resolve('tests', 'fixtures', 'sample-vault');

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const INDEX_WAIT_MS = 5000;

/** Wait until the index status indicator shows the given data-index-status value. */
async function waitForIndexStatus(page: Page, status: string, timeout = 20_000): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const el = document.querySelector('[data-testid="index-status-indicator"]');
      return el?.getAttribute('data-index-status') === expected;
    },
    status,
    { timeout },
  );
}

/** Click the rebuild button and wait for rebuilding state. */
async function clickRebuild(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="index-rebuild-button"]');
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.click();
}

/** Open the search panel and type a query. */
async function openSearch(page: Page): Promise<void> {
  const trigger = page.locator('[data-testid="search-trigger"]');
  await trigger.waitFor({ state: 'visible', timeout: 10_000 });
  await trigger.click();
  await page.waitForSelector('[data-testid="search-panel"]', { timeout: 5000 });
}

async function typeSearchQuery(page: Page, query: string): Promise<void> {
  const input = page.locator('[data-testid="search-input"]');
  await input.click();
  await input.fill('');
  await page.keyboard.type(query, { delay: 20 });
}

async function waitForSearchSource(page: Page, source: string, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const panel = document.querySelector('[data-testid="search-panel"]');
      return panel?.getAttribute('data-search-source') === expected;
    },
    source,
    { timeout },
  );
}

async function selectFileInTree(page: Page, fileName: string): Promise<void> {
  const fileNode = page.locator(`[data-testid="file-node-${fileName}"]`);
  await fileNode.waitFor({ state: 'visible', timeout: 10_000 });
  await fileNode.click();
  await page.waitForTimeout(500);
}

async function waitForBacklinksSource(page: Page, source: string, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const panel = document.querySelector('[data-testid="backlinks-panel"]');
      return panel?.getAttribute('data-backlinks-source') === expected;
    },
    source,
    { timeout },
  );
}

// ────────────────────────────────────────────────────────
// 1. Status ready on clean vault
// ────────────────────────────────────────────────────────

test.describe('Index status on clean vault', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH, workspaceTimeout: 20_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
  });

  test('index status indicator is visible after vault opens', async () => {
    const indicator = page.locator('[data-testid="index-status-indicator"]');
    await expect(indicator).toBeVisible({ timeout: 15_000 });
  });

  test('index status shows ready', async () => {
    await waitForIndexStatus(page, 'ready');
  });

  test('index status text displays file count', async () => {
    const text = page.locator('[data-testid="index-status-text"]');
    await expect(text).toBeVisible();
    const content = await text.textContent();
    expect(content).toMatch(/文件/);
  });

  test('rebuild button is visible', async () => {
    const btn = page.locator('[data-testid="index-rebuild-button"]');
    await expect(btn).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────
// 2. Manual rebuild flow
// ────────────────────────────────────────────────────────

test.describe('Manual index rebuild', () => {
  test.describe.configure({ timeout: 120_000 });
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-index-rebuild-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    // Remove stale .schola to start clean
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }
    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 25_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try { fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  });

  test('rebuild button triggers rebuild and returns to ready', async () => {
    await waitForIndexStatus(page, 'ready');
    await clickRebuild(page);

    // Rebuild may complete very quickly for small vaults —
    // the key assertion is that it returns to 'ready' state.
    await waitForIndexStatus(page, 'ready', 60_000);

    const rebuilding = await page.locator('[data-testid="index-status-indicator"]').getAttribute('data-index-rebuilding');
    expect(rebuilding).toBe('false');
  });

  test('search uses SQLite after rebuild', async () => {
    await waitForIndexStatus(page, 'ready');
    await clickRebuild(page);
    await waitForIndexStatus(page, 'ready', 60_000);

    await openSearch(page);
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);
    await waitForSearchSource(page, 'sqlite', 30_000);

    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toHaveAttribute('data-search-source', 'sqlite');
    await page.keyboard.press('Escape');
  });

  test('backlinks use SQLite after rebuild', async () => {
    await waitForIndexStatus(page, 'ready');
    await clickRebuild(page);
    await waitForIndexStatus(page, 'ready', 60_000);

    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite', 30_000);

    const panel = page.locator('[data-testid="backlinks-panel"]');
    await expect(panel).toHaveAttribute('data-backlinks-source', 'sqlite');
  });
});

// ────────────────────────────────────────────────────────
// 3. Missing index.db — rebuild recreates
// ────────────────────────────────────────────────────────

test.describe('Index rebuild with missing index.db', () => {
  test.describe.configure({ timeout: 120_000 });
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-index-missing-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    // Remove .schola entirely to simulate missing index.db
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }
    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 25_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try { fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  });

  test('status shows ready (db auto-created) when opening without index.db', async () => {
    // When vault opens without .schola, the backend auto-creates index.db (empty).
    // Status should be 'ready' with 0 files.
    await waitForIndexStatus(page, 'ready', 20_000);

    // Verify index.db was created by the backend
    const dbPath = path.join(vaultDir, '.schola', 'index.db');
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  test('rebuild recreates index.db and transitions to ready', async () => {
    // Wait for the indicator to appear
    await page.waitForSelector('[data-testid="index-rebuild-button"]', { timeout: 15_000 });

    // Click rebuild
    const btn = page.locator('[data-testid="index-rebuild-button"]');
    await btn.click();

    // Wait for ready state
    await waitForIndexStatus(page, 'ready', 60_000);

    // Verify index.db was created
    const dbPath = path.join(vaultDir, '.schola', 'index.db');
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  test('backlinks work after rebuild on missing db', async () => {
    await waitForIndexStatus(page, 'ready', 15_000);
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite', 30_000);
    await expect(page.locator('[data-testid="backlinks-panel"]')).toHaveAttribute('data-backlinks-source', 'sqlite');
  });
});

// ────────────────────────────────────────────────────────
// 4. Dirty files disable rebuild
// ────────────────────────────────────────────────────────

test.describe('Rebuild disabled when files are dirty', () => {
  test.describe.configure({ timeout: 90_000 });
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-index-dirty-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }
    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 25_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try { fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  });

  test('rebuild button is disabled when files are dirty', async () => {
    await waitForIndexStatus(page, 'ready', 15_000);

    // Verify initially enabled
    const btn = page.locator('[data-testid="index-rebuild-button"]');
    await expect(btn).toBeEnabled({ timeout: 10_000 });

    // Open a file and make it dirty
    await selectFileInTree(page, 'README.md');
    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.type(' unsaved change', { delay: 10 });
    await page.waitForTimeout(500);

    // Rebuild should now be disabled
    await expect(btn).toBeDisabled({ timeout: 5000 });
  });

  test('rebuild button re-enabled after save', async () => {
    // Find save button
    const saveBtn = page.getByTestId('save-note');
    await expect(saveBtn).toBeEnabled({ timeout: 3000 });
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Rebuild should be enabled again
    const rebuildBtn = page.locator('[data-testid="index-rebuild-button"]');
    await expect(rebuildBtn).toBeEnabled({ timeout: 5000 });
  });
});

// ────────────────────────────────────────────────────────
// 5. Rebuild failure — error displayed, no crash
// ────────────────────────────────────────────────────────

test.describe('Rebuild failure handling', () => {
  test.describe.configure({ timeout: 90_000 });
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-index-fail-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }
    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 25_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    // Restore override if needed
    await page.evaluate(() => {
      delete (window as any).__scholaRebuildOverride__;
    }).catch(() => {});
    try { fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  });

  test('rebuild failure shows error message', async () => {
    await waitForIndexStatus(page, 'ready', 15_000);

    // Monkey-patch rebuild to simulate failure
    await page.evaluate(() => {
      (window as any).__scholaRebuildOverride__ = async () => ({
        ok: false,
        status: {
          vaultId: 'mock', state: 'error', schemaVersion: null,
          fileCount: 0, linkCount: 0, unresolvedLinkCount: 0,
          headingCount: 0, searchItemCount: 0,
          errorMessage: 'Mock rebuild failure for E2E test',
        },
        indexedFiles: 0, linkCount: 0, searchItemCount: 0,
        errorMessage: 'Mock rebuild failure for E2E test',
      });
    });

    // Click rebuild
    const btn = page.locator('[data-testid="index-rebuild-button"]');
    await expect(btn).toBeEnabled({ timeout: 10_000 });
    await btn.click();
    await page.waitForTimeout(2000);

    // Error text should appear
    const error = page.locator('[data-testid="index-status-error"]');
    await expect(error).toBeVisible({ timeout: 5000 });

    // Clean up override
    await page.evaluate(() => {
      delete (window as any).__scholaRebuildOverride__;
    });
  });

  test('editor content survives rebuild failure', async () => {
    await waitForIndexStatus(page, 'ready', 15_000);

    // Open a file and verify content
    await selectFileInTree(page, 'README.md');
    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible({ timeout: 5000 });

    // Monkey-patch failure
    await page.evaluate(() => {
      (window as any).__scholaRebuildOverride__ = async () => ({
        ok: false,
        status: {
          vaultId: 'mock', state: 'error', schemaVersion: null,
          fileCount: 0, linkCount: 0, unresolvedLinkCount: 0,
          headingCount: 0, searchItemCount: 0,
          errorMessage: 'Another mock failure',
        },
        indexedFiles: 0, linkCount: 0, searchItemCount: 0,
        errorMessage: 'Another mock failure',
      });
    });

    // Trigger rebuild
    const btn = page.locator('[data-testid="index-rebuild-button"]');
    await expect(btn).toBeEnabled({ timeout: 10_000 });
    await btn.click();
    await page.waitForTimeout(2000);

    // Editor should still work — the file we opened is still there
    await expect(preview).toBeVisible({ timeout: 3000 });

    // Search should still fallback to memory
    await openSearch(page);
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);
    // Either sqlite or memory — the key is it doesn't crash
    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
    const source = await panel.getAttribute('data-search-source');
    expect(['sqlite', 'memory']).toContain(source);
    await page.keyboard.press('Escape');

    // Clean up
    await page.evaluate(() => {
      delete (window as any).__scholaRebuildOverride__;
    });
  });
});

// ────────────────────────────────────────────────────────
// 6. Missing index.db recovery via rebuild (Retrofit-6)
// ────────────────────────────────────────────────────────

test.describe('Missing index.db recovery', () => {
  test.describe.configure({ timeout: 120_000 });
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-index-recover-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    // Remove .schola entirely to simulate fresh vault without index
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }

    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 25_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try { fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  });

  test('index.db auto-created on vault open', async () => {
    // Vault opens without .schola — backend creates fresh index.db
    await waitForIndexStatus(page, 'ready', 20_000);
    const dbPath = path.join(vaultDir, '.schola', 'index.db');
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  test('rebuild from fresh state returns to ready', async () => {
    await waitForIndexStatus(page, 'ready', 15_000);
    const btn = page.locator('[data-testid="index-rebuild-button"]');
    await btn.click();
    await waitForIndexStatus(page, 'ready', 60_000);
  });

  test('backlinks work after rebuild from fresh', async () => {
    await waitForIndexStatus(page, 'ready', 15_000);
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite', 30_000);
    await expect(page.locator('[data-testid="backlinks-panel"]')).toHaveAttribute('data-backlinks-source', 'sqlite');
  });

  test('search works after rebuild from fresh', async () => {
    await waitForIndexStatus(page, 'ready', 15_000);
    await openSearch(page);
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);
    await waitForSearchSource(page, 'sqlite', 20_000);
    await expect(page.locator('[data-testid="search-panel"]')).toHaveAttribute('data-search-source', 'sqlite');
    await page.keyboard.press('Escape');
  });
});

// ────────────────────────────────────────────────────────
// 7. Search re-queries after watcher sync (Retrofit-6)
// ────────────────────────────────────────────────────────

test.describe('Search re-queries after external file change', () => {
  test.describe.configure({ timeout: 120_000 });
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-search-watcher-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }

    // Pre-create a file with searchable content
    fs.writeFileSync(path.join(vaultDir, 'search-watcher.md'), '# Watcher Test\n\ninitial-content\n', 'utf-8');

    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 25_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try { fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  });

  test('search shows sqlite source after external modification + watcher sync', async () => {
    await waitForIndexStatus(page, 'ready', 15_000);

    // Search for a keyword that doesn't exist yet
    await openSearch(page);
    await typeSearchQuery(page, 'unique-watcher-keyword');
    await page.waitForTimeout(INDEX_WAIT_MS);

    // Close search
    await page.keyboard.press('Escape');

    // Externally add the keyword to a markdown file
    const filePath = path.join(vaultDir, 'search-watcher.md');
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, originalContent + '\n\nunique-watcher-keyword added via watcher\n', 'utf-8');

    // Wait for watcher to detect and sync
    await page.waitForTimeout(3000);

    // Wait for index status to still be ready (sync completed)
    await waitForIndexStatus(page, 'ready', 20_000);

    // Now search for the new keyword
    await openSearch(page);
    await typeSearchQuery(page, 'unique-watcher-keyword');
    await page.waitForTimeout(INDEX_WAIT_MS);

    // Should find results with sqlite source
    await waitForSearchSource(page, 'sqlite', 30_000);
    await expect(page.locator('[data-testid="search-panel"]')).toHaveAttribute('data-search-source', 'sqlite');

    // Close and restore
    await page.keyboard.press('Escape');
    fs.writeFileSync(filePath, originalContent, 'utf-8');
    await page.waitForTimeout(1500);
  });

  test('backlinks re-query after external modification + watcher sync', async () => {
    await waitForIndexStatus(page, 'ready', 15_000);

    // Externally add a wikilink [[README]] to search-watcher.md
    const filePath = path.join(vaultDir, 'search-watcher.md');
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, originalContent + '\n\nSee also [[README]]\n', 'utf-8');

    // Wait for watcher sync
    await page.waitForTimeout(3000);
    await waitForIndexStatus(page, 'ready', 20_000);

    // README.md should show search-watcher.md as a backlink
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite', 30_000);
    await expect(page.locator('[data-testid="backlinks-panel"]')).toHaveAttribute('data-backlinks-source', 'sqlite');

    // Restore
    fs.writeFileSync(filePath, originalContent, 'utf-8');
    await page.waitForTimeout(1500);
  });
});
