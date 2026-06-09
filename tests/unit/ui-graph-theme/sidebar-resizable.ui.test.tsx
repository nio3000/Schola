import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { SideBar } from '../../../src/features/workspace/SideBar.tsx';
import type { SideBarProps } from '../../../src/features/workspace/SideBar.tsx';

const baseSidebarProps: SideBarProps = {
  activeActivity: 'files' as const,
  width: 280,
  activeVault: null as null,
  fileTree: [],
  selectedFile: null as string | null,
  status: 'idle' as const,
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
  importAvailableModes: null as null,
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

describe('sidebar-resizable (P1)', () => {
  it('SideBar should render with workspace-sidebar class', () => {
    const html = renderToStaticMarkup(React.createElement(SideBar, baseSidebarProps));
    expect(html).toContain('workspace-sidebar');
  });

  it('SideBar should accept width prop and render', () => {
    const html = renderToStaticMarkup(
      React.createElement(SideBar, { ...baseSidebarProps, width: 350 }),
    );
    expect(html).toContain('workspace-sidebar');
  });

  it('SideBar with min width 220 should render', () => {
    const html = renderToStaticMarkup(
      React.createElement(SideBar, { ...baseSidebarProps, width: 220 }),
    );
    expect(html).toContain('workspace-sidebar');
  });

  it('SideBar with max width 480 should render', () => {
    const html = renderToStaticMarkup(
      React.createElement(SideBar, { ...baseSidebarProps, width: 480 }),
    );
    expect(html).toContain('workspace-sidebar');
  });
});
