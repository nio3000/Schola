import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('workspace-layout-gap-r3', () => {
  it('WorkspaceShell grid places ActivityBar, SideBar, one-pixel resizer, and EditorRegion adjacent', () => {
    const shell = readFileSync(resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx'), 'utf8');

    expect(shell).toContain('gridTemplateColumns: `44px ${sidebarWidth}px 1px minmax(0, 1fr)`');
    expect(shell).toContain('className="sidebar-resizer workspace-resizer"');
    expect(shell).toContain('data-testid="sidebar-resizer"');
    expect(shell).toContain('data-testid="editor-region"');
  });

  it('workspace CSS has no grid column gap and keeps the resizer visually one pixel wide', () => {
    const css = readFileSync(resolve(ROOT, 'src', 'styles.css'), 'utf8');

    expect(css).toMatch(/\.workspace-body\s*\{[\s\S]*column-gap: 0/);
    expect(css).toMatch(/\.workspace-body\s*\{[\s\S]*grid-template-columns: 44px minmax\(220px, 480px\) 1px minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.sidebar-resizer\s*\{[\s\S]*width: 1px/);
    expect(css).toMatch(/\.workspace-editor-area\s*\{[\s\S]*margin-left:\s*0|\.workspace-editor-area\s*\{[\s\S]*border-left: 1px solid var\(--border\)/);
  });
});
