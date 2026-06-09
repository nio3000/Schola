import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

function readWorkspaceShell(): string {
  return readFileSync(resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx'), 'utf8');
}

describe('preview-does-not-close-file-r3', () => {
  it('preview mode only changes editorMode and does not clear the selected file', () => {
    const shell = readWorkspaceShell();
    const previewHandler = shell.split('const handleTogglePreview')[1]?.split('const handleToggleSplit')[0] ?? '';

    expect(previewHandler).toContain('setEditorMode');
    expect(previewHandler).not.toContain('onSelectFile');
    expect(previewHandler).not.toContain('setOpenFiles');
    expect(previewHandler).not.toContain('setFileContent');
    expect(previewHandler).not.toContain('null');
  });

  it('preview route renders PreviewPanel for the current selected file without close callbacks', () => {
    const shell = readWorkspaceShell();
    const previewBranch = shell.split("if (editorMode === 'preview')")[1]?.split("if (editorMode === 'split')")[0] ?? '';

    expect(previewBranch).toContain('data-testid="preview-standalone"');
    expect(previewBranch).toContain('noteRelativePath={selectedFile}');
    expect(previewBranch).toContain('content={currentFileContent}');
    expect(previewBranch).not.toContain('onFileClosed');
    expect(previewBranch).not.toContain('onCloseTab');
    expect(previewBranch).not.toContain('onSelectFile(null)');
  });

  it('PreviewPanel catches Markdown render errors into a visible pane', () => {
    const preview = readFileSync(resolve(ROOT, 'src', 'features', 'preview', 'PreviewPanel.tsx'), 'utf8');

    expect(preview).toContain('try {');
    expect(preview).toContain('sanitizeAndRender(content ??');
    expect(preview).toContain('data-testid="preview-render-error"');
  });
});
