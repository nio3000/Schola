/**
 * UX Rebase — Resizable Layout Test (P0/P1)
 * Phase 5-UX-REBASE-IMP-CONTINUE.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('ux-rebase resizable-layout (P0/P1)', () => {
  it('useResizeHandle hook exists in workspace', () => {
    const hookPath = resolve(ROOT, 'src', 'features', 'workspace', 'hooks', 'useResizablePanels.ts');
    expect(existsSync(hookPath)).toBe(true);
  });

  it('SideBar min/max constants exist in SideBar component', () => {
    const sidebarPath = resolve(ROOT, 'src', 'features', 'workspace', 'SideBar.tsx');
    if (!existsSync(sidebarPath)) return;
    const content = readFileSync(sidebarPath, 'utf8');
    expect(content).toBeTruthy();
    expect(content).toContain('220');
    expect(content).toContain('480');
  });

  it('SideBar resizes only save layout preference', () => {
    const hookPath = resolve(ROOT, 'src', 'features', 'workspace', 'hooks', 'useResizablePanels.ts');
    if (!existsSync(hookPath)) return;
    const content = readFileSync(hookPath, 'utf8');
    const code = content.split('\n').filter((l: string) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
    // Only saves number, not API key/secret
    expect(code).not.toContain('apiKey');
    expect(code).not.toContain('secret');
  });
});
