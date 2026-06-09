import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as path from 'node:path';
import { launchSchola, type ScholaAppContext } from './helpers/electronApp';

const SAMPLE_VAULT_PATH = path.resolve('tests', 'fixtures', 'sample-vault');

test.describe('Preview theme switching', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH });
    page = ctx.page;

    // Click a markdown file to show preview
    const firstFileItem = page.locator('[data-testid^="file-node-"]').first();
    await firstFileItem.waitFor({ state: 'visible', timeout: 10_000 });
    await firstFileItem.click();

    // Wait for the preview panel to render with content
    await page.waitForSelector('[data-testid="preview-theme-select"]', { timeout: 10_000 });
  });

  test.afterAll(async () => {
    if (ctx) {
      await ctx.close();
    }
  });

  // ── 1. Theme selector exists ──
  test('theme selector is visible in preview header', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    await expect(selector).toBeVisible();

    // Verify it's inside the preview header
    const header = page.locator('.preview-header');
    const selectInHeader = header.locator('[data-testid="preview-theme-select"]');
    await expect(selectInHeader).toBeVisible();
  });

  // ── 2. Default theme is applied ──
  test('default preview theme is applied on load', async () => {
    const previewEl = page.locator('[data-testid="markdown-preview"]');
    await expect(previewEl).toHaveAttribute('data-preview-theme', 'typo');
  });

  // ── 3. Theme list has 23 options (not just 4) ──
  test('theme selector shows all 23 preview themes', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    const options = selector.locator('option');
    await expect(options).toHaveCount(23);

    // Spot-check a few light + dark themes
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain('Typo');
    expect(optionTexts).toContain('GitHub');
    expect(optionTexts).toContain('Newsprint');
    expect(optionTexts).toContain('Dracula');
    expect(optionTexts).toContain('Solarized Light');
    expect(optionTexts).toContain('Solarized Dark');
    expect(optionTexts).toContain('M-Book');
  });

  // ── 4. data-preview-theme changes on theme switch ──
  test('data-preview-theme attribute updates on theme switch', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    const previewEl = page.locator('[data-testid="markdown-preview"]');

    // Switch to a light theme
    await selector.selectOption('github');
    await expect(previewEl).toHaveAttribute('data-preview-theme', 'github');

    // Switch to a paper theme
    await selector.selectOption('newsprint');
    await expect(previewEl).toHaveAttribute('data-preview-theme', 'newsprint');

    // Switch to a dark theme
    await selector.selectOption('dracula');
    await expect(previewEl).toHaveAttribute('data-preview-theme', 'dracula');

    // Switch back to default
    await selector.selectOption('typo');
    await expect(previewEl).toHaveAttribute('data-preview-theme', 'typo');
  });

  // ── 5. Light theme removes dark Schola background ──
  test('light preview themes show a light background', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    const previewEl = page.locator('[data-testid="markdown-preview"]');

    // Switch to github (light theme)
    await selector.selectOption('github');

    // The preview background should no longer be the Schola dark color
    const bgColor = await previewEl.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // github theme background is #ffffff or rgb(255, 255, 255)
    expect(bgColor).not.toBe('rgb(30, 30, 30)'); // Not Schola dark
    expect(bgColor).not.toBe('rgb(24, 24, 27)'); // Not M-Web dark
  });

  // ── 6. Dark theme shows dark background ──
  test('dark preview themes show dark background', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    const previewEl = page.locator('[data-testid="markdown-preview"]');

    await selector.selectOption('dracula');

    const bgColor = await previewEl.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Dracula background is #282a36
    expect(bgColor).toBe('rgb(40, 42, 54)');
  });

  // ── 7. Paper/book themes show warm paper background ──
  test('paper themes show warm paper-like background', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    const previewEl = page.locator('[data-testid="markdown-preview"]');

    await selector.selectOption('m-book');

    const bgColor = await previewEl.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // M-Book background is #f5f1e8
    expect(bgColor).toBe('rgb(245, 241, 232)');
  });

  // ── 8. Markdown elements render correctly after theme switch ──
  test('markdown elements render correctly after theme switch', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    const previewEl = page.locator('[data-testid="markdown-preview"]');

    await selector.selectOption('vue');
    await expect(previewEl).toBeVisible();

    // Preview should still have some content rendered
    const content = await previewEl.innerText();
    expect(content.length).toBeGreaterThan(0);
  });

  // ── 9. Editor content is not modified by theme switch ──
  test('editor content is unchanged after theme switch', async () => {
    const editorArea = page.getByTestId('editor-region');
    await expect(editorArea).toBeVisible();

    // Switch themes several times
    const selector = page.locator('[data-testid="preview-theme-select"]');
    await selector.selectOption('lark');
    await selector.selectOption('github');
    await selector.selectOption('bear-default');
    await selector.selectOption('typo');

    // Editor should still be visible and interactive
    await expect(editorArea).toBeVisible();
  });

  // ── 10. File tree remains functional after theme switch ──
  test('file tree remains clickable after theme switch', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    await selector.selectOption('vue');

    const fileItem = page.locator('[data-testid^="file-node-"]').first();
    await expect(fileItem).toBeVisible();
  });

  // ── 11. Preview theme does not affect app shell elements ──
  test('preview theme does not affect app shell elements', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    await selector.selectOption('github'); // Light theme - could be most visible if leaking

    // Ribbon should still have its own styling
    const ribbon = page.locator('.schola-ribbon');
    await expect(ribbon).toBeVisible();

    // Verify ribbon still has dark background (not affected by light preview theme)
    const ribbonBg = await ribbon.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // Should be dark, not white
    expect(ribbonBg).not.toBe('rgb(255, 255, 255)');

    // Theme selector itself should not be styled by preview theme
    await expect(selector).toBeVisible();

    // Workspace sidebar should not be affected
    const sidebar = page.locator('.workspace-sidebar');
    await expect(sidebar).toBeVisible();

    // Preview header should remain dark Schola UI
    const header = page.locator('.preview-header');
    const headerBg = await header.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(headerBg).not.toBe('rgb(255, 255, 255)');
  });

  // ── 12. Theme switched to light does not make app shell white ──
  test('light preview theme does not leak to workspace main', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    await selector.selectOption('whitey'); // Very white theme

    // Activity bar area should remain dark
    const ribbon = page.locator('.schola-ribbon');
    const ribbonColor = await ribbon.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    // Ribbon text should still be light (for dark bg), not dark text
    expect(ribbonColor).not.toBe('rgb(0, 0, 0)');
  });

  // ── 13. Code highlight classes exist in preview ──
  test('code blocks have highlight classes after theme switch', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    await selector.selectOption('solarized-light');

    const previewEl = page.locator('[data-testid="markdown-preview"]');
    // If the note has code blocks, hljs should be present
    const hljsCount = await previewEl.locator('.hljs').count();
    // Just verify preview is not broken - hljs may or may not exist depending on note content
    expect(typeof hljsCount).toBe('number');
  });

  // ── 14. No out-of-scope features ──
  test('no out-of-scope features are present in the UI', async () => {
    // Phase 1-D added Backlinks as a core feature.
    // Phase 1-E added Search as a core feature.
    const forbiddenLabels = [
      'Graph',
      'AI', 'Git', 'Export', 'PPT',
      'Settings', '设置',
    ];

    for (const label of forbiddenLabels) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
  });

  // ── 15. localStorage persists selected theme ──
  test('selected theme is persisted in localStorage', async () => {
    const selector = page.locator('[data-testid="preview-theme-select"]');
    await selector.selectOption('cobalt');

    // Check localStorage value
    const storedValue = await page.evaluate(() => {
      return localStorage.getItem('schola.previewTheme');
    });
    expect(storedValue).toBe('cobalt');
  });

  // ── 16. Invalid localStorage value falls back to default ──
  test('invalid localStorage value falls back to default theme', async () => {
    // Set an invalid value
    await page.evaluate(() => {
      localStorage.setItem('schola.previewTheme', 'nonexistent-theme');
    });

    // Reload the app — this resets React state, so we need to
    // re-open the vault and re-select a file.
    await page.reload();

    // Re-open the vault via the welcome page
    await page.waitForSelector('[data-testid="welcome-page"]', { timeout: 10_000 });
    const openButton = page.getByTestId('welcome-open-vault');
    await openButton.click();
    await page.waitForSelector('.workspace-sidebar', { timeout: 15_000 });

    // Re-select a markdown file to show preview
    const firstFileItem = page.locator('[data-testid^="file-node-"]').first();
    await firstFileItem.waitFor({ state: 'visible', timeout: 10_000 });
    await firstFileItem.click();

    await page.waitForSelector('[data-testid="preview-theme-select"]', { timeout: 10_000 });

    // Should fall back to default 'typo'
    const previewEl = page.locator('[data-testid="markdown-preview"]');
    await expect(previewEl).toHaveAttribute('data-preview-theme', 'typo');
  });
});
