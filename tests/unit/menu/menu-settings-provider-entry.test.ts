/**
 * Menu Settings / Provider Center Entry Test — Phase 5-3-IMP.
 *
 * TB-MENU-105, 106: Settings and Provider Center menu entries.
 */
import { describe, it, expect } from 'vitest';
import { buildMenuTemplate } from '../../../electron/menu/menu-template';
import { createMenuDispatcher } from '../../../electron/menu/menu-action-dispatcher';
import type { BrowserWindow } from 'electron';

function makeFakeWin(): BrowserWindow {
  return { webContents: { send: () => {} } } as unknown as BrowserWindow;
}

describe('menu-settings-provider-entry (P1)', () => {
  const dispatcher = createMenuDispatcher(makeFakeWin());

  it('TB-MENU-105: Settings menu should have openCenter item enabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const settingsMenu = template.find((item) => item.label === '设置');
    expect(settingsMenu).toBeDefined();
    if (settingsMenu?.submenu) {
      const items = settingsMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      const openItem = items.find((c) => String(c.label ?? '').includes('打开设置中心'));
      expect(openItem).toBeDefined();
      expect(openItem?.enabled).toBe(true);
    }
  });

  it('TB-MENU-106: Settings menu should have Provider Center item enabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const settingsMenu = template.find((item) => item.label === '设置');
    if (settingsMenu?.submenu) {
      const items = settingsMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      const providerItem = items.find((c) => String(c.label ?? '').includes('Provider Center'));
      expect(providerItem).toBeDefined();
      expect(providerItem?.enabled).toBe(true);
    }
  });

  it('Vault settings and Keybindings should be disabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const settingsMenu = template.find((item) => item.label === '设置');
    if (settingsMenu?.submenu) {
      const items = settingsMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      const vaultItem = items.find((c) => String(c.label ?? '').includes('Vault 设置'));
      const kbItem = items.find((c) => String(c.label ?? '').includes('快捷键设置'));
      expect(vaultItem?.enabled).toBe(false);
      expect(kbItem?.enabled).toBe(false);
    }
  });
});
