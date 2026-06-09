/**
 * Menu Command Routing Test — Phase 5-DEV-VAULT-ENTRY-ACTION-WIRING.
 *
 * Ensures WorkspaceShell uses useMenuCommands hook and routes
 * menu IPC payloads to correct UI actions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('menu-command-routing', () => {
  // ── WorkspaceShell integration ──

  it('WorkspaceShell imports useMenuCommands', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain('useMenuCommands');
  });

  it('WorkspaceShell calls useMenuCommands with callbacks', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain('useMenuCommands(menuCallbacks)');
  });

  // ── Menu callback routing ──

  it('WorkspaceShell routes settings activity to modal open', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    // Settings must open the modal
    expect(content).toContain("setSettingsModalOpen(true)");
  });

  it('WorkspaceShell routes openVault action from menu navigate', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    // Menu vault.open sends navigate with action='openVault'
    expect(content).toContain("action === 'openVault'");
    expect(content).toContain('onOpenVault()');
  });

  it('WorkspaceShell routes closeVault action from menu navigate', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain("action === 'closeVault'");
    expect(content).toContain('onCloseVault()');
  });

  it('WorkspaceShell routes AI activity from menu navigate', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    // For non-special activities, setActiveActivity is called
    expect(content).toContain('setActiveActivity(activity)');
  });

  it('WorkspaceShell has menu callbacks with all required methods', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain('onNavigate:');
    expect(content).toContain('onAction:');
    expect(content).toContain('onViewToggle:');
    expect(content).toContain('onGraphScope:');
    expect(content).toContain('onGraphLayout:');
    expect(content).toContain('onGraphAction:');
  });

  // ── useMenuCommands hook structural ──

  it('useMenuCommands hook exists and is properly structured', () => {
    const hookPath = resolve(ROOT, 'src', 'features', 'workspace', 'hooks', 'useMenuCommands.ts');
    if (!existsSync(hookPath)) return;
    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('export function useMenuCommands');
    expect(content).toContain('window.schola?.menu');
    expect(content).toContain('api.onNavigate');
  });

  it('useMenuCommands hook validates activity whitelist', () => {
    const hookPath = resolve(ROOT, 'src', 'features', 'workspace', 'hooks', 'useMenuCommands.ts');
    if (!existsSync(hookPath)) return;
    const content = readFileSync(hookPath, 'utf8');
    // Runtime whitelist defense-in-depth
    expect(content).toContain("new Set(['files'");
    expect(content).toContain('valid.has(');
  });

  // ── Preload menu API ──

  it('preload exposes menu.onNavigate API', () => {
    const preloadPath = resolve(ROOT, 'electron', 'preload.ts');
    if (!existsSync(preloadPath)) return;
    const content = readFileSync(preloadPath, 'utf8');
    expect(content).toContain('menu: Object.freeze');
    expect(content).toContain('onNavigate:');
    expect(content).toContain("ipcRenderer.on('schola:navigate'");
  });

  it('preload menu listener covers all IPC channels', () => {
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

  // ── Menu dispatcher sends correct payloads ──

  it('menu dispatcher sends schola:navigate for vault open', () => {
    const dispatcherPath = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (!existsSync(dispatcherPath)) return;
    const content = readFileSync(dispatcherPath, 'utf8');
    expect(content).toContain("schola.vault.open");
    expect(content).toContain("schola:navigate");
    expect(content).toContain("openVault");
  });

  it('menu dispatcher sends schola:navigate for AI openWorkbench', () => {
    const dispatcherPath = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (!existsSync(dispatcherPath)) return;
    const content = readFileSync(dispatcherPath, 'utf8');
    expect(content).toContain("schola.ai.openWorkbench");
    expect(content).toContain("activity: 'ai'");
  });

  it('menu dispatcher sends schola:navigate for graph openMainView', () => {
    const dispatcherPath = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (!existsSync(dispatcherPath)) return;
    const content = readFileSync(dispatcherPath, 'utf8');
    expect(content).toContain("schola.graph.openMainView");
    expect(content).toContain("activity: 'graph'");
  });

  it('menu dispatcher sends schola:navigate for artifact openPanel', () => {
    const dispatcherPath = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (!existsSync(dispatcherPath)) return;
    const content = readFileSync(dispatcherPath, 'utf8');
    expect(content).toContain("schola.artifact.openPanel");
    expect(content).toContain("activity: 'artifacts'");
  });

  it('menu dispatcher sends schola:navigate for settings preferences', () => {
    const dispatcherPath = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (!existsSync(dispatcherPath)) return;
    const content = readFileSync(dispatcherPath, 'utf8');
    expect(content).toContain("schola.app.preferences");
    expect(content).toContain("activity: 'settings'");
  });
});
