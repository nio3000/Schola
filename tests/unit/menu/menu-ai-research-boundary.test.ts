/**
 * Menu AI Research Boundary Test — Phase 5-3-IMP.
 *
 * TB-MENU-015, 017, 018, 113: AI Research menu security boundaries.
 */
import { describe, it, expect } from 'vitest';
import { buildMenuTemplate } from '../../../electron/menu/menu-template';
import { createMenuDispatcher } from '../../../electron/menu/menu-action-dispatcher';
import type { BrowserWindow } from 'electron';

function makeFakeWin(): BrowserWindow {
  return { webContents: { send: () => {} } } as unknown as BrowserWindow;
}

describe('menu-ai-research-boundary (P0+P1)', () => {
  const dispatcher = createMenuDispatcher(makeFakeWin());

  it('TB-MENU-113: runCurrentTask should be disabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const aiMenu = template.find((item) => item.label === 'AI Research');
    expect(aiMenu).toBeDefined();
    if (aiMenu?.submenu) {
      const runItem = (aiMenu.submenu as readonly Electron.MenuItemConstructorOptions[]).find(
        (c) => String(c.label ?? '').includes('运行当前任务'),
      );
      expect(runItem).toBeDefined();
      expect(runItem?.enabled).toBe(false);
    }
  });

  it('cancelCurrentTask should be disabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const aiMenu = template.find((item) => item.label === 'AI Research');
    if (aiMenu?.submenu) {
      const cancelItem = (aiMenu.submenu as readonly Electron.MenuItemConstructorOptions[]).find(
        (c) => String(c.label ?? '').includes('取消当前任务'),
      );
      expect(cancelItem).toBeDefined();
      expect(cancelItem?.enabled).toBe(false);
    }
  });

  it('configureProvider should be enabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const aiMenu = template.find((item) => item.label === 'AI Research');
    if (aiMenu?.submenu) {
      const configItem = (aiMenu.submenu as readonly Electron.MenuItemConstructorOptions[]).find(
        (c) => String(c.label ?? '').includes('配置 Provider'),
      );
      expect(configItem).toBeDefined();
      expect(configItem?.enabled).toBe(true);
    }
  });

  it('openWorkbench should be enabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const aiMenu = template.find((item) => item.label === 'AI Research');
    if (aiMenu?.submenu) {
      const openItem = (aiMenu.submenu as readonly Electron.MenuItemConstructorOptions[]).find(
        (c) => String(c.label ?? '').includes('打开 AI Research Workbench'),
      );
      expect(openItem).toBeDefined();
      expect(openItem?.enabled).toBe(true);
    }
  });
});
