/**
 * Schola Retrofit-4-D — SearchPanel SQLite fallback E2E tests.
 *
 * Verifies that SearchPanel correctly prioritises SQLite search results
 * and falls back to in-memory SearchIndex when the vault is dirty,
 * has external conflicts, the query is empty, SQLite queries fail,
 * results diverge from the memory index, or stale queries arrive.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- monkey-patching window.schola requires dynamic property access */

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

/** Open the search panel by clicking the search trigger. */
async function openSearch(page: Page): Promise<void> {
  const trigger = page.locator('[data-testid="search-trigger"]');
  await trigger.waitFor({ state: 'visible', timeout: 10_000 });
  await trigger.click();
  await page.waitForSelector('[data-testid="search-panel"]', { timeout: 5000 });
}

/** Type a query into the search input using keystrokes. */
async function typeSearchQuery(page: Page, query: string): Promise<void> {
  const input = page.locator('[data-testid="search-input"]');
  await input.click();
  await input.fill('');
  await page.keyboard.type(query, { delay: 20 });
}

/** Wait until the search panel shows the given data-search-source value. */
async function waitForSearchSource(page: Page, source: string, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const panel = document.querySelector('[data-testid="search-panel"]');
      return panel?.getAttribute('data-search-source') === expected;
    },
    source,
    { timeout },
  );
}

// ────────────────────────────────────────────────────────
// 1. Clean state → SQLite
// ────────────────────────────────────────────────────────

test.describe('Search clean state uses SQLite', () => {
  test.describe.configure({ timeout: 90_000 });

  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-search-clean-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    fs.mkdirSync(vaultDir, { recursive: true });

    fs.writeFileSync(path.join(vaultDir, 'p0-alpha.md'), '# Alpha\n\nunique-alpha-content', 'utf-8');
    fs.writeFileSync(path.join(vaultDir, 'p0-beta.md'), '# Beta\n\nunique-beta-content', 'utf-8');
    fs.writeFileSync(path.join(vaultDir, 'p0-gamma.md'), '# Gamma\n\nunique-gamma-content', 'utf-8');

    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 40_000 });
    page = ctx.page;

    await page.locator('[data-testid="file-node-p0-alpha.md"]').waitFor({ state: 'visible', timeout: 20_000 });
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try {
      fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 });
    } catch { /* best-effort */ }
  });

  test('search panel opens via trigger', async () => {
    await openSearch(page);

    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toBeVisible();

    const closeBtn = page.locator('[data-testid="search-close"]');
    await closeBtn.click();
    await expect(panel).not.toBeAttached({ timeout: 2000 });
  });

  test('no premature mismatch while index is building', async () => {
    // Open search immediately after vault open — the memory index
    // may still be building.  Verify the fallback reason is NOT
    // "mismatch" (the pre-P1 bug).
    await openSearch(page);

    // Read the current fallback reason
    const reason = await page.locator('[data-testid="search-panel"]').getAttribute('data-search-fallback-reason');

    // Must NOT be "mismatch" — either "none" (initial state),
    // "indexing" (P1 guard), or another valid reason.
    expect(reason).not.toBe('mismatch');

    // The index-ready attribute tells us the actual state
    const ready = await page.locator('[data-testid="search-panel"]').getAttribute('data-search-index-ready');
    console.log('Index ready at open:', ready, 'fallback reason:', reason);

    await page.locator('[data-testid="search-close"]').click();
  });

  test('search uses SQLite source for clean vault', async () => {
    await openSearch(page);

    // Wait for the memory search index to finish building
    await page.waitForFunction(
      () => document.querySelector('[data-testid="search-panel"]')?.getAttribute('data-search-index-ready') === 'true',
      { timeout: 45_000 },
    );

    await typeSearchQuery(page, 'alpha');
    await waitForSearchSource(page, 'sqlite', 20_000);

    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toHaveAttribute('data-search-source', 'sqlite');
    await expect(panel).toHaveAttribute('data-search-fallback-reason', 'none');

    await page.locator('[data-testid="search-close"]').click();
  });

  test('search results show the correct file', async () => {
    await openSearch(page);
    await typeSearchQuery(page, 'alpha');
    await waitForSearchSource(page, 'sqlite', 60_000);

    const results = page.locator('[data-testid="search-results"]');
    await expect(results).toBeVisible({ timeout: 5000 });

    const firstResult = page.locator('[data-testid="search-result-0"]');
    await expect(firstResult).toBeVisible();
    await expect(firstResult).toContainText('p0-alpha');

    await page.locator('[data-testid="search-close"]').click();
  });

  test('clicking a search result opens the file', async () => {
    await openSearch(page);
    await typeSearchQuery(page, 'alpha');
    await waitForSearchSource(page, 'sqlite', 60_000);

    const firstResult = page.locator('[data-testid="search-result-0"]');
    await firstResult.click();
    await page.waitForTimeout(500);

    const overlay = page.locator('[data-testid="search-overlay"]');
    await expect(overlay).not.toBeAttached({ timeout: 2000 });

    await expect(page).toHaveTitle(/Schola/);
  });
});

