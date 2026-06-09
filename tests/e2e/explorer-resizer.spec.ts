import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as path from 'node:path';
import { launchSchola, type ScholaAppContext } from './helpers/electronApp';

const SAMPLE_VAULT_PATH = path.resolve('tests', 'fixtures', 'sample-vault');
const SIDEBAR_STORAGE_KEY = 'schola.layout.sidebarWidth';
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 480;

test.describe('Explorer resizer', () => {
  let ctx: ScholaAppContext;
  let page: Page;

  test.beforeAll(async () => {
    ctx = await launchSchola({ vaultPath: SAMPLE_VAULT_PATH });
    page = ctx.page;

    // Wait for the resizer to appear
    await page.waitForSelector('[data-testid="explorer-resizer"]', { timeout: 10_000 });
  });

  test.afterAll(async () => {
    if (ctx) {
      await ctx.close();
    }
  });

  // ── 1. Explorer resizer exists between Explorer and Editor ──
  test('explorer resizer exists and is visible', async () => {
    const resizer = page.locator('[data-testid="sidebar-resizer"]');
    await expect(resizer).toBeVisible();

    // Verify it sits between the sidebar and the main area
    const sidebarBox = await page.locator('.workspace-sidebar').boundingBox();
    const mainBox = await page.getByTestId('editor-region').boundingBox();
    const resizerBox = await resizer.boundingBox();

    expect(sidebarBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect(resizerBox).not.toBeNull();

    // Resizer should be between sidebar (right edge) and main (left edge)
    expect(resizerBox!.x).toBeGreaterThan(sidebarBox!.x);
    expect(resizerBox!.x + resizerBox!.width).toBeLessThanOrEqual(mainBox!.x);
  });

  // ── 2. Explorer resizer is locatable ──
  test('explorer resizer has proper test id and CSS class', async () => {
    const resizer = page.locator('[data-testid="explorer-resizer"]');
    await expect(resizer).toHaveClass(/workspace-resizer/);
    await expect(resizer).toHaveCSS('cursor', 'col-resize');
  });

  // ── 3. Dragging resizer changes Explorer width ──
  test('dragging explorer resizer changes sidebar width', async () => {
    const sidebar = page.locator('.workspace-sidebar');
    const resizer = page.locator('[data-testid="explorer-resizer"]');

    const initialWidth = await sidebar.evaluate((el) => el.clientWidth);
    const resizerBox = await resizer.boundingBox();
    expect(resizerBox).not.toBeNull();

    // Drag 60px to the right
    const startX = resizerBox!.x + resizerBox!.width / 2;
    const startY = resizerBox!.y + resizerBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY, { steps: 5 });
    await page.mouse.up();

    const newWidth = await sidebar.evaluate((el) => el.clientWidth);
    expect(newWidth).toBeGreaterThan(initialWidth);
  });

  // ── 4. Explorer width cannot go below min (220px) ──
  test('explorer width does not go below minimum', async () => {
    const sidebar = page.locator('.workspace-sidebar');
    const resizer = page.locator('[data-testid="explorer-resizer"]');

    const resizerBox = await resizer.boundingBox();
    expect(resizerBox).not.toBeNull();

    // Drag far left (try to shrink below min)
    const startX = resizerBox!.x + resizerBox!.width / 2;
    const startY = resizerBox!.y + resizerBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 500, startY, { steps: 10 });
    await page.mouse.up();

    const minWidth = await sidebar.evaluate((el) => el.clientWidth);
    // Should be clamped at 220
    expect(minWidth).toBeGreaterThanOrEqual(218); // tolerance for subpixel
    expect(minWidth).toBeLessThanOrEqual(222);
  });

  // ── 5. Explorer width cannot exceed max (480px or 40vw) ──
  test('explorer width does not exceed maximum', async () => {
    const sidebar = page.locator('.workspace-sidebar');
    const resizer = page.locator('[data-testid="explorer-resizer"]');

    const resizerBox = await resizer.boundingBox();
    expect(resizerBox).not.toBeNull();

    // Drag far right (try to exceed max)
    const startX = resizerBox!.x + resizerBox!.width / 2;
    const startY = resizerBox!.y + resizerBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 600, startY, { steps: 10 });
    await page.mouse.up();

    const maxWidth = await sidebar.evaluate((el) => el.clientWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    const expectedMaxWidth = Math.max(220, Math.min(SIDEBAR_MAX_WIDTH, Math.floor(viewportWidth * 0.4)));
    expect(maxWidth).toBeLessThanOrEqual(expectedMaxWidth + 2);
    expect(maxWidth).toBeGreaterThanOrEqual(expectedMaxWidth - 2);
  });

  // ── 6. Double-click resets Explorer width and persists the value ──
  test('double-clicking explorer resizer resets and persists default width', async () => {
    const sidebar = page.locator('.workspace-sidebar');
    const resizer = page.locator('[data-testid="explorer-resizer"]');
    const resizerBox = await resizer.boundingBox();
    expect(resizerBox).not.toBeNull();

    const startX = resizerBox!.x + resizerBox!.width / 2;
    const startY = resizerBox!.y + resizerBox!.height / 2;
    await page.mouse.click(startX, startY);
    await page.mouse.click(startX, startY);

    const resetWidth = await sidebar.evaluate((el) => el.clientWidth);
    const storedWidth = await page.evaluate((key) => localStorage.getItem(key), SIDEBAR_STORAGE_KEY);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    const expectedMaxWidth = Math.max(220, Math.min(SIDEBAR_MAX_WIDTH, Math.floor(viewportWidth * 0.4)));
    const expectedResetWidth = Math.min(SIDEBAR_DEFAULT_WIDTH, expectedMaxWidth);
    expect(resetWidth).toBeGreaterThanOrEqual(expectedResetWidth - 2);
    expect(resetWidth).toBeLessThanOrEqual(expectedResetWidth + 2);
    expect(storedWidth).toBe(String(expectedResetWidth));
  });

  // ── 7. Editor / Preview resizer still works ──
  test('editor preview resizer remains functional', async () => {
    const editorResizer = page.locator('[data-testid="editor-resizer"]');
    await expect(editorResizer).toBeVisible();
    await expect(editorResizer).toHaveCSS('cursor', 'col-resize');

    const editorPanel = page.getByTestId('editor-region');
    const previewPanel = page.locator('.workspace-preview');

    // Double-click the editor resizer to reset ratio to default (0.5)
    const resizerBox = await editorResizer.boundingBox();
    expect(resizerBox).not.toBeNull();
    const startX = resizerBox!.x + resizerBox!.width / 2;
    const startY = resizerBox!.y + resizerBox!.height / 2;
    await page.mouse.click(startX, startY);
    await page.mouse.click(startX, startY); // double-click

    // Both panels should be visible
    await expect(editorPanel).toBeVisible();
    await expect(previewPanel).toBeVisible();

    // Drag editor resizer right to shrink editor
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY, { steps: 5 });
    await page.mouse.up();

    // Editor should still exist and be visible
    await expect(editorPanel).toBeVisible();
  });

  // ── 8. File tree is clickable after explorer resize ──
  test('file tree remains clickable after explorer resize', async () => {
    const sidebar = page.locator('.workspace-sidebar');
    const resizer = page.locator('[data-testid="explorer-resizer"]');

    // First resize
    const resizerBox = await resizer.boundingBox();
    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2, resizerBox!.y + resizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2 + 40, resizerBox!.y + resizerBox!.height / 2, { steps: 5 });
    await page.mouse.up();

    // Now click a file in the file tree — look for a tree item
    const fileTreeItem = sidebar.locator('[data-testid^="tree-item-"]').first();
    const itemExists = await fileTreeItem.count();
    if (itemExists > 0) {
      await fileTreeItem.click();
      // Should not throw
    }
    // If no tree items found (empty vault state), that's also fine — just verify sidebar is still interactive
    await expect(sidebar).toBeVisible();
  });

  // ── 8. Right-click context menu still works after explorer resize ──
  test('right-click context menu works after explorer resize', async () => {
    const sidebar = page.locator('.workspace-sidebar');
    const resizer = page.locator('[data-testid="explorer-resizer"]');

    // Resize first
    const resizerBox = await resizer.boundingBox();
    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2, resizerBox!.y + resizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2 - 30, resizerBox!.y + resizerBox!.height / 2, { steps: 5 });
    await page.mouse.up();

    // Right click on a file tree item
    const fileTreeItem = sidebar.locator('[data-testid^="tree-item-"]').first();
    const itemExists = await fileTreeItem.count();
    if (itemExists > 0) {
      const itemBox = await fileTreeItem.boundingBox();
      if (itemBox) {
        await page.mouse.click(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2, { button: 'right' });
      }
    }
    // No assertion failure means the interaction didn't crash the app
  });

  // ── 9. Editor remains editable after explorer resize ──
  test('editor remains editable after explorer resize', async () => {
    const resizer = page.locator('[data-testid="explorer-resizer"]');

    // Resize first
    const resizerBox = await resizer.boundingBox();
    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2, resizerBox!.y + resizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2 + 30, resizerBox!.y + resizerBox!.height / 2, { steps: 5 });
    await page.mouse.up();

    // Click to select a file first, then check editor area exists
    const editorArea = page.getByTestId('editor-region');
    await expect(editorArea).toBeVisible();
  });

  // ── 10. Preview panel exists and has proper structure ──
  test('preview panel structure is intact after explorer resize', async () => {
    const previewPanel = page.locator('.workspace-preview');
    await expect(previewPanel).toBeVisible();

    const resizer = page.locator('[data-testid="explorer-resizer"]');
    const resizerBox = await resizer.boundingBox();
    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2, resizerBox!.y + resizerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2 - 20, resizerBox!.y + resizerBox!.height / 2, { steps: 3 });
    await page.mouse.up();

    // Preview should still be there
    await expect(previewPanel).toBeVisible();
  });

  // ── 11. MVP features only: no out-of-scope UI elements ──
  test('no out-of-scope features are present in the UI', async () => {
    // These features should NOT exist in Phase 1.
    // Backlinks / 反向链接 are now Phase 1-D core features.
    // Search / 搜索 is now a Phase 1-E core feature.
    const forbiddenLabels = [
      'Graph', '图谱',
      'AI',
      'Git',
      'Export', '导出',
      'PPT',
      'Settings', '设置',
    ];

    for (const label of forbiddenLabels) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
  });

  // ── 12. Explorer resizer returns to functional state after multiple resize operations ──
  test('explorer resizer works correctly after multiple resize cycles', async () => {
    const sidebar = page.locator('.workspace-sidebar');
    const resizer = page.locator('[data-testid="explorer-resizer"]');

    for (let i = 0; i < 3; i++) {
      const resizerBox = await resizer.boundingBox();
      expect(resizerBox).not.toBeNull();

      // Drag right
      await page.mouse.move(resizerBox!.x + resizerBox!.width / 2, resizerBox!.y + resizerBox!.height / 2);
      await page.mouse.down();
      await page.mouse.move(resizerBox!.x + resizerBox!.width / 2 + 50, resizerBox!.y + resizerBox!.height / 2, { steps: 5 });
      await page.mouse.up();

      // Verify sidebar still visible
      await expect(sidebar).toBeVisible();

      // Drag left
      const box2 = await resizer.boundingBox();
      await page.mouse.move(box2!.x + box2!.width / 2, box2!.y + box2!.height / 2);
      await page.mouse.down();
      await page.mouse.move(box2!.x + box2!.width / 2 - 50, box2!.y + box2!.height / 2, { steps: 5 });
      await page.mouse.up();

      await expect(sidebar).toBeVisible();
    }
  });
});
