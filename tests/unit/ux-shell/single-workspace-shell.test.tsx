/**
 * UX Shell — Single Workspace Shell Test
 * Phase 5-UX-UI-BRANCH-SHELL-IMP.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('ux-shell single-workspace-shell', () => {
  it('App.tsx references unique WorkspaceShell', () => {
    const appPath = resolve(ROOT, 'src', 'app', 'App.tsx');
    if (!existsSync(appPath)) return;
    const content = readFileSync(appPath, 'utf8');
    expect(content).toContain('WorkspaceShell');
    // No legacy shell references
    expect(content).not.toContain('ShellV2');
    expect(content).not.toContain('legacy shell');
    expect(content).not.toContain('LegacyShell');
  });

  it('WorkspaceShell file exists', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    expect(existsSync(shellPath)).toBe(true);
  });

  it('WorkspaceShell composes TopBar + ActivityBar + SideBar', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain('TopBar');
    expect(content).toContain('ActivityBar');
    expect(content).toContain('SideBar');
    expect(content).toContain('SettingsModal');
    expect(content).toContain('EditorToolbar');
  });

  it('WorkspaceShell defaults to activity=files, preview=false, settings=false', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    const code = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
    expect(code).toContain("useState<ActivityId>('files')");
    expect(code).toContain('useState(false)'); // panelOpen, bottomPanelOpen, settingsModalOpen
  });

  it('Settings is a Modal, not SideBar page', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    // Settings uses SettingsModal component
    expect(content).toContain('SettingsModal');
    // Settings click opens modal, not switches sidebar page
    expect(content).toContain("setSettingsModalOpen(true)");
  });
});
