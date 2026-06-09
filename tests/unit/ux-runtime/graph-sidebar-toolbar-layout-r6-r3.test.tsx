/**
 * R6-R3 — Graph sidebar / toolbar / detail layout.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('graph-sidebar-toolbar-layout-r6-r3', () => {
  it('GraphMainView has left sidebar, central toolbar/canvas, and right detail panel', () => {
    const main = readProjectFile('src', 'features', 'graph', 'components', 'GraphMainView.tsx');
    expect(main).toContain('data-testid="graph-left-sidebar"');
    expect(main).toContain('data-testid="graph-main-area"');
    expect(main).toContain('data-testid="graph-canvas-frame"');
    expect(main).toContain('data-testid="graph-right-panel"');
    expect(main).toContain('GraphToolbar');
    expect(main).toContain('GraphNodeDetail');
    expect(main).toContain('graph-detail-empty');
  });

  it('left Graph sidebar exposes scope, current file, metrics, and range selector', () => {
    const main = readProjectFile('src', 'features', 'graph', 'components', 'GraphMainView.tsx');
    expect(main).toContain('当前范围');
    expect(main).toContain('当前文件');
    expect(main).toContain('图谱统计');
    expect(main).toContain('GraphScopeSelector');
    expect(main).toContain('nodeCount');
    expect(main).toContain('edgeCount');
  });

  it('GraphToolbar keeps scoped graph-only search and layout actions', () => {
    const toolbar = readProjectFile('src', 'features', 'graph', 'components', 'GraphToolbar.tsx');
    expect(toolbar).toContain('data-testid="graph-search-input"');
    expect(toolbar).toContain('data-testid="graph-layout-segment"');
    expect(toolbar).toContain('适配');
    expect(toolbar).toContain('重排');
    expect(toolbar).toContain('居中');
    expect(toolbar).toContain('data-testid="graph-theme-select"');
    expect(toolbar).not.toContain('<select');
  });

  it('Graph CSS defines the workbench grid and panel boundaries', () => {
    const css = readProjectFile('src', 'features', 'graph', 'Graph.css');
    expect(css).toMatch(/\.graph-workbench\s*\{[\s\S]*grid-template-columns/);
    expect(css).toMatch(/\.graph-left-sidebar\s*\{[\s\S]*border-right: 1px solid var\(--border\)/);
    expect(css).toMatch(/\.graph-right-panel\s*\{[\s\S]*border-left: 1px solid var\(--border\)/);
    expect(css).toMatch(/\.graph-canvas-frame\s*\{[\s\S]*background:/);
  });
});
