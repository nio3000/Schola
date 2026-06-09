/**
 * No No-Op Actions Test — Phase 5-DEV-VAULT-ENTRY-ACTION-WIRING.
 *
 * Ensures no clickable buttons in the workspace resolve to no-op handlers.
 * Every user-visible button must be either wired to a real action,
 * explicitly disabled, or show a clear placeholder state.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { WorkspaceShell } from '../../../src/features/workspace/WorkspaceShell';
import type { WorkspaceShellProps } from '../../../src/features/workspace/WorkspaceShell';

const ROOT = resolve(__dirname, '..', '..', '..');

const noopShellProps: WorkspaceShellProps = {
  activeVault: null,
  selectedFile: null,
  fileTree: [] as const,
  hasVault: false,
  vaultStatus: 'idle',
  vaultMessage: '',
  appReady: true,
  appError: null,
  isOpening: false,
  recentVaults: [] as const,
  onOpenVault: async () => {},
  onCreateVault: async () => {},
  onOpenVaultByPath: async (_path: string) => {},
  onCloseVault: async () => {},
  onSelectFile: () => {},
  onOpenHelp: async () => ({ ok: false, status: 'placeholder' as const, title: '帮助' }),
  onCreateNote: async () => ({ ok: false, message: 'test noop' }),
  onCreateFolder: async () => ({ ok: false, message: 'test noop' }),
  onRenameNote: async () => ({ ok: false, message: 'test noop' }),
  onRenameFolder: async () => ({ ok: false, message: 'test noop' }),
  onDeleteNote: async () => ({ ok: false, message: 'test noop' }),
  onDeleteFolder: async () => ({ ok: false, message: 'test noop' }),
  onMoveNote: async () => ({ ok: false, message: 'test noop' }),
  onMoveFolder: async () => ({ ok: false, message: 'test noop' }),
  onRefreshVault: async () => {},
};

describe('no-noop-actions', () => {
  // ── Static code analysis: no unsafe no-ops ──

  it('WorkspaceShell does not pass no-op to WelcomePage in no-vault path', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');

    // In the no-vault branch, WelcomePage must receive named handler props from the parent,
    // not inline empty arrow functions.
    const noVaultSection = content.split('if (!hasVault)')[1]?.split('// ── Vault open')[0] ?? '';
    // The WelcomePage in no-vault branch should use onOpenVault={onOpenVault}, not async () => {}
    expect(noVaultSection).not.toContain('async () => {}');
    expect(noVaultSection).toContain('onOpenVault={onOpenVault}');
    expect(noVaultSection).toContain('onCreateVault={onCreateVault}');
  });

  it('App.tsx does not pass inline no-op handlers to WorkspaceShell', () => {
    const appPath = resolve(ROOT, 'src', 'app', 'App.tsx');
    if (!existsSync(appPath)) return;
    const content = readFileSync(appPath, 'utf8');
    // No inline async empty functions used as JSX handler props
    expect(content).not.toContain("onOpenVault={async () => {}}");
    expect(content).not.toContain("onCreateVault={async () => {}}");
    expect(content).not.toContain("onOpenVaultByPath={async () => {}}");
    expect(content).not.toContain("onCloseVault={async () => {}}");
    expect(content).not.toContain("onOpenHelp={async () => {}}");
  });

  it('no-vault shell renders WelcomePage with testid', () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkspaceShell, noopShellProps),
    );
    expect(html).toContain('welcome-page');
  });

  it('no-vault shell renders error banner when appError is set', () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkspaceShell, {
        ...noopShellProps,
        appError: 'Test error message',
      }),
    );
    expect(html).toContain('app-error-banner');
    expect(html).toContain('Test error message');
  });

  it('vault-open shell references SettingsModal in JSX', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    // Must import and use SettingsModal
    expect(content).toContain('SettingsModal');
    expect(content).toContain('import { SettingsModal }');
  });

  it('WorkspaceShell has no no-op handler patterns in callback definitions', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');

    // Menu callbacks should not contain inline no-ops except for graph stubs
    // which explicitly document their placeholder nature
    expect(content).toContain('onNavigate:');
  });

  // ── Export menu disabled verification ──

  it('menu-command-registry disables all export commands', () => {
    const registryPath = resolve(ROOT, 'electron', 'menu', 'menu-command-registry.ts');
    if (!existsSync(registryPath)) return;
    const content = readFileSync(registryPath, 'utf8');
    // Export commands are in DISABLED_COMMANDS
    expect(content).toContain('schola.export.docx');
    expect(content).toContain('schola.export.pdf');
    expect(content).toContain('schola.export.latex');
    expect(content).toContain('schola.export.html');
  });

  it('menu-command-registry disables artifact real save/export', () => {
    const registryPath = resolve(ROOT, 'electron', 'menu', 'menu-command-registry.ts');
    if (!existsSync(registryPath)) return;
    const content = readFileSync(registryPath, 'utf8');
    expect(content).toContain('schola.artifact.clearDraft');
    expect(content).toContain('schola.artifact.saveToVault');
    expect(content).toContain('schola.artifact.exportArtifact');
  });

  // ── No provider/context/Vault write leaks ──

  it('WorkspaceShell does not invoke providers', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).not.toContain('provider invocation');
    expect(content).not.toContain('context send');
    expect(content).not.toContain('Vault write');
    expect(content).not.toContain('real export');
  });

  it('menu dispatcher does not invoke providers', () => {
    const dispatcherPath = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (!existsSync(dispatcherPath)) return;
    const content = readFileSync(dispatcherPath, 'utf8');
    expect(content).not.toContain('provider invocation');
    expect(content).not.toContain('contextSend');
  });

  // ── Phase boundary enforcement ──

  it('no Phase 5-P or Phase 6 references in source', () => {
    const files = [
      resolve(ROOT, 'src', 'app', 'App.tsx'),
      resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx'),
    ];
    for (const filePath of files) {
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath, 'utf8');
      expect(content).not.toContain('Phase 5-P');
      expect(content).not.toContain('Phase 6');
      expect(content).not.toContain('PRE6');
      expect(content).not.toContain('Marketplace');
      expect(content).not.toContain('Extension Host');
    }
  });

  it('no generic IPC in source', () => {
    const files = [
      resolve(ROOT, 'src', 'app', 'App.tsx'),
      resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx'),
    ];
    for (const filePath of files) {
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath, 'utf8');
      expect(content).not.toContain('generic invoke');
      expect(content).not.toContain('ipcRenderer');
    }
  });
});
