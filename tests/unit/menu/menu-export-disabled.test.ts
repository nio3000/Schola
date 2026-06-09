/**
 * Menu Export Disabled Test — Phase 5-3-IMP.
 *
 * TB-MENU-008, 020: Export menu items must all be disabled.
 */
import { describe, it, expect } from 'vitest';
import { buildMenuTemplate } from '../../../electron/menu/menu-template';
import { createMenuDispatcher } from '../../../electron/menu/menu-action-dispatcher';
import type { BrowserWindow } from 'electron';

function makeFakeWin(): BrowserWindow {
  return { webContents: { send: () => {} } } as unknown as BrowserWindow;
}

describe('menu-export-disabled (P0)', () => {
  const dispatcher = createMenuDispatcher(makeFakeWin());

  it('TB-MENU-008: all export menu items should be disabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const exportMenu = template.find((item) => item.label === '导出');
    expect(exportMenu).toBeDefined();

    if (exportMenu?.submenu) {
      const items = exportMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      for (const item of items) {
        if (item.type === 'separator') continue;
        expect(item.enabled).toBe(false);
      }
    }
  });

  it('TB-MENU-020: Export menu in English should also be disabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'en',
      dispatcher,
    });
    const exportMenu = template.find((item) => item.label === 'Export');
    expect(exportMenu).toBeDefined();

    if (exportMenu?.submenu) {
      const items = exportMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      for (const item of items) {
        if (item.type === 'separator') continue;
        expect(item.enabled).toBe(false);
      }
    }
  });

  it('Artifact saveToVault and exportArtifact should be disabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const artifactMenu = template.find((item) => item.label === 'Artifact');
    if (artifactMenu?.submenu) {
      const items = artifactMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      const saveItem = items.find((c) => String(c.label ?? '').includes('保存到 Vault'));
      const exportItem = items.find((c) => String(c.label ?? '').includes('导出 Artifact'));
      expect(saveItem?.enabled).toBe(false);
      expect(exportItem?.enabled).toBe(false);
    }
  });
});
