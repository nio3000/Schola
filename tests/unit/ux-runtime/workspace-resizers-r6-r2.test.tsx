/**
 * R6-R2 Workbench UI — Explorer / Editor resizer.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('workspace-resizers-r6-r2', () => {
  it('keeps sidebar layout state in WorkspaceShell and applies it to the grid', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    expect(shell).toContain('SIDEBAR_DEFAULT_WIDTH');
    expect(shell).toContain('SIDEBAR_MIN_WIDTH');
    expect(shell).toContain('SIDEBAR_MAX_WIDTH');
    expect(shell).toContain('const [sidebarWidth, setSidebarWidth]');
    expect(shell).toContain('gridTemplateColumns: `44px ${sidebarWidth}px 1px minmax(0, 1fr)`');
    expect(shell).toContain('width={sidebarWidth}');
  });

  it('renders an accessible sidebar resizer with col-resize styling', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    const css = readProjectFile('src', 'styles.css');
    expect(shell).toContain('data-testid="sidebar-resizer"');
    expect(shell).toContain('aria-label="调整资源管理器宽度"');
    expect(shell).toContain('aria-orientation="vertical"');
    expect(shell).toContain('onPointerDown={sidebarResizeHandle.onPointerDown}');
    expect(css).toMatch(/\.sidebar-resizer\s*\{[\s\S]*cursor: col-resize/);
    expect(css).toContain('.sidebar-resizer.is-dragging');
  });

  it('updates sidebar width through bounded incremental pointer deltas', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    expect(shell).toContain('setSidebarWidth((width) => clamp(width + deltaX');
    expect(shell).toContain('SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH');
    expect(shell).toContain('onDoubleClick: () => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)');
  });

  it('central resize hook registers and cleans window pointer listeners', () => {
    const hook = readProjectFile('src', 'features', 'workspace', 'hooks', 'useResizablePanels.ts');
    expect(hook).toContain("document.body.classList.add('is-resizing')");
    expect(hook).toContain("document.body.classList.remove('is-resizing')");
    expect(hook).toContain("window.addEventListener('pointermove'");
    expect(hook).toContain("window.addEventListener('pointerup'");
    expect(hook).toContain("window.removeEventListener('pointermove'");
    expect(hook).toContain("window.removeEventListener('pointerup'");
    expect(hook).toContain('setPointerCapture');
  });
});