// ────────────────────────────────────────────────────────
// 2. Empty query → memory / empty-query
// ────────────────────────────────────────────────────────

test.describe('Search empty query fallback to memory', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
  });

  test('empty query shows memory source with empty-query reason', async () => {
    await openSearch(page);

    // Type a query first to confirm SQLite mode works
    await typeSearchQuery(page, 'research');
    await page.waitForTimeout(INDEX_WAIT_MS);
    await waitForSearchSource(page, 'sqlite');

    // Now clear the query
    await typeSearchQuery(page, '');
    await page.waitForTimeout(500);

    // Should fall back to memory with empty-query reason
    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toHaveAttribute('data-search-source', 'memory');
    await expect(panel).toHaveAttribute('data-search-fallback-reason', 'empty-query');

    // Old search results should NOT be displayed
    const results = page.locator('[data-testid="search-results"]');
    // When query is empty, either no results or a different state
    const resultsVisible = await results.isVisible().catch(() => false);
    // Either way, we should not see stale results from the previous query
    if (resultsVisible) {
      // If results ARE visible, they should be limited/empty
      const resultCount = await results.locator('li').count();
      expect(resultCount).toBe(0);
    }

    // Close
    await page.locator('[data-testid="search-close"]').click();
  });

  test('empty query does not show previous search results', async () => {
    await openSearch(page);

    // Search for something
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);
    await waitForSearchSource(page, 'sqlite');
    // Verify results appeared
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible({ timeout: 3000 });

    // Clear query
    await typeSearchQuery(page, '');
    await page.waitForTimeout(500);

    // Should not show old README results
    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toHaveAttribute('data-search-fallback-reason', 'empty-query');

    // Close
    await page.locator('[data-testid="search-close"]').click();
  });
});

// ────────────────────────────────────────────────────────
// 3. Dirty state → memory fallback
// ────────────────────────────────────────────────────────

test.describe('Search dirty state fallback to memory', () => {
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-search-dirty-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 20_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try {
      fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 });
    } catch { /* best-effort */ }
  });

  test('dirty file triggers memory fallback for search', async () => {
    // Make a file dirty first
    const fileNode = page.locator('[data-testid="file-node-README.md"]');
    await fileNode.click();
    await page.waitForTimeout(500);

    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.type(' search-dirty-test-token', { delay: 10 });
    await page.waitForTimeout(500);

    // Now open search
    await openSearch(page);
    await typeSearchQuery(page, 'research');
    await page.waitForTimeout(INDEX_WAIT_MS);

    // Should be memory/dirty because a file is dirty
    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toHaveAttribute('data-search-source', 'memory');
    await expect(panel).toHaveAttribute('data-search-fallback-reason', 'dirty');

    // Search should still return results from memory index
    const results = page.locator('[data-testid="search-results"]');
    await expect(results).toBeVisible({ timeout: 3000 });

    // Close
    await page.locator('[data-testid="search-close"]').click();
  });

  test('dirty search still returns correct results', async () => {
    // Keep the dirty state from previous test (same vault)
    await openSearch(page);
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);

    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toHaveAttribute('data-search-source', 'memory');

    // Results should still include README.md
    const firstResult = page.locator('[data-testid="search-result-0"]');
    await expect(firstResult).toBeVisible({ timeout: 3000 });
    await expect(firstResult).toContainText('README');

    await page.locator('[data-testid="search-close"]').click();
  });
});

