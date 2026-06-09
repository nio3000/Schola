/**
 * Menu i18n Labels Test — Phase 5-3-IMP.
 *
 * TB-MENU-201, 202, 203, 204: Chinese default, English fallback, locale fallback.
 */
import { describe, it, expect } from 'vitest';
import { getMenuLabels } from '../../../electron/menu/menu-labels';

describe('menu-i18n-labels (P2)', () => {
  it('TB-MENU-201: should have complete zh-CN labels', () => {
    const labels = getMenuLabels('zh-CN');
    expect(labels.schola.about).toBe('关于 Schola');
    expect(labels.file.openVault).toBe('打开 Vault…');
    expect(labels.edit.undo).toBe('撤销');
    expect(labels.help.thirdPartyNotices).toBe('许可证与第三方声明');
  });

  it('TB-MENU-202: should have complete en fallback labels', () => {
    const labels = getMenuLabels('en');
    expect(labels.schola.about).toBe('About Schola');
    expect(labels.file.openVault).toBe('Open Vault…');
    expect(labels.edit.undo).toBe('Undo');
  });

  it('TB-MENU-203: unknown locale should fallback to zh-CN', () => {
    const labels = getMenuLabels('fr');
    expect(labels.schola.about).toBe('关于 Schola');
  });

  it('null/undefined locale should fallback to zh-CN', () => {
    expect(getMenuLabels(null).schola.about).toBe('关于 Schola');
    expect(getMenuLabels(undefined).schola.about).toBe('关于 Schola');
  });

  it('all label groups should be present', () => {
    const labels = getMenuLabels('zh-CN');
    expect(labels.schola).toBeDefined();
    expect(labels.file).toBeDefined();
    expect(labels.edit).toBeDefined();
    expect(labels.view).toBeDefined();
    expect(labels.knowledge).toBeDefined();
    expect(labels.aiResearch).toBeDefined();
    expect(labels.graph).toBeDefined();
    expect(labels.artifact).toBeDefined();
    expect(labels.export).toBeDefined();
    expect(labels.settings).toBeDefined();
    expect(labels.help).toBeDefined();
  });
});
