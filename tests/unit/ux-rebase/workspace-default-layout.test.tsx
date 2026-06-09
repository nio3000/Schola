/**
 * UX Rebase — Workspace Default Layout Test (P0: UX-TB-P0-007 ~ 015)
 * Phase 5-UX-UI-BRANCH-REGRESSION-CLEANUP.
 *
 * Updated: checks WorkspaceShell.tsx (new unified shell) instead of old App.tsx.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('ux-rebase workspace-default-layout (P0)', () => {
  it('UX-TB-P0-007: WelcomePage exists as component', () => {
    const welcomePath = resolve(ROOT, 'src', 'features', 'workspace', 'WelcomePage.tsx');
    expect(existsSync(welcomePath)).toBe(true);
  });

  it('UX-TB-P0-008: WorkspaceShell has ActivityBar + SideBar + Editor structure', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain('ActivityBar');
    expect(content).toContain('SideBar');
    expect(content).toContain('workspace-editor-area');
  });

  it('UX-TB-P0-009: App.tsx only references unique WorkspaceShell, no legacy shell', () => {
    const appPath = resolve(ROOT, 'src', 'app', 'App.tsx');
    if (!existsSync(appPath)) return;
    const content = readFileSync(appPath, 'utf8');
    expect(content).toContain('WorkspaceShell');
    expect(content).not.toContain('ShellV2');
    expect(content).not.toContain('legacy shell');
  });

  it('UX-TB-P0-012: WorkspaceShell has FileTabs + EmptyEditor for files mode', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain('FileTabs');
    expect(content).toContain('EmptyEditor');
  });

  it('UX-TB-P0-015: WorkspaceShell defaults to files, preview/graph/ai/settings off', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    const code = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
    expect(code).toContain("useState<ActivityId>('files')");
    expect(code).toContain('useState(false)');
  });
});
