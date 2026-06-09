import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ActivityBar } from '../../../src/features/workspace/ActivityBar.tsx';
import { SideBar } from '../../../src/features/workspace/SideBar.tsx';
import type { SideBarProps } from '../../../src/features/workspace/SideBar.tsx';
import { BottomPanel } from '../../../src/features/workspace/BottomPanel.tsx';
import { StatusBar } from '../../../src/features/workspace/StatusBar.tsx';

describe('workbench-layout-productization (P1)', () => {
  const sideBarProps: SideBarProps = {
    activeActivity: 'files',
    width: 320,
    activeVault: null,
    fileTree: [],
    selectedFile: null,
    status: 'idle',
    message: '',
    onOpenVault: async () => {},
    onOpenVaultByPath: async () => {},
    onCloseVault: async () => {},
    onSelectFile: () => {},
    onCreateNote: async () => ({ ok: false, message: 'test noop' }),
    onCreateFolder: async () => ({ ok: false, message: 'test noop' }),
    onOpenSearch: () => {},
    onRenameNote: async () => ({ ok: false, message: 'test noop' }),
    onRenameFolder: async () => ({ ok: false, message: 'test noop' }),
    dirtyFiles: new Set<string>(),
    onDeleteNote: async () => ({ ok: false, message: 'test noop' }),
    onDeleteNotePermanent: async () => ({ ok: false, message: 'test noop' }),
    onDeleteFolder: async () => ({ ok: false, message: 'test noop' }),
    onDeleteFolderPermanent: async () => ({ ok: false, message: 'test noop' }),
    onMoveNote: async () => ({ ok: false, message: 'test noop' }),
    onMoveFolder: async () => ({ ok: false, message: 'test noop' }),
    onImportFile: () => {},
    onExportFile: () => {},
    importAvailableModes: null,
    search: { query: '', matches: [], onQueryChange: () => {}, onOpenFile: () => {}, onClose: () => {} },
    graph: {
      vaultId: null,
      isOpen: false,
      selectedFile: null,
      selectedFiles: [],
      scope: 'current-file',
      onOpenMainView: () => {},
    },
    onOpenAIResearchWorkbench: () => {},
    onOpenSettings: () => {},
  };

  it('ActivityBar should render with data-testid activitybar-nav', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityBar, { activeActivity: 'files', onActivityChange: () => {} }),
    );
    expect(html).toContain('schola-activitybar');
    expect(html).toContain('activity-files');
  });

  it('ActivityBar should have 6 non-search activity entries', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityBar, { activeActivity: 'files', onActivityChange: () => {} }),
    );
    const buttonCount = (html.match(/activitybar-btn/g) || []).length;
    expect(buttonCount).toBe(6);
    expect(html).not.toContain('activity-search');
  });

  it('SideBar should accept width prop and apply it', () => {
    const html = renderToStaticMarkup(
      React.createElement(SideBar, sideBarProps),
    );
    expect(html).toContain('workspace-sidebar');
  });

  it('BottomPanel should default to collapsed', () => {
    const html = renderToStaticMarkup(
      React.createElement(BottomPanel, { isOpen: false, onToggle: () => {} }),
    );
    expect(html).not.toContain('schola-bottom-panel-open');
  });

  it('StatusBar should render vault name and file path', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusBar, { filePath: 'test.md', vaultName: 'TestVault' }),
    );
    expect(html).toContain('statusbar');
    expect(html).toContain('TestVault');
    expect(html).toContain('test.md');
  });

  it('ActivityBar active button should have activitybar-btn-active class', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityBar, { activeActivity: 'graph', onActivityChange: () => {} }),
    );
    expect(html).toContain('activitybar-btn-active');
  });
});
