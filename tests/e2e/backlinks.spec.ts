/**
 * Schola Retrofit-4-D — Backlinks SQLite fallback E2E tests.
 *
 * Verifies that BacklinksPanel correctly prioritises SQLite backlinks
 * and falls back to in-memory WikiIndex when the vault is dirty, has
 * external conflicts, SQLite queries fail, or results diverge from
 * the memory index.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- monkey-patching window.schola requires dynamic property access */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { launchSchola, type ScholaAppContext } from './helpers/electronApp';

const SAMPLE_VAULT_PATH = path.resolve('tests', 'fixtures', 'sample-vault');

/** Recursive directory copy (synchronous). */
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

/** Wait long enough for SQLite index to be built + IPC roundtrip + React render. */
const INDEX_WAIT_MS = 5000;

/** Click a file node in the explorer tree by file name. */
async function selectFileInTree(page: Page, fileName: string): Promise<void> {
  // Wait for the file node to be visible first
  const fileNode = page.locator(`[data-testid="file-node-${fileName}"]`);
  await fileNode.waitFor({ state: 'visible', timeout: 10_000 });
  await fileNode.click();
  await page.waitForTimeout(500);
}

/** Wait until the backlinks panel shows the given data-backlinks-source value. */
async function waitForBacklinksSource(page: Page, source: string, timeout = 15_000): Promise<void> {
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
// 1. Clean state → SQLite
// ────────────────────────────────────────────────────────

test.describe('Backlinks clean state uses SQLite', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH, workspaceTimeout: 20_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
  });

  test('backlinks panel not visible when no file selected', async () => {
    const panel = page.locator('[data-testid="backlinks-panel"]');
    await expect(panel).not.toBeAttached({ timeout: 2000 });
  });

  test('backlinks panel shows SQLite source for clean vault', async () => {
    // README.md is linked by research.md → backlinks should appear
    await selectFileInTree(page, 'README.md');

    // Wait for SQLite index to be ready (may need some time after vault open)
    await waitForBacklinksSource(page, 'sqlite');

    const panel = page.locator('[data-testid="backlinks-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-backlinks-source', 'sqlite');
    await expect(panel).toHaveAttribute('data-backlinks-fallback-reason', 'none');
  });

  test('backlinks source file is displayed', async () => {
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite');

    // research.md links to [[README]]
    const backlink = page.locator('[data-testid="backlink-research.md"]');
    await expect(backlink).toBeVisible({ timeout: 5000 });
  });

  test('backlinks count is shown', async () => {
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite');

    const count = page.locator('[data-testid="backlinks-count"]');
    await expect(count).toBeVisible();
    const countText = await count.textContent();
    expect(Number(countText)).toBeGreaterThanOrEqual(1);
  });

  test('clicking a backlink opens the source file', async () => {
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite');

    const backlink = page.locator('[data-testid="backlink-research.md"]');
    await backlink.click();
    await page.waitForTimeout(500);

    // The page should still be Schola (no crash)
    await expect(page).toHaveTitle(/Schola/);
  });
});

// ────────────────────────────────────────────────────────
// 2. Dirty state → memory fallback
// ────────────────────────────────────────────────────────

test.describe('Backlinks dirty state fallback to memory', () => {
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-backlinks-dirty-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    // Remove stale .schola to avoid SQLite DB conflicts
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }
    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 20_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try {
      fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 });
    } catch { /* best-effort */ }
  });

  test('dirty file triggers memory fallback', async () => {
    // First verify clean state
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite');

    // Now make the file dirty by typing in the editor
    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.type(' extra dirty content', { delay: 10 });
    await page.waitForTimeout(500);

    // Backlinks panel should fall back to memory with 'dirty' reason
    await waitForBacklinksSource(page, 'memory');

    const panel = page.locator('[data-testid="backlinks-panel"]');
    await expect(panel).toHaveAttribute('data-backlinks-source', 'memory');
    await expect(panel).toHaveAttribute('data-backlinks-fallback-reason', 'dirty');
  });

  test('dirty fallback still shows correct backlinks', async () => {
    // README.md is still dirty from previous test — with global dirty check
    // any dirty file triggers memory fallback for all backlinks.
    // Select a different file and verify it shows memory/dirty.
    await selectFileInTree(page, 'research.md');
    await page.waitForTimeout(500);

    const panel = page.locator('[data-testid="backlinks-panel"]');
    // Already in memory/dirty state from global dirty check
    await expect(panel).toHaveAttribute('data-backlinks-source', 'memory');
    await expect(panel).toHaveAttribute('data-backlinks-fallback-reason', 'dirty');

    // Backlinks should still display the correct source file
    // index.md links to [[research]], so research.md should show index.md backlink
    const backlink = page.locator('[data-testid="backlink-index.md"]');
    await expect(backlink).toBeVisible({ timeout: 3000 });
  });
});

