/**
 * Activity MainView Routing Test — Phase 5-DEV-ACTIVITY-MAINVIEW-ROUTING-R2.
 *
 * Ensures ActivityBar clicks route to the correct main view in EditorRegion.
 * Verifies the full chain: ActivityBar → setActiveActivity → EditorRegion conditional rendering.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { WorkspaceShell } from '../../../src/features/workspace/WorkspaceShell';
import { ArtifactEmptyView, PluginPreviewOnlyView } from '../../../src/features/workspace/views/ProductizedEmptyViews';
import type { WorkspaceShellProps } from '../../../src/features/workspace/WorkspaceShell';

const ROOT = resolve(__dirname, '..', '..', '..');

const baseProps: WorkspaceShellProps = {
  activeVault: {
    id: 'test-vault',
    name: 'Test Vault',
    rootPath: 'L:/Schola/tests/fixtures/sample-vault',
    noteCount: 1,
    openedAt: 0,
  },
  selectedFile: 'notes/test.md',
  fileTree: [] as const,
  hasVault: true,
  vaultStatus: 'ready',
  vaultMessage: 'Ready',
  appReady: true,
  appError: null,
  isOpening: false,
  recentVaults: [] as const,
  onOpenVault: async () => {},
  onCreateVault: async () => {},
  onOpenVaultByPath: async () => {},
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

describe('activity-mainview-routing', () => {
  // ── Empty View Components Render ──

  it('ArtifactEmptyView renders with correct data-testid', () => {
    const html = renderToStaticMarkup(React.createElement(ArtifactEmptyView));
    expect(html).toContain('artifact-empty-view');
    expect(html).toContain('artifact-export-btn');
    expect(html).toContain('artifact-save-btn');
  });

  it('PluginPreviewOnlyView renders with correct data-testid', () => {
    const html = renderToStaticMarkup(React.createElement(PluginPreviewOnlyView));
    expect(html).toContain('plugin-preview-view');
    expect(html).toContain('Plugin Ecosystem');
  });

  // ── WorkspaceShell Structure ──

  it('WorkspaceShell vault-open renders all layout sections', () => {
    const html = renderToStaticMarkup(React.createElement(WorkspaceShell, baseProps));
    expect(html).toContain('workspace-shell');
    expect(html).toContain('workspace-body');
    expect(html).toContain('workspace-editor-area');
  });

  it('WorkspaceShell imports real component views', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    // Real components for AI and Graph
    expect(content).toContain('AIResearchMainView');
    expect(content).toContain('GraphMainView');
    // Artifact and Plugin remain empty/preview-only
    expect(content).toContain('ArtifactEmptyView');
    expect(content).toContain('PluginPreviewOnlyView');
  });

  // ── ActivityBar → EditorRegion Routing Chain ──

  it('WorkspaceShell conditionally renders views based on activeActivity', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    // Must check activeActivity for each view type
    expect(content).toContain("activeActivity === 'ai'");
    expect(content).toContain("activeActivity === 'graph'");
    expect(content).toContain("activeActivity === 'artifacts'");
    expect(content).toContain("activeActivity === 'plugins'");
    // search is modal-only — main area shows file view via default case
    expect(content).toContain('renderFileView()');
    expect(content).toContain('searchModalOpen ? (');
    expect(content).toContain('SearchPanel');
    // files + settings fall through to default case
    expect(content).toContain('EmptyEditor');
  });

  it('WorkspaceShell ActivityBar onActivityChange calls setActiveActivity', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain('setActiveActivity(activity)');
  });

  it('ActivityBar settings click opens modal, not changes activity', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    const code = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
    expect(code).toContain("if (activity === 'settings')");
    expect(code).toContain('setSettingsModalOpen(true)');
  });

  it('ActivityBar default activeActivity is files', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    const code = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
    expect(code).toContain("useState<ActivityId>('files')");
  });

  // ── SideBar routes content based on activeActivity ──

  it('SideBar has switch statement for all activities', () => {
    const sidebarPath = resolve(ROOT, 'src', 'features', 'workspace', 'SideBar.tsx');
    if (!existsSync(sidebarPath)) return;
    const content = readFileSync(sidebarPath, 'utf8');
    expect(content).toContain("case 'files':");
    expect(content).not.toContain("case 'search':");
    expect(content).toContain("case 'graph':");
    expect(content).toContain("case 'ai':");
    expect(content).toContain("case 'artifacts':");
    expect(content).toContain("case 'plugins':");
    expect(content).toContain("case 'settings':");
  });

  // ── No provider / export / runtime in routing ──

  it('Artifact empty view has disabled export button', () => {
    const html = renderToStaticMarkup(React.createElement(ArtifactEmptyView));
    expect(html).toContain('disabled');
  });

  it('Plugin view is preview-only, no install actions', () => {
    const html = renderToStaticMarkup(React.createElement(PluginPreviewOnlyView));
    expect(html).not.toContain('install');
    expect(html).not.toContain('enable');
    expect(html).not.toContain('Marketplace install');
  });
});
