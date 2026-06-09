/**
 * Menu Third-Party Notices Entry Test — Phase 5-3-IMP.
 *
 * TB-MENU-008: Help menu entries, About, THIRD_PARTY_NOTICES.
 */
import { describe, it, expect } from 'vitest';
import { buildMenuTemplate } from '../../../electron/menu/menu-template';
import { createMenuDispatcher } from '../../../electron/menu/menu-action-dispatcher';
import type { BrowserWindow } from 'electron';

function makeFakeWin(): BrowserWindow {
  return { webContents: { send: () => {} } } as unknown as BrowserWindow;
}

describe('menu-third-party-notices-entry (P1)', () => {
  const dispatcher = createMenuDispatcher(makeFakeWin());

  it('Help menu should have thirdPartyNotices item enabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const helpMenu = template.find((item) => item.label === '帮助');
    expect(helpMenu).toBeDefined();
    if (helpMenu?.submenu) {
      const items = helpMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      const noticeItem = items.find((c) => String(c.label ?? '').includes('许可证'));
      expect(noticeItem).toBeDefined();
      expect(noticeItem?.enabled).toBe(true);
    }
  });

  it('Help menu should have About item enabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const helpMenu = template.find((item) => item.label === '帮助');
    if (helpMenu?.submenu) {
      const items = helpMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      const aboutItem = items.find((c) => String(c.label ?? '').includes('关于'));
      expect(aboutItem).toBeDefined();
      expect(aboutItem?.enabled).toBe(true);
    }
  });

  it('Help menu reportIssue should be disabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const helpMenu = template.find((item) => item.label === '帮助');
    if (helpMenu?.submenu) {
      const items = helpMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      const reportItem = items.find((c) => String(c.label ?? '').includes('报告问题'));
      expect(reportItem?.enabled).toBe(false);
    }
  });

  it('Help menu showHelp should be disabled', () => {
    const template = buildMenuTemplate({
      mainWindow: makeFakeWin(),
      isPackaged: true,
      locale: 'zh-CN',
      dispatcher,
    });
    const helpMenu = template.find((item) => item.label === '帮助');
    if (helpMenu?.submenu) {
      const items = helpMenu.submenu as readonly Electron.MenuItemConstructorOptions[];
      const helpItem = items.find((c) => String(c.label ?? '').includes('Schola 帮助'));
      expect(helpItem?.enabled).toBe(false);
    }
  });
});
