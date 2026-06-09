/**
 * Menu Platform Differences Test — Phase 5-3-IMP.
 *
 * TB-MENU-114: macOS/Windows/Linux differences, DevTools dev-only.
 */
import { describe, it, expect } from 'vitest';
import { buildMenuTemplate } from '../../../electron/menu/menu-template';
import { createMenuDispatcher } from '../../../electron/menu/menu-action-dispatcher';
import type { BrowserWindow } from 'electron';

function makeFakeWin(): BrowserWindow {
  return { webContents: { send: () => {} } } as unknown as BrowserWindow;
}

describe('menu-platform-differences (P1)', () => {
  const dispatcher = createMenuDispatcher(makeFakeWin());

  it('TB-MENU-114: all required menus should be present', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: false,
      locale: 'zh-CN',
      dispatcher,
    });
    const labels = template.map((item) => item.label);
    // macOS has 12 (Schola + 10 standard + help with mac About), Windows/Linux has 11
    // All platforms must have these 10 standard menus:
    const requiredLabels = ['文件', '编辑', '视图', '知识库', 'AI Research', '图谱', 'Artifact', '导出', '设置', '帮助'];
    for (const label of requiredLabels) {
      expect(labels).toContain(label);
    }
  });

  it('DevTools is hidden in packaged mode (cross-platform)', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const viewMenu = template.find((item) => item.label === '视图');
    if (viewMenu?.submenu) {
      const devItem = (viewMenu.submenu as readonly Electron.MenuItemConstructorOptions[]).find(
        (c) => String(c.label ?? '').includes('开发者工具'),
      );
      if (devItem) {
        expect(devItem.enabled).toBe(false);
      }
    }
  });
});
