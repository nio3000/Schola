import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EditorToolbar } from '../../../src/features/workspace/components/EditorToolbar';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('split-keeps-file-visible-r3', () => {
  it('split toolbar action remains enabled for an open file', () => {
    const html = renderToStaticMarkup(
      React.createElement(EditorToolbar, {
        hasOpenFile: true,
        editorMode: 'split',
        onTogglePreview: () => {},
        onToggleSplit: () => {},
        onOpenGraph: () => {},
        onOpenAI: () => {},
    onImport: () => {},
      }),
    );

    expect(html).toContain('editor-toolbar-split');
    expect(html).toContain('schola-editor-toolbar-btn-active');
    expect(html).not.toContain('未打开文件');
  });

  it('split mode renders editor, divider, and preview against the same selected file', () => {
    const shell = readFileSync(resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx'), 'utf8');
    const splitBranch = shell.split("if (editorMode === 'split')")[1]?.split('return (')[0] ?? '';

    expect(shell).toContain('data-testid="editor-split-container"');
    expect(shell).toContain('data-testid="editor-pane"');
    expect(shell).toContain('data-testid="preview-pane"');
    expect(shell).toContain('data-testid="split-divider"');
    expect(shell).toContain('noteRelativePath={selectedFile}');
    expect(splitBranch).not.toContain('onSelectFile(null)');
    expect(splitBranch).not.toContain('onCloseTab');
  });
});