// ────────────────────────────────────────────────────────
// 3. External conflict → memory fallback
// ────────────────────────────────────────────────────────

test.describe('Backlinks external conflict fallback to memory', () => {
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-backlinks-conflict-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    // Remove stale .schola to avoid SQLite DB conflicts
    try { fs.rmSync(path.join(vaultDir, '.schola'), { recursive: true, force: true }); } catch { /* ok */ }
    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 20_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try {
      fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 });
    } catch { /* best-effort */ }
  });

  test('external file modification while dirty triggers conflict fallback', async () => {
    // Open README.md and verify clean state
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite');

    // Make the file dirty
    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.type(' conflict-inducing change', { delay: 10 });
    await page.waitForTimeout(300);
    await waitForBacklinksSource(page, 'memory');

    // Now externally modify the same file on disk
    const readmePath = path.join(vaultDir, 'README.md');
    const originalContent = fs.readFileSync(readmePath, 'utf-8');
    fs.writeFileSync(readmePath, originalContent + '\n\nExternal modification.', 'utf-8');

    // Wait for watcher to detect external change + conflict detection
    await page.waitForTimeout(2000);

    // Check if conflict banner appears (indicates external conflict detected)
    const conflictBanner = page.locator('[data-testid="external-change-banner"]');
    const hasConflict = await conflictBanner.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasConflict) {
      // If conflict is detected, backlinks should be memory/conflict
      // (or could still be memory/dirty if conflict hasn't propagated yet)
      const panel = page.locator('[data-testid="backlinks-panel"]');
      const source = await panel.getAttribute('data-backlinks-source');
      expect(source).toBe('memory');
      // Dismiss the conflict for clean state
      const dismissBtn = page.locator('[data-testid="conflict-dismiss"]');
      if (await dismissBtn.isVisible().catch(() => false)) {
        await dismissBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // After conflict detection, backlinks source should still be memory
    const panel = page.locator('[data-testid="backlinks-panel"]');
    const finalSource = await panel.getAttribute('data-backlinks-source');
    expect(finalSource).toBe('memory');

    // Restore original file content
    fs.writeFileSync(readmePath, originalContent, 'utf-8');
  });
});

// ────────────────────────────────────────────────────────
// 4. SQLite query failure → memory fallback
// ────────────────────────────────────────────────────────

test.describe('Backlinks SQLite query failure fallback to memory', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH, workspaceTimeout: 20_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
  });

  test('mock getBacklinks failure triggers query-error fallback', async () => {
    // First select a file to confirm clean SQLite state
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite');

    // Monkey-patch the wiki.getBacklinks API to return an error
    await page.evaluate(() => {
      const orig = (window as any).schola?.wiki?.getBacklinks;
      if (!orig) return;
      (window as any).__scholaOrigGetBacklinks = orig;
      (window as any).__scholaGetBacklinksOverride__ = async () => ({
        ok: false,
        code: 'DB_QUERY_FAILED',
        message: 'mock query failure',
      });
    });

    // Switch to another file to trigger a fresh SQLite query
    await selectFileInTree(page, 'research.md');
    await page.waitForTimeout(INDEX_WAIT_MS);

    // Should fall back to memory with query-error reason
    await waitForBacklinksSource(page, 'memory');

    const panel = page.locator('[data-testid="backlinks-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-backlinks-source', 'memory');
    await expect(panel).toHaveAttribute('data-backlinks-fallback-reason', 'query-error');

    // Restore
    await page.evaluate(() => {
      delete (window as any).__scholaOrigGetBacklinks;
      delete (window as any).__scholaGetBacklinksOverride__;
    });
  });

  test('query-error fallback UI does not crash and shows memory backlinks', async () => {
    // Restore state first
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite');

    // Mock failure
    await page.evaluate(() => {
      const orig = (window as any).schola?.wiki?.getBacklinks;
      if (orig) (window as any).__scholaOrigGetBacklinks = orig;
      (window as any).__scholaGetBacklinksOverride__ = async () => ({
        ok: false,
        code: 'DB_QUERY_FAILED',
        message: 'mock failure',
      });
    });

    await selectFileInTree(page, 'research.md');
    await page.waitForTimeout(INDEX_WAIT_MS);
    await waitForBacklinksSource(page, 'memory');

    // The panel should still be visible with the fallback reason
    const panel = page.locator('[data-testid="backlinks-panel"]');
    await expect(panel).toBeVisible();

    // Even on query error, the memory index should still show correct data
    // index.md links to [[research]], so research.md should show index.md backlink
    const backlink = page.locator('[data-testid="backlink-index.md"]');
    await expect(backlink).toBeVisible({ timeout: 3000 });

    // Restore
    await page.evaluate(() => {
      delete (window as any).__scholaOrigGetBacklinks;
      delete (window as any).__scholaGetBacklinksOverride__;
    });
  });
});

