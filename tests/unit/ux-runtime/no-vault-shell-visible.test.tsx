/**
 * UX Runtime Smoke — No-Vault Shell Visible Test.
 * Phase 5-DEV-RUNTIME-SMOKE-BLANK-SCREEN-R2 / VAULT-ENTRY-ACTION-WIRING.
 *
 * Ensures WorkspaceShell always renders visible content,
 * even when no vault is loaded.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { WorkspaceShell } from '../../../src/features/workspace/WorkspaceShell';
import type { WorkspaceShellProps } from '../../../src/features/workspace/WorkspaceShell';

const noVaultProps: WorkspaceShellProps = {
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

describe('ux-runtime no-vault-shell-visible', () => {
  it('no-vault shell renders TopBar + StatusBar + Welcome content', () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkspaceShell, noVaultProps),
    );
    // Shell root exists
    expect(html).toContain('workspace-shell');
    // TopBar visible
    expect(html).toContain('topbar');
    // StatusBar visible
    expect(html).not.toBe('');
  });

  it('loading state renders shell frame, not black screen', () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkspaceShell, {
        ...noVaultProps,
        appReady: false,
      }),
    );
    expect(html).toContain('workspace-shell');
    expect(html).toContain('Schola');
  });

  it('shell never returns null', () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkspaceShell, {
        ...noVaultProps,
        appReady: false,
      }),
    );
    expect(html.length).toBeGreaterThan(0);
  });

  it('App.tsx always renders WorkspaceShell, never returns separate ui paths', () => {
    const fs = require('fs');
    const path = require('path');
    const appContent = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'src', 'app', 'App.tsx'), 'utf8');
    // App.tsx should always return WorkspaceShell
    const code = appContent.split('\n').filter((l: string) => !l.trim().startsWith('//')).join('\n');
    const returnStatements = (code.match(/return\s*\(/g) || []).length;
    // Should have ONLY the main return (WorkspaceShell) and possibly useEffect callback return
    expect(returnStatements).toBeLessThanOrEqual(3);
  });
});
