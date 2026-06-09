import { expect, test } from '@playwright/test';
import * as path from 'node:path';
import { dumpScholaLogs, launchSchola, type ScholaAppContext } from './helpers/electronApp';

const SAMPLE_VAULT_PATH = path.resolve('tests', 'fixtures', 'sample-vault');
const TARGET_FILE = '论文.md';

test.describe('Phase 5 editor preview split R3', () => {
  let ctx: ScholaAppContext;

  test.afterEach(async () => {
    if (ctx) {
      await ctx.close();
    }
  });

  test('opens a Chinese Markdown file, previews without closing it, and keeps it in split mode', async () => {
    test.setTimeout(60_000);

    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH, workspaceTimeout: 25_000 });
    const page = ctx.page;

    try {
      await page
        .getByRole('navigation', { name: 'Activity bar' })
        .getByRole('button', { name: '文件' })
        .click();

      await page.getByTestId(`file-node-${TARGET_FILE}`).click();

      const tab = page.getByTestId(`tab-${TARGET_FILE}`);
      await expect(tab).toBeVisible();
      await tab.click();

      await page.waitForSelector('[data-testid="editor-codemirror-ready"]', {
        state: 'attached',
        timeout: 10_000,
      });
      await expect(page.getByTestId('markdown-editor')).toBeVisible();
      await expect(page.getByTestId('editor-cm')).toBeVisible();
      await expect(page.locator('.cm-editor')).toBeVisible();
      await expect(page.locator('.cm-content')).toContainText('测试 Markdown 文件。');

      await page.locator('.cm-content').click();
      await page.keyboard.type(' R3');
      await expect(page.locator('.cm-content')).toContainText('R3');

      await page.getByTestId('editor-toolbar-preview').click();
      await expect(tab).toBeVisible();
      await expect(page.getByTestId('preview-standalone')).toBeVisible();
      await expect(page.getByTestId('markdown-preview')).toContainText('测试 Markdown 文件。');
      await expect(page.getByTestId('markdown-editor')).toHaveCount(0);

      await page.getByTestId('editor-toolbar-split').click();
      await expect(tab).toBeVisible();
      await expect(page.getByTestId('editor-split-container')).toBeVisible();
      await expect(page.getByTestId('editor-pane')).toBeVisible();
      await expect(page.getByTestId('preview-pane')).toBeVisible();
      await expect(page.getByTestId('split-divider')).toBeVisible();
      await expect(page.getByTestId('markdown-editor')).toBeVisible();
      await expect(page.getByTestId('markdown-preview')).toContainText('测试 Markdown 文件。');

      const sidebarBox = await page.getByTestId('workspace-sidebar').boundingBox();
      const resizerBox = await page.getByTestId('sidebar-resizer').boundingBox();
      const editorBox = await page.getByTestId('editor-region').boundingBox();

      expect(sidebarBox).not.toBeNull();
      expect(resizerBox).not.toBeNull();
      expect(editorBox).not.toBeNull();
      expect(Math.round(resizerBox!.x - (sidebarBox!.x + sidebarBox!.width))).toBeLessThanOrEqual(1);
      expect(Math.round(editorBox!.x - (resizerBox!.x + resizerBox!.width))).toBeLessThanOrEqual(1);

      expect(ctx.pageErrors).toEqual([]);
    } catch (err) {
      dumpScholaLogs(ctx);
      throw err;
    }
  });
});
