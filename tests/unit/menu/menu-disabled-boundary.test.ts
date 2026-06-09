/**
 * Menu Disabled Boundary Test — Phase 5-3-IMP.
 *
 * TB-MENU-008, 009, 104: Disabled menu items stay disabled in packaged mode.
 */
import { describe, it, expect } from 'vitest';
import { buildMenuTemplate } from '../../../electron/menu/menu-template';
import { createMenuDispatcher } from '../../../electron/menu/menu-action-dispatcher';
import type { BrowserWindow } from 'electron';

function makeFakeWin(): BrowserWindow {
  return { webContents: { send: () => {} } } as unknown as BrowserWindow;
}

describe('menu-disabled-boundary (P0)', () => {
  const dispatcher = createMenuDispatcher(makeFakeWin());

  function collectDisabled(template: Electron.MenuItemConstructorOptions[]): string[] {
    const result: string[] = [];
    for (const top of template) {
      if (top.submenu && Array.isArray(top.submenu)) {
        for (const child of top.submenu as readonly Electron.MenuItemConstructorOptions[]) {
          if (child.type === 'separator') continue;
          if (child.enabled === false) {
            result.push(String(child.label ?? ''));
          }
        }
      }
    }
    return result;
  }

  it('TB-MENU-008: export menu items should all be disabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const exportMenu = template.find((item) => item.label === '导出');
    expect(exportMenu).toBeDefined();
    if (exportMenu?.submenu) {
      for (const child of exportMenu.submenu as readonly Electron.MenuItemConstructorOptions[]) {
        if (child.type === 'separator') continue;
        expect(child.enabled).toBe(false);
      }
    }
  });

  it('TB-MENU-009: AI Research runCurrentTask should be disabled', () => {
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
      if (runItem) {
        expect(runItem.enabled).toBe(false);
      }
    }
  });

  it('TB-MENU-008: DevTools should be hidden in packaged mode', () => {
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

  it('DevTools should be enabled in dev mode', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: false,
      locale: 'zh-CN',
      dispatcher,
    });
    const viewMenu = template.find((item) => item.label === '视图');
    if (viewMenu?.submenu) {
      const devItem = (viewMenu.submenu as readonly Electron.MenuItemConstructorOptions[]).find(
        (c) => String(c.label ?? '').includes('开发者工具'),
      );
      if (devItem) {
        expect(devItem.enabled).toBe(true);
      }
    }
  });
});