// ────────────────────────────────────────────────────────
// 4. External conflict → memory fallback
// ────────────────────────────────────────────────────────

test.describe('Search external conflict fallback to memory', () => {
  let ctx: ScholaAppContext;
  let page: Page;
  let vaultDir: string;

  test.beforeAll(async () => {
    const tmpBase = path.join(os.tmpdir(), `schola-search-conflict-${Date.now()}`);
    fs.mkdirSync(tmpBase, { recursive: true });
    vaultDir = path.join(tmpBase, 'vault');
    copyDirSync(SAMPLE_VAULT_PATH, vaultDir);
    ctx = await launchSchola({ vaultPath: vaultDir, workspaceTimeout: 20_000 });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
    try {
      fs.rmSync(path.dirname(vaultDir), { recursive: true, force: true, maxRetries: 3 });
    } catch { /* best-effort */ }
  });

  test('external conflict while dirty triggers conflict fallback for search', async () => {
    // Open and dirty a file
    const fileNode = page.locator('[data-testid="file-node-README.md"]');
    await fileNode.click();
    await page.waitForTimeout(500);

    const editor = page.locator('[data-testid="editor-cm"]');
    await editor.click();
    await page.keyboard.type(' conflict search test', { delay: 10 });
    await page.waitForTimeout(300);

    // Externally modify the same file
    const filePath = path.join(vaultDir, 'README.md');
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, originalContent + '\n\nExternal conflict change.', 'utf-8');

    // Wait for watcher to detect
    await page.waitForTimeout(2000);

    // Open search
    await openSearch(page);
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);

    // Should be memory (conflict or dirty, depending on timing)
    const panel = page.locator('[data-testid="search-panel"]');
    const source = await panel.getAttribute('data-search-source');
    expect(source).toBe('memory');

    // Dismiss conflict if visible
    const dismissBtn = page.locator('[data-testid="conflict-dismiss"]');
    if (await dismissBtn.isVisible().catch(() => false)) {
      await dismissBtn.click();
      await page.waitForTimeout(500);
    }

    // Restore original file
    fs.writeFileSync(filePath, originalContent, 'utf-8');

    await page.locator('[data-testid="search-close"]').click();
  });
});

// ────────────────────────────────────────────────────────
// 5. SQLite query failure → memory fallback
// ────────────────────────────────────────────────────────

test.describe('Search SQLite query failure fallback to memory', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
  });

  test('mock search.query failure triggers query-error fallback', async () => {
    // Monkey-patch search.query to return error
    await page.evaluate(() => {
      const orig = (window as any).schola?.search?.query;
      if (!orig) return;
      (window as any).__scholaOrigSearchQuery = orig;
      (window as any).__scholaSearchQueryOverride__ = async () => ({
        ok: false,
        code: 'DB_QUERY_FAILED',
        message: 'mock search query failure',
      });
    });

    await openSearch(page);
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);

    // Should fall back to memory with query-error
    await waitForSearchSource(page, 'memory');

    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toHaveAttribute('data-search-source', 'memory');
    await expect(panel).toHaveAttribute('data-search-fallback-reason', 'query-error');

    // Restore
    await page.evaluate(() => {
      delete (window as any).__scholaOrigSearchQuery;
      delete (window as any).__scholaSearchQueryOverride__;
    });

    await page.locator('[data-testid="search-close"]').click();
  });

  test('query-error fallback still shows memory results', async () => {
    await page.evaluate(() => {
      const orig = (window as any).schola?.search?.query;
      if (orig) (window as any).__scholaOrigSearchQuery = orig;
      (window as any).__scholaSearchQueryOverride__ = async () => ({
        ok: false,
        code: 'DB_QUERY_FAILED',
        message: 'mock failure',
      });
    });

    await openSearch(page);
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);
    await waitForSearchSource(page, 'memory');

    // Memory results should still appear
    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toBeVisible();

    // The search should still work via memory index
    const results = page.locator('[data-testid="search-results"]');
    await expect(results).toBeVisible({ timeout: 3000 });

    // Restore
    await page.evaluate(() => {
      delete (window as any).__scholaOrigSearchQuery;
      delete (window as any).__scholaSearchQueryOverride__;
    });

    await page.locator('[data-testid="search-close"]').click();
  });
});

