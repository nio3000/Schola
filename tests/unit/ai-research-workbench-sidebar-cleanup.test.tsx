import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SideBar, type SideBarProps } from '../../src/features/workspace/SideBar';

const ROOT = resolve(__dirname, '..', '..');

function makeSideBarProps(): SideBarProps {
  return {
    activeActivity: 'ai',
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
    graph: {
      vaultId: 'vault-1',
      isOpen: false,
      selectedFile: 'notes/demo.md',
      selectedFiles: ['notes/demo.md'],
      scope: 'current-file',
      onOpenMainView: () => {},
    },
    onOpenAIResearchWorkbench: () => {},
    onOpenSettings: () => {},
  };
}

describe('AI Research workbench sidebar cleanup', () => {
  it('WorkspaceShell removes sidebar and resizer from AI activity layout', () => {
    const shell = readFileSync(
      resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx'),
      'utf8',
    );

    expect(shell).toContain("const showSidebar = activeActivity !== 'ai'");
    expect(shell).toContain('gridTemplateColumns: showSidebar');
    expect(shell).toContain("? `44px ${sidebarWidth}px 1px minmax(0, 1fr)`");
    expect(shell).toContain(": '44px minmax(0, 1fr)'");
    expect(shell).toContain('{showSidebar ? (');
    expect(shell).toContain('data-testid="sidebar-resizer"');
  });

  it('SideBar no longer renders the AI Research summary cards for AI activity', () => {
    const html = renderToStaticMarkup(React.createElement(SideBar, makeSideBarProps()));

    expect(html).not.toContain('ai-research-sidebar-summary');
    expect(html).not.toContain('提供者就绪');
    expect(html).not.toContain('上下文摘要');
    expect(html).not.toContain('任务状态');
    expect(html).not.toContain('最近草稿');
    expect(html).not.toContain('打开 AI Research Workbench');
  });

  it('SideBar still renders file explorer for files activity', () => {
    const html = renderToStaticMarkup(
      React.createElement(SideBar, { ...makeSideBarProps(), activeActivity: 'files' }),
    );

    expect(html).toContain('workspace-sidebar');
    expect(html).toContain('vault-panel');
  });
});
