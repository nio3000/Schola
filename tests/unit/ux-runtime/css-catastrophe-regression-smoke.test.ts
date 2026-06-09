/**
 * R6-R15: CSS Catastrophe Regression Smoke Test.
 * Verifies key UI classes are present in styles.css to prevent
 * future "naked HTML" regressions.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');
const css = readFileSync(resolve(ROOT, 'src', 'styles.css'), 'utf8');

const REQUIRED_CLASSES = [
  // TitleBar / Window Controls
  'schola-custom-titlebar',
  'window-controls',
  'window-control-button',
  'window-control-button-close',
  // MenuBar
  'schola-menubar',
  'menubar-item-container',
  'menubar-dropdown',
  'menubar-dropdown-item',
  'menubar-dropdown-separator',
  // TopBar
  'schola-topbar',
  'topbar-left',
  'topbar-center',
  'topbar-right',
  // ActivityBar
  'schola-activitybar',
  // Workspace
  'workspace-shell',
  'workspace-body',
  'workspace-editor-area',
  'workspace-editor-header',
  'workspace-editor-canvas',
  'workspace-sidebar',
  'sidebar-resizer',
  'workspace-resizer',
  // EditorToolbar
  'schola-editor-toolbar',
  'schola-editor-toolbar-btn',
  'schola-editor-toolbar-btn-active',
  'schola-editor-toolbar-btn-disabled',
  // Editor
  'editor-panel',
  'editor-cm',
  'editor-header',
  // Split / Preview
  'editor-split-container',
  'editor-pane',
  'split-divider',
  'preview-pane',
  'preview-pane-header',
  // MarkdownToolbar
  'schola-markdown-toolbar',
  'schola-markdown-toolbar-btn',
  // FileTree
  'file-tree',
  'file-tree-node',
  'file-tree-icon',
  'file-tabs',
  // Welcome
  'welcome-page',
  'welcome-launcher',
  'welcome-title',
  'welcome-actions',
  // Vault
  'vault-panel',
  'vault-toolbar',
  // BottomPanel
  'bottom-panel-resizer',
  'bottom-panel-toggle',
  // StatusBar
  'schola-statusbar',
  'statusbar-left',
  'statusbar-right',
  // Settings
  'settings-modal',
  'settings-modal-overlay',
  'settings-modal-header',
  'settings-modal-body',
  // Backlinks
  'backlinks-panel',
  // Dialogs
  'create-dialog',
  'create-dialog-overlay',
];

const REQUIRED_IMPORTS = [
  "@import './features/preview/themes/index.css'",
  "@import './features/theme/tokens/colors.css'",
  "@import './features/search/Search.css'",
  "@import './features/graph/Graph.css'",
];

describe('CSS Catastrophe Regression Smoke (R6-R15)', () => {
  it('styles.css is at least 25KB (not Phase 0 2.4KB skeleton)', () => {
    expect(css.length).toBeGreaterThan(25000);
  });

  for (const cls of REQUIRED_CLASSES) {
    it(`CSS class .${cls} is present`, () => {
      expect(css).toContain(`.${cls}`);
    });
  }

  for (const imp of REQUIRED_IMPORTS) {
    it(`@import ${imp.split('/').pop()} is present`, () => {
      expect(css).toContain(imp);
    });
  }

  it('MWeb theme registry is imported (not inlined)', () => {
    expect(css).toContain("@import './features/preview/themes/index.css'");
    // Verify MWeb CSS is NOT inlined in styles.css
    expect(css).not.toMatch(/\.schola-markdown-preview\[data-preview-theme=github\]/);
    expect(css).not.toMatch(/\.editor-cm\[data-editor-theme=github\]/);
  });

  it('Editor CSS variables are defined', () => {
    expect(css).toContain('--editor-font-size');
    expect(css).toContain('--editor-line-height');
    expect(css).toContain('--editor-font-family');
  });

  it('workspace-body has flex:1 1 0 for proper layout', () => {
    const bodyRule = css.match(/\.workspace-body\s*\{[^}]+\}/)?.[0] ?? '';
    expect(bodyRule).toContain('flex:');
    expect(bodyRule).toContain('min-height:');
  });

  it('bottom-panel-resizer has row-resize cursor', () => {
    const rule = css.match(/\.bottom-panel-resizer\s*\{[^}]+\}/)?.[0] ?? '';
    expect(rule).toContain('cursor:');
  });

  it('schola-editor-toolbar uses flex-direction:row (horizontal)', () => {
    const rule = css.match(/\.schola-editor-toolbar\s*\{[^}]+\}/)?.[0] ?? '';
    expect(rule).toContain('flex-direction:');
  });
});
