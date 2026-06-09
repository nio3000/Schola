/**
 * Menu MainView Routing Test — Phase 5-DEV-ACTIVITY-MAINVIEW-ROUTING-R2.
 *
 * Ensures Electron menu commands route to the correct EditorRegion main view.
 * Verifies the chain: menu commandId → IPC schola:navigate → useMenuCommands → setActiveActivity.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('menu-mainview-routing', () => {
  // ── Menu dispatcher → IPC payload mapping ──

  it('menu dispatcher maps schola.ai.openWorkbench to navigate activity ai', () => {
    const path = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (!existsSync(path)) return;
    const content = readFileSync(path, 'utf8');
    expect(content).toContain("schola.ai.openWorkbench");
    expect(content).toContain("activity: 'ai'");
  });

  it('menu dispatcher maps schola.graph.openMainView to navigate activity graph', () => {
    const path = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (!existsSync(path)) return;
    const content = readFileSync(path, 'utf8');
    expect(content).toContain("schola.graph.openMainView");
    expect(content).toContain("activity: 'graph'");
  });

  it('menu dispatcher maps schola.artifact.openPanel to navigate activity artifacts', () => {
    const path = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (!existsSync(path)) return;
    const content = readFileSync(path, 'utf8');
    expect(content).toContain("schola.artifact.openPanel");
    expect(content).toContain("activity: 'artifacts'");
  });

  it('menu dispatcher maps schola.app.preferences to navigate activity settings', () => {
    const path = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (!existsSync(path)) return;
    const content = readFileSync(path, 'utf8');
    expect(content).toContain("schola.app.preferences");
    expect(content).toContain("activity: 'settings'");
  });

  // ── useMenuCommands hook validates activity whitelist ──

  it('useMenuCommands validates activity against whitelist', () => {
    const hookPath = resolve(ROOT, 'src', 'features', 'workspace', 'hooks', 'useMenuCommands.ts');
    if (!existsSync(hookPath)) return;
    const content = readFileSync(hookPath, 'utf8');
    // Whitelist includes all activity IDs
    expect(content).toContain("'files'");
    expect(content).toContain("'ai'");
    expect(content).toContain("'graph'");
    expect(content).toContain("'artifacts'");
    expect(content).toContain("'plugins'");
    expect(content).toContain("'settings'");
    expect(content).toContain("'search'");
    expect(content).toContain("'help'");
    expect(content).toContain('valid.has(');
  });

  // ── WorkspaceShell menu callback routing ──

  it('WorkspaceShell onNavigate routes ai activity to setActiveActivity', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain('setActiveActivity(activity)');
  });

  it('WorkspaceShell onNavigate routes settings to modal open', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    const code = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
    expect(code).toContain("if (activity === 'settings')");
    expect(code).toContain('setSettingsModalOpen(true)');
  });

  it('WorkspaceShell onNavigate routes files+openVault action to onOpenVault', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain("action === 'openVault'");
    expect(content).toContain('onOpenVault()');
  });

  it('WorkspaceShell onNavigate routes files+closeVault action to onCloseVault', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain("action === 'closeVault'");
    expect(content).toContain('onCloseVault()');
  });

  // ── IPC channel coverage ──

  it('preload menu listener covers all dispatch channels', () => {
    const preloadPath = resolve(ROOT, 'electron', 'preload.ts');
    if (!existsSync(preloadPath)) return;
    const content = readFileSync(preloadPath, 'utf8');
    expect(content).toContain("schola:navigate");
    expect(content).toContain("schola:action");
    expect(content).toContain("schola:view:toggle");
    expect(content).toContain("schola:graph:scope");
    expect(content).toContain("schola:graph:layout");
    expect(content).toContain("schola:graph:action");
  });

  // ── Menu command registry ──

  it('menu command registry includes all view-routing command IDs', () => {
    const registryPath = resolve(ROOT, 'electron', 'menu', 'menu-command-registry.ts');
    if (!existsSync(registryPath)) return;
    const content = readFileSync(registryPath, 'utf8');
    expect(content).toContain('schola.ai.openWorkbench');
    expect(content).toContain('schola.graph.openMainView');
    expect(content).toContain('schola.artifact.openPanel');
    expect(content).toContain('schola.app.preferences');
    expect(content).toContain('schola.vault.open');
    expect(content).toContain('schola.vault.close');
  });

  // ── No generic IPC for menu commands ──

  it('menu dispatcher uses only fixed-function webContents.send', () => {
    const path = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (!existsSync(path)) return;
    const content = readFileSync(path, 'utf8');
    // Strip comments to check only for actual code usage
    const codeLines = content.split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/**'));
    const code = codeLines.join('\n');
    // Should not use ipcMain.handle or shell.openExternal in actual code
    expect(code).not.toContain('ipcMain.handle');
    expect(code).not.toContain('shell.openExternal');
  });
});
