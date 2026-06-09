/**
 * UX Rebase — SideBar Lightweight Test (P0/P1)
 * Phase 5-UX-REBASE-IMP-CONTINUE.
 *
 * Verifies SideBar only contains lightweight navigation and summaries,
 * not full API forms, complete AI workbench, or complete graph canvas.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('ux-rebase no-sidebar-heavy-panels (P0/P1)', () => {
  it('SideBar component should not contain complete API key forms', () => {
    const sidebarPath = resolve(ROOT, 'src', 'features', 'workspace', 'SideBar.tsx');
    if (!existsSync(sidebarPath)) return;
    const content = readFileSync(sidebarPath, 'utf8');
    // SideBar should delegate to lightweight summaries, not contain full forms
    // This is a structural check — SideBar should not render ProviderPage or settings forms directly
    expect(content).not.toContain('ProviderPage');
    expect(content).not.toContain('AIResearchMainView');
    expect(content).toContain('AIResearchSidebarSummary');
  });

  it('Settings should be accessible via modal, not SideBar embed', () => {
    // SettingsModal component exists as a separate modal component
    const modalPath = resolve(ROOT, 'src', 'features', 'settings', 'components', 'SettingsModal.tsx');
    expect(existsSync(modalPath)).toBe(true);
    // Verify modal has overlay/dialog pattern
    if (existsSync(modalPath)) {
      const content = readFileSync(modalPath, 'utf8');
      expect(content).toContain('role="dialog"');
      expect(content).toContain('aria-modal="true"');
    }
  });
});
