import assert from 'node:assert/strict';
import React, { type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'vitest';
import { ActivityBar, ACTIVITY_BAR_ITEMS, type ActivityId } from '../../src/features/workspace/ActivityBar';
import { BottomPanel } from '../../src/features/workspace/BottomPanel';
import { SettingsPlaceholder } from '../../src/features/workspace/SettingsPlaceholder';
import { SideBar, type SideBarProps } from '../../src/features/workspace/SideBar';
import { StatusBar } from '../../src/features/workspace/StatusBar';

interface ButtonElementProps {
  readonly 'data-testid'?: string;
  readonly onClick?: () => void;
}

function buttonChildren(element: ReactElement): ReactElement<ButtonElementProps>[] {
  const props = element.props as { readonly children?: ReactNode };
  return React.Children.toArray(props.children).filter(
    (child): child is ReactElement<ButtonElementProps> => React.isValidElement<ButtonElementProps>(child),
  );
}

function makeSideBarProps(activeActivity: ActivityId): SideBarProps {
  return {
    activeActivity,
    width: 280,
    activeVault: {
      id: 'vault-1',
      name: 'Demo Vault',
      rootPath: 'L:/Demo',
      noteCount: 1,
      openedAt: 1,
    },
    fileTree: [],
    selectedFile: 'notes/demo.md',
    status: 'ready',
    message: 'Ready',
    onOpenVault: async () => {},
    onOpenVaultByPath: async () => {},
    onCloseVault: async () => {},
    onSelectFile: () => {},
    onCreateNote: async () => ({ ok: true, relativePath: 'notes/new.md' }),
    onCreateFolder: async () => ({ ok: true, relativePath: 'notes' }),
    onOpenSearch: () => {},
    onRenameNote: async (relativePath: string, newName: string) => ({
      ok: true,
      oldRelativePath: relativePath,
      newRelativePath: newName,
    }),
    onRenameFolder: async (relativePath: string, newName: string) => ({
      ok: true,
      oldRelativePath: relativePath,
      newRelativePath: newName,
    }),
    dirtyFiles: new Set<string>(),
    onDeleteNote: async () => ({ ok: true }),
    onDeleteNotePermanent: async () => ({ ok: true }),
    onDeleteFolder: async () => ({ ok: true }),
    onDeleteFolderPermanent: async () => ({ ok: true }),
    onMoveNote: async (relativePath: string, targetParentRelativePath: string) => ({
      ok: true,
      oldRelativePath: relativePath,
      newRelativePath: targetParentRelativePath,
    }),
    onMoveFolder: async (relativePath: string, targetParentRelativePath: string) => ({
      ok: true,
      oldRelativePath: relativePath,
      newRelativePath: targetParentRelativePath,
    }),
    onImportFile: () => {},
    importAvailableModes: { enhanced: false },
    onExportFile: () => {},
    search: {
      query: '',
      matches: [],
      source: 'memory',
      indexReady: true,
      onQueryChange: () => {},
      onOpenFile: () => {},
      onClose: () => {},
    },
    graph: {
      vaultId: 'vault-1',
      isOpen: activeActivity === 'graph',
      selectedFile: 'notes/demo.md',
      selectedFiles: ['notes/demo.md'],
      scope: 'current-file',
      onOpenMainView: () => {},
    },
    onOpenAIResearchWorkbench: () => {},
    onOpenSettings: () => {},
  };
}

function assertNoForbiddenActionElements(html: string): void {
  const forbiddenActionControl = /<(button|input|select|textarea|a)\b[^>]*(enable|install|authorize|run|export|启用|安装|授权|运行|导出)/i;
  assert.equal(forbiddenActionControl.test(html), false);
}

describe('Phase 5-0 workbench layout UI', () => {
  it('ActivityBar renders the non-search entries', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityBar, { activeActivity: 'files', onActivityChange: () => {} }),
    );

    assert.equal(ACTIVITY_BAR_ITEMS.length, 6);
    for (const item of ACTIVITY_BAR_ITEMS) {
      assert.match(html, new RegExp(`data-testid="${item.testid}"`));
    }
    assert.doesNotMatch(html, /data-testid="activity-search"/);
  });

  it('ActivityBar active state changes on click without a duplicate search entry', () => {
    let activeActivity: ActivityId = 'files';
    const firstRender = ActivityBar({
      activeActivity,
      onActivityChange: (activity) => {
        activeActivity = activity;
      },
    });
    const searchButton = buttonChildren(firstRender).find(
      (button) => button.props['data-testid'] === 'activity-search',
    );
    const graphButton = buttonChildren(firstRender).find(
      (button) => button.props['data-testid'] === 'activity-graph',
    );

    assert.equal(searchButton, undefined);
    assert.ok(graphButton);
    graphButton.props.onClick?.();
    assert.equal(activeActivity, 'graph');

    const html = renderToStaticMarkup(
      React.createElement(ActivityBar, { activeActivity, onActivityChange: () => {} }),
    );
    assert.doesNotMatch(html, /data-testid="activity-search"/);
    assert.match(html, /aria-pressed="true"/);
  });

  it('SideBar displays files content', () => {
    const html = renderToStaticMarkup(React.createElement(SideBar, makeSideBarProps('files')));
    assert.match(html, /data-testid="workspace-sidebar"/);
    assert.match(html, /data-testid="vault-panel"/);
  });

  it('SideBar displays plugin, settings (Center), and AI placeholders', () => {
    const plugins = renderToStaticMarkup(React.createElement(SideBar, makeSideBarProps('plugins')));
    const settings = renderToStaticMarkup(React.createElement(SideBar, makeSideBarProps('settings')));
    const ai = renderToStaticMarkup(React.createElement(SideBar, makeSideBarProps('ai')));

    assert.match(plugins, /workspace-sidebar-plugins/);
    assert.match(plugins, /Plugin Ecosystem/);
    assert.match(settings, /workspace-sidebar-settings/);
    // Phase 5-2: AI Research SideBar now shows AIResearchSidebarSummary instead of the retired preview shell.
    assert.match(ai, /data-testid="ai-research-sidebar-summary"/);
  });

  it('SettingsPlaceholder has no buttons or inputs and is read-only', () => {
    const html = renderToStaticMarkup(React.createElement(SettingsPlaceholder));
    assert.match(html, /data-testid="settings-placeholder"/);
    assert.doesNotMatch(html, /<button\b/i);
    assert.doesNotMatch(html, /<input\b/i);
    assert.doesNotMatch(html, /<select\b/i);
    assert.doesNotMatch(html, /<textarea\b/i);
  });

  it('BottomPanel collapses and expands through its toggle', () => {
    let open = false;
    const collapsed = BottomPanel({
      isOpen: open,
      onToggle: () => {
        open = !open;
      },
    });
    const toggle = buttonChildren(collapsed)[0];
    assert.ok(toggle);
    toggle.props.onClick?.();
    assert.equal(open, true);

    const expandedHtml = renderToStaticMarkup(
      React.createElement(BottomPanel, { isOpen: open, onToggle: () => {} }),
    );
    assert.match(expandedHtml, /运行时诊断 · 即将推出/);
    assert.match(expandedHtml, /data-testid="bottom-panel-content"/);
  });

  it('StatusBar shows vault name and activity mode', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusBar, {
        filePath: 'notes/demo.md',
        vaultName: 'Demo Vault',
        activeActivity: 'plugins',
      }),
    );

    assert.match(html, /data-testid="statusbar-vault"/);
    assert.match(html, /Demo Vault/);
    assert.match(html, /data-testid="statusbar-activity"/);
    assert.match(html, /插件生态/);
  });

  it('placeholder components expose no runtime action elements', () => {
    const placeholders = [
      renderToStaticMarkup(React.createElement(SettingsPlaceholder)),
      renderToStaticMarkup(React.createElement(SideBar, makeSideBarProps('plugins'))),
      renderToStaticMarkup(React.createElement(SideBar, makeSideBarProps('ai'))),
      renderToStaticMarkup(React.createElement(SideBar, makeSideBarProps('artifacts'))),
    ];

    for (const html of placeholders) {
      assertNoForbiddenActionElements(html);
    }
  });
});