// ────────────────────────────────────────────────────────
// 6. SQLite / memory mismatch → memory fallback
// ────────────────────────────────────────────────────────

test.describe('Search SQLite / memory mismatch fallback', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
  });

  test('mock mismatch triggers memory fallback with mismatch reason', async () => {
    // Monkey-patch to return different matchedText for mismatch detection
    await page.evaluate(() => {
      const orig = (window as any).schola?.search?.query;
      if (!orig) return;
      (window as any).__scholaOrigSearchQuery = orig;
      (window as any).__scholaSearchQueryOverride__ = async (vaultId: string, query: string) => {
        const result = await orig(vaultId, query);
        if (result.ok && result.matches.length > 0) {
          // Modify matchedText on all results to create mismatch
          result.matches = result.matches.map((m: any) => ({
            ...m,
            matchedText: 'MISMATCHED-TEXT-' + m.matchedText,
          }));
        }
        return result;
      };
    });

    await openSearch(page);
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);

    // Should fall back to memory with mismatch reason
    await waitForSearchSource(page, 'memory');

    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toHaveAttribute('data-search-source', 'memory');
    await expect(panel).toHaveAttribute('data-search-fallback-reason', 'mismatch');

    // Restore
    await page.evaluate(() => {
      delete (window as any).__scholaOrigSearchQuery;
      delete (window as any).__scholaSearchQueryOverride__;
    });

    await page.locator('[data-testid="search-close"]').click();
  });

  test('mismatch with different matchType triggers memory fallback', async () => {
    // This test verifies 4-D strict comparison covers matchType mismatch
    await page.evaluate(() => {
      const orig = (window as any).schola?.search?.query;
      if (orig) (window as any).__scholaOrigSearchQuery = orig;
      (window as any).__scholaSearchQueryOverride__ = async (vaultId: string, query: string) => {
        const result = await orig(vaultId, query);
        if (result.ok && result.matches.length > 0) {
          // Change matchType on all results to 'wikilink' to create mismatch
          result.matches = result.matches.map((m: any) => ({
            ...m,
            matchType: 'wikilink' as any, // force a different type
          }));
        }
        return result;
      };
    });

    await openSearch(page);
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);
    await waitForSearchSource(page, 'memory');

    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toHaveAttribute('data-search-source', 'memory');
    await expect(panel).toHaveAttribute('data-search-fallback-reason', 'mismatch');

    // Restore
    await page.evaluate(() => {
      delete (window as any).__scholaOrigSearchQuery;
      delete (window as any).__scholaSearchQueryOverride__;
    });

    await page.locator('[data-testid="search-close"]').click();
  });
});

// ────────────────────────────────────────────────────────
// 7. Stale query protection (fast query changes)
// ────────────────────────────────────────────────────────

