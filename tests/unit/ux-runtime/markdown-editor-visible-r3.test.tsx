import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkspaceShell, type WorkspaceShellProps } from '../../../src/features/workspace/WorkspaceShell';

const ROOT = resolve(__dirname, '..', '..', '..');
const CHINESE_MARKDOWN = 'RGCA_实验结果与分析_终稿草案.md';

function makeProps(): WorkspaceShellProps {
  return {
    activeVault: {
      id: 'test-vault',
      name: 'Test Vault',
      rootPath: 'L:/Schola/tests/fixtures/sample-vault',
      noteCount: 1,
      openedAt: 0,
    },
    recentVaults: [] as const,
    fileTree: [
      {
        id: CHINESE_MARKDOWN,
        type: 'file',
        name: CHINESE_MARKDOWN,
        relativePath: CHINESE_MARKDOWN,
        size: 100,
        mtime: 0,
      },
    ],
    selectedFile: CHINESE_MARKDOWN,
    hasVault: true,
    vaultStatus: 'ready',
    vaultMessage: 'Ready',
    appReady: true,
    appError: null,
    isOpening: false,
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
}

describe('markdown-editor-visible-r3', () => {
  it('renders WorkspaceShell with the real Markdown editor host for a selected Chinese file', () => {
    const html = renderToStaticMarkup(React.createElement(WorkspaceShell, makeProps()));

    expect(html).toContain('data-testid="markdown-editor"');
    expect(html).toContain('data-testid="editor-pane"');
    expect(html).toContain('data-testid="editor-cm"');
    expect(html).toContain(CHINESE_MARKDOWN);
    expect(html).not.toContain('Editor:');
  });

  it('keeps CodeMirror readiness and content plumbing in EditorPanel source', () => {
    const editor = readFileSync(resolve(ROOT, 'src', 'features', 'editor', 'EditorPanel.tsx'), 'utf8');

    expect(editor).toContain('new EditorView');
    expect(editor).toContain('readNote(vaultId!, selectedFile!)');
    expect(editor).toContain('onContentChangeRef.current?.(result.content)');
    expect(editor).toContain('data-testid="editor-codemirror-ready"');
  });
});