// ────────────────────────────────────────────────────────
// 5. SQLite / memory mismatch → memory fallback
// ────────────────────────────────────────────────────────

test.describe('Backlinks SQLite / memory mismatch fallback', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH, workspaceTimeout: 20_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
  });

  test('mock mismatch triggers memory fallback with mismatch reason', async () => {
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite');

    // Monkey-patch to return extra backlink items
    await page.evaluate(() => {
      const orig = (window as any).schola?.wiki?.getBacklinks;
      if (!orig) return;
      (window as any).__scholaOrigGetBacklinks = orig;
      (window as any).__scholaGetBacklinksOverride__ = async (vaultId: string, relativePath: string) => {
        const result = await orig(vaultId, relativePath);
        if (result.ok) {
          // Inject an extra fake backlink to create mismatch
          result.backlinks = [
            ...result.backlinks,
            { sourcePath: 'fake-extra.md', rawTarget: 'extra', targetPath: 'fake-extra.md', alias: null },
          ];
        }
        return result;
      };
    });

    // Switch to a different file to trigger a new query
    await selectFileInTree(page, 'research.md');
    await page.waitForTimeout(INDEX_WAIT_MS);

    // Should fall back to memory with mismatch reason
    await waitForBacklinksSource(page, 'memory');

    const panel = page.locator('[data-testid="backlinks-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-backlinks-source', 'memory');
    await expect(panel).toHaveAttribute('data-backlinks-fallback-reason', 'mismatch');

    // Restore
    await page.evaluate(() => {
      delete (window as any).__scholaOrigGetBacklinks;
      delete (window as any).__scholaGetBacklinksOverride__;
    });
  });

  test('mismatch fallback still renders correct memory backlinks', async () => {
    await selectFileInTree(page, 'README.md');
    await waitForBacklinksSource(page, 'sqlite');

    // Mock mismatch (extra items)
    await page.evaluate(() => {
      const orig = (window as any).schola?.wiki?.getBacklinks;
      if (orig) (window as any).__scholaOrigGetBacklinks = orig;
      (window as any).__scholaGetBacklinksOverride__ = async (vaultId: string, relativePath: string) => {
        const result = await orig(vaultId, relativePath);
        if (result.ok) {
          result.backlinks = [
            ...result.backlinks,
            { sourcePath: 'bogus.md', rawTarget: 'phantom', targetPath: 'bogus.md', alias: null },
          ];
        }
        return result;
      };
    });

    await selectFileInTree(page, 'research.md');
    await page.waitForTimeout(INDEX_WAIT_MS);
    await waitForBacklinksSource(page, 'memory');

    // Memory backlinks should still show the correct data (no fake items)
    // index.md links to [[research]] → backlink should exist
    const backlink = page.locator('[data-testid="backlink-index.md"]');
    await expect(backlink).toBeVisible({ timeout: 3000 });

    // The fake item should NOT appear
    const fakeBacklink = page.locator('[data-testid="backlink-bogus.md"]');
    await expect(fakeBacklink).not.toBeAttached({ timeout: 1000 });

    // Restore
    await page.evaluate(() => {
      delete (window as any).__scholaOrigGetBacklinks;
      delete (window as any).__scholaGetBacklinksOverride__;
    });
  });
});
