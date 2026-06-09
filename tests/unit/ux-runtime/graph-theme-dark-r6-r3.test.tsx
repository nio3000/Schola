/**
 * R6-R3 — Graph dark theme guard.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('graph-theme-dark-r6-r3', () => {
  it('Graph canvas and panels use Schola dark theme tokens', () => {
    const css = readProjectFile('src', 'features', 'graph', 'Graph.css');
    expect(css).toContain('var(--bg-primary)');
    expect(css).toContain('var(--bg-secondary)');
    expect(css).toContain('var(--schola-graph-canvas-background');
    expect(css).toContain('var(--border)');
    expect(css).toContain('var(--text-primary)');
  });

  it('Graph controls are styled and do not fall back to native white controls', () => {
    const css = readProjectFile('src', 'features', 'graph', 'Graph.css');
    expect(css).toMatch(/\.graph-search-field,[\s\S]*\.graph-layout-segment-button\s*\{[\s\S]*background: var\(--bg-primary\)/);
    expect(css).toMatch(/\.graph-search-input\s*\{[\s\S]*background: transparent/);
    expect(css).toMatch(/\.graph-layout-segment\s*\{[\s\S]*background: var\(--bg-primary\)/);
    expect(css).toMatch(/\.graph-toolbar-button\s*\{[\s\S]*background: var\(--bg-surface\)/);
    expect(css).not.toContain('background: white');
    expect(css).not.toContain('background-color: white');
    expect(css).not.toContain('#fff');
  });

  it('Graph keeps productized empty and ready surfaces instead of a bare white canvas', () => {
    const css = readProjectFile('src', 'features', 'graph', 'Graph.css');
    const main = readProjectFile('src', 'features', 'graph', 'components', 'GraphMainView.tsx');
    expect(css).toContain('.graph-empty');
    expect(css).toContain('.graph-canvas-frame');
    expect(main).toContain('GraphEmptyState');
    expect(main).toContain('GraphCanvas');
  });

  it('Graph theme tokens are sourced from Schola theme files', () => {
    const semantic = readProjectFile('src', 'features', 'theme', 'tokens', 'semantic.css');
    const dark = readProjectFile('src', 'features', 'theme', 'themes', 'schola-dark.css');
    expect(semantic).toContain('--schola-graph-background');
    expect(semantic).toContain('--schola-graph-grid-color');
    expect(dark).toContain('--graph-background');
  });
});
