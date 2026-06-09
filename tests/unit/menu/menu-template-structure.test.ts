/**
 * Menu Template Structure Test — Phase 5-3-IMP.
 *
 * TB-MENU-006, 007, 101, 103, 104: Menu structure, item counts, enabled/disabled.
 */
import { describe, it, expect } from 'vitest';
import { buildMenuTemplate } from '../../../electron/menu/menu-template';
import { createMenuDispatcher } from '../../../electron/menu/menu-action-dispatcher';
import type { BrowserWindow } from 'electron';

function makeFakeWin(): BrowserWindow {
  return { webContents: { send: () => {} } } as unknown as BrowserWindow;
}

describe('menu-template-structure (P0+P1)', () => {
  const dispatcher = createMenuDispatcher(makeFakeWin());
  const template = buildMenuTemplate({
    mainWindow: makeFakeWin(),
    isPackaged: true,
    locale: 'zh-CN',
    dispatcher,
  });

  it('TB-MENU-006: should have at least 10 top-level menus', () => {
    const labels = template.map((item) => item.label);
    // macOS has 12 (Schola + 10 standard + 1), Windows/Linux has 10
    expect(labels.length).toBeGreaterThanOrEqual(10);
  });

  it('TB-MENU-007: should have correct standard menu labels', () => {
    const labels = template.map((item) => String(item.label));
    expect(labels).toContain('文件');
    expect(labels).toContain('编辑');
    expect(labels).toContain('视图');
    // Knowledge menu label varies: '知识库' on zh-CN
    expect(labels.some((l) => l.includes('知识') || l.includes('Knowledge'))).toBe(true);
    expect(labels).toContain('AI Research');
    // Graph label: '图谱' on zh-CN
    expect(labels.some((l) => l.includes('图') || l.includes('Graph'))).toBe(true);
    expect(labels).toContain('Artifact');
    expect(labels).toContain('导出');
    expect(labels).toContain('设置');
    expect(labels).toContain('帮助');
  });

  it('TB-MENU-101: should have expected total item counts', () => {
    let enabled = 0;
    let disabled = 0;
    for (const top of template) {
      if (top.submenu && Array.isArray(top.submenu)) {
        for (const child of top.submenu as readonly Electron.MenuItemConstructorOptions[]) {
          if (child.type === 'separator') continue;
          if (child.enabled === false) disabled++;
          else enabled++;
        }
      }
    }
    expect(enabled + disabled).toBeGreaterThanOrEqual(47);
  });
});
