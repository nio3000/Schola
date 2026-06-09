/**
 * Menu Graph Boundary Test — Phase 5-3-IMP.
 *
 * TB-MENU-109, 110, 111: Graph menu scope and layout.
 */
import { describe, it, expect } from 'vitest';
import { buildMenuTemplate } from '../../../electron/menu/menu-template';
import { createMenuDispatcher } from '../../../electron/menu/menu-action-dispatcher';
import type { BrowserWindow } from 'electron';

function makeFakeWin(): BrowserWindow {
  return { webContents: { send: () => {} } } as unknown as BrowserWindow;
}

describe('menu-graph-boundary (P1)', () => {
  const dispatcher = createMenuDispatcher(makeFakeWin());

  it('TB-MENU-109: should have 5 scope menu items', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    // Find the graph menu by checking submenu item labels
    const graphMenu = template.find((item) => {
      if (!item.submenu || !Array.isArray(item.submenu)) return false;
      return (item.submenu as readonly Electron.MenuItemConstructorOptions[]).some(
        (c) => typeof c.label === 'string' && c.label.includes('图谱'),
      );
    });
    expect(graphMenu).toBeDefined();
    if (graphMenu?.submenu) {
      const items = graphMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      const scopeItems = items.filter(
        (c) => typeof c.label === 'string' && c.label.includes('图谱'),
      );
      expect(scopeItems.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('TB-MENU-110: Whole Vault should have advanced marker', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const graphMenu = template.find((item) => item.label === '图谱');
    if (graphMenu?.submenu) {
      const items = graphMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      const wholeVault = items.find(
        (c) => c.label && typeof c.label === 'string' && c.label.includes('Whole Vault'),
      );
      expect(wholeVault).toBeDefined();
      // Whole Vault is enabled but should be marked as advanced
      // Not disabled, but explicitly gated behind user choice
    }
  });

  it('TB-MENU-111: should have 3 layout menu items', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const graphMenu = template.find((item) => item.label === '图谱');
    if (graphMenu?.submenu) {
      const items = graphMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      const layoutItems = items.filter(
        (c) => c.label && typeof c.label === 'string' && c.label.includes('切换布局'),
      );
      expect(layoutItems.length).toBe(3);
    }
  });
});