test.describe('Search stale query protection', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH });
    page = ctx.page;
  });

  test.afterAll(async () => {
    if (ctx) await ctx.close();
  });

  test('fast query change does not get overwritten by stale result', async () => {
    // This test verifies that the generationRef stale-guard in useSqliteSearch
    // correctly discards results from an earlier query that returns late.

    // Monkey-patch search.query to introduce controlled delays
    await page.evaluate(() => {
      const orig = (window as any).schola?.search?.query;
      if (!orig) return;
      (window as any).__scholaOrigSearchQuery = orig;

      // Track which query is "slow"
      let slowQuery: string | null = null;

      (window as any).schola.search.query = async (vaultId: string, query: string) => {
        // The first non-empty query after opening search will be slow
        if (!slowQuery && query.trim().length > 0) {
          slowQuery = query;
          // Delay 3 seconds to simulate slow SQLite
          await new Promise((r) => setTimeout(r, 3000));
          const result = await orig(vaultId, query);
          // Return a marked version so we can detect stale results
          if (result.ok) {
            result.source = 'sqlite' as any;
            (result as any).__stale = true;
          }
          return result;
        }
        // Subsequent queries return immediately
        return orig(vaultId, query);
      };
    });

    await openSearch(page);

    // Type first query (will be slow)
    await typeSearchQuery(page, 'alpha-slow');
    await page.waitForTimeout(300);

    // Quickly change to second query
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);

    // The active result should be from the 'README' query, not the stale 'alpha-slow' query
    const panel = page.locator('[data-testid="search-panel"]');
    await expect(panel).toBeVisible();

    // Results should reflect the current query "README", not the stale "alpha-slow"
    const results = page.locator('[data-testid="search-results"]');
    const resultsVisible = await results.isVisible().catch(() => false);
    if (resultsVisible) {
      const resultText = await results.textContent();
      // Should contain "README" from the current query
      expect(resultText).toContain('README');
      // Should NOT contain "alpha-slow" from the stale query
      expect(resultText).not.toContain('alpha-slow');
    }

    // The source/fallback should be consistent with the final query state
    const source = await panel.getAttribute('data-search-source');
    // Either sqlite or memory is fine — the key is it's not corrupted
    expect(['sqlite', 'memory']).toContain(source);

    // Restore
    await page.evaluate(() => {
      const orig = (window as any).__scholaOrigSearchQuery;
      if (orig && (window as any).schola?.search) {
        (window as any).schola.search.query = orig;
      }
      delete (window as any).__scholaOrigSearchQuery;
    });

    await page.locator('[data-testid="search-close"]').click();
  });

  test('stale query result does not corrupt fallback reason', async () => {
    // Monkey-patch with a slow first query that returns error,
    // followed by a fast second query
    await page.evaluate(() => {
      const orig = (window as any).schola?.search?.query;
      if (!orig) return;
      (window as any).__scholaOrigSearchQuery = orig;

      let firstCall = true;
      (window as any).schola.search.query = async (vaultId: string, query: string) => {
        if (firstCall && query.trim().length > 0) {
          firstCall = false;
          await new Promise((r) => setTimeout(r, 3000));
          return { ok: false, code: 'DB_QUERY_FAILED', message: 'stale error' };
        }
        return orig(vaultId, query);
      };
    });

    await openSearch(page);

    // Type first query (will be slow and return error)
    await typeSearchQuery(page, 'slow-stale');
    await page.waitForTimeout(300);

    // Quickly change to a valid query
    await typeSearchQuery(page, 'README');
    await page.waitForTimeout(INDEX_WAIT_MS);

    // The final state should be from the 'README' query, not the stale error
    const panel = page.locator('[data-testid="search-panel"]');
    const reason = await panel.getAttribute('data-search-fallback-reason');
    // Should NOT be 'query-error' from the stale request
    expect(reason).not.toBe('query-error');

    // Restore
    await page.evaluate(() => {
      const orig = (window as any).__scholaOrigSearchQuery;
      if (orig && (window as any).schola?.search) {
        (window as any).schola.search.query = orig;
      }
      delete (window as any).__scholaOrigSearchQuery;
    });

    await page.locator('[data-testid="search-close"]').click();
  });
});
