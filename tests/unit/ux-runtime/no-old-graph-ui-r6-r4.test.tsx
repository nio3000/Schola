/**
 * R6-R4 — Graph legacy UI runtime guard.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('no-old-graph-ui-r6-r4', () => {
  it('loads Graph.css through the runtime global style entry', () => {
    const css = readProjectFile('src', 'styles.css');
    expect(css).toContain("@import './features/graph/Graph.css';");
  });

  it('GraphToolbar does not render native select controls', () => {
    const toolbar = readProjectFile('src', 'features', 'graph', 'components', 'GraphToolbar.tsx');
    expect(toolbar).not.toContain('<select');
    expect(toolbar).toContain('data-testid="graph-layout-segment"');
    expect(toolbar).toContain('className="graph-toolbar-button graph-theme-button"');
  });

  it('Graph views do not expose retired default-browser labels', () => {
    const mainView = readProjectFile('src', 'features', 'graph', 'components', 'GraphMainView.tsx');
    const sidebar = readProjectFile(
      'src',
      'features',
      'graph',
      'components',
      'GraphSidebarSummary.tsx',
    );
    const content = `${mainView}\n${sidebar}`;

    expect(content).not.toContain('Open Graph Main View');
    expect(content).not.toContain('Graph Metrics');
    expect(content).not.toContain('Current File');
    expect(content).not.toContain('Knowledge Graph');
    expect(content).toContain('在编辑区打开完整图谱');
  });
});
