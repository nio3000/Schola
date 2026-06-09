/**
 * R6-R2 Workbench UI — Editor / Preview split resizer.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('split-resizer-r6-r2', () => {
  it('keeps split ratio state bounded to a usable left/right layout', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    expect(shell).toContain('SPLIT_DEFAULT_RATIO = 0.5');
    expect(shell).toContain('SPLIT_MIN_RATIO = 0.3');
    expect(shell).toContain('SPLIT_MAX_RATIO = 0.7');
    expect(shell).toContain('const [splitRatio, setSplitRatio]');
    expect(shell).toContain('setSplitRatio((ratio)');
    expect(shell).toContain('deltaX / containerWidth');
  });

  it('applies split ratio through grid-template-columns', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    expect(shell).toContain('gridTemplateColumns: `minmax(0, ${splitRatio}fr) 6px minmax(0, ${1 - splitRatio}fr)`');
    expect(shell).toContain('style={splitStyle}');
    expect(shell).toContain('data-testid="editor-split-container"');
  });

  it('renders an accessible draggable split divider', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    const css = readProjectFile('src', 'styles.css');
    expect(shell).toContain('data-testid="split-divider"');
    expect(shell).toContain('aria-label="调整编辑器和预览宽度"');
    expect(shell).toContain('aria-orientation="vertical"');
    expect(shell).toContain('onPointerDown={splitResizeHandle.onPointerDown}');
    expect(css).toMatch(/\.split-divider\s*\{[\s\S]*cursor: col-resize/);
    expect(css).toContain('.split-divider.is-dragging');
  });

  it('keeps split mode as left/right panes without overlaying Preview on Editor', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    expect(shell).toContain('<div className="editor-pane" data-testid="editor-pane">');
    expect(shell).toContain('<div className="preview-pane" data-testid="preview-pane">');
    expect(shell).toContain('PreviewPanel');
  });
});
