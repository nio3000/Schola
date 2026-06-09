/**
 * Productized Empty Views Visible Test — Phase 5-DEV-ACTIVITY-MAINVIEW-ROUTING-R2.
 *
 * Ensures productized empty views have stable data-testid attributes,
 * visible content, and proper disabled states. Verifies that empty views
 * are not mistaken for functional capabilities.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { WorkspaceShell } from '../../../src/features/workspace/WorkspaceShell';
import type { WorkspaceShellProps } from '../../../src/features/workspace/WorkspaceShell';
import { ArtifactEmptyView, PluginPreviewOnlyView } from '../../../src/features/workspace/views/ProductizedEmptyViews';

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

describe('productized-empty-views-visible', () => {
  // ── Artifact Empty View ──

  it('Artifact view has stable data-testid', () => {
    const html = renderToStaticMarkup(React.createElement(ArtifactEmptyView));
    expect(html).toContain('artifact-empty-view');
  });

  it('Artifact view export button exists and is disabled', () => {
    const html = renderToStaticMarkup(React.createElement(ArtifactEmptyView));
    expect(html).toContain('artifact-export-btn');
    expect(html).toContain('artifact-save-btn');
    expect(html).toContain('disabled');
  });

  it('Artifact view does not trigger real export', () => {
    const html = renderToStaticMarkup(React.createElement(ArtifactEmptyView));
    expect(html).not.toContain('real export');
    expect(html).not.toContain('export pipeline');
  });

  // ── Plugin Preview-Only View ──

  it('Plugin view has stable data-testid', () => {
    const html = renderToStaticMarkup(React.createElement(PluginPreviewOnlyView));
    expect(html).toContain('plugin-preview-view');
  });

  it('Plugin view shows preview-only content', () => {
    const html = renderToStaticMarkup(React.createElement(PluginPreviewOnlyView));
    expect(html).toContain('Plugin Ecosystem');
    expect(html).toContain('只读预览');
  });

  it('Plugin view has no install/enable actions', () => {
    const html = renderToStaticMarkup(React.createElement(PluginPreviewOnlyView));
    expect(html).not.toContain('install');
    expect(html).not.toContain('enable');
  });

  // ── WorkspaceShell integration ──

  it('WorkspaceShell has CSS class workspace-editor-canvas', () => {
    const html = renderToStaticMarkup(React.createElement(WorkspaceShell, baseProps));
    expect(html).toContain('workspace-editor-canvas');
  });

  it('WorkspaceShell has CSS class workspace-editor-area', () => {
    const html = renderToStaticMarkup(React.createElement(WorkspaceShell, baseProps));
    expect(html).toContain('workspace-editor-area');
  });

  it('WorkspaceShell has proper grid layout CSS for workspace-body', () => {
    const cssPath = resolve(ROOT, 'src', 'styles.css');
    if (!existsSync(cssPath)) return;
    const content = readFileSync(cssPath, 'utf8');
    // Must have grid-template-columns for the 3-column layout
    expect(content).toMatch(/\.workspace-body\s*\{[^}]*grid-template-columns/);
  });

  it('CSS has styling for empty views', () => {
    const cssPath = resolve(ROOT, 'src', 'styles.css');
    if (!existsSync(cssPath)) return;
    const content = readFileSync(cssPath, 'utf8');
    expect(content).toContain('.workspace-empty-view');
    expect(content).toContain('.workspace-empty-view-content');
  });

  it('CSS has styling for workspace-editor-area', () => {
    const cssPath = resolve(ROOT, 'src', 'styles.css');
    if (!existsSync(cssPath)) return;
    const content = readFileSync(cssPath, 'utf8');
    expect(content).toContain('.workspace-editor-area');
  });

  it('CSS has styling for workspace-editor-canvas', () => {
    const cssPath = resolve(ROOT, 'src', 'styles.css');
    if (!existsSync(cssPath)) return;
    const content = readFileSync(cssPath, 'utf8');
    expect(content).toContain('.workspace-editor-canvas');
  });

  it('CSS has flex column layout for workspace-shell', () => {
    const cssPath = resolve(ROOT, 'src', 'styles.css');
    if (!existsSync(cssPath)) return;
    const content = readFileSync(cssPath, 'utf8');
    expect(content).toMatch(/\.workspace-shell\s*\{[^}]*flex-direction:\s*column/);
  });

  // ── Security boundaries ──

  it('empty views do not reference runtime capabilities in rendered HTML', () => {
    const views = [
      { name: 'Artifact', html: renderToStaticMarkup(React.createElement(ArtifactEmptyView)) },
      { name: 'Plugin', html: renderToStaticMarkup(React.createElement(PluginPreviewOnlyView)) },
    ];
    for (const view of views) {
      // Rendered HTML should not contain runtime invocation patterns
      expect(view.html).not.toContain('invoke provider');
      expect(view.html).not.toContain('contextSend');
      expect(view.html).not.toContain('writeVault');
    }
  });

  it('empty views do not contain export pipeline in rendered HTML', () => {
    const views = [
      renderToStaticMarkup(React.createElement(ArtifactEmptyView)),
      renderToStaticMarkup(React.createElement(PluginPreviewOnlyView)),
    ];
    for (const html of views) {
      expect(html).not.toContain('export pipeline');
      expect(html).not.toContain('realExport');
    }
  });

  // ── Empty views are NOT no-op ──

  it('empty views render visible content, not empty divs', () => {
    const artifactHtml = renderToStaticMarkup(React.createElement(ArtifactEmptyView));
    expect(artifactHtml.length).toBeGreaterThan(100);

    const pluginHtml = renderToStaticMarkup(React.createElement(PluginPreviewOnlyView));
    expect(pluginHtml.length).toBeGreaterThan(200);
  });
});
