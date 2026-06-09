/**
 * R6-R2 Workbench UI — region boundaries.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('workspace-boundaries-r6-r2', () => {
  it('adds clear borders between the major workbench regions', () => {
    const css = readProjectFile('src', 'styles.css');
    expect(css).toMatch(/\.schola-topbar\s*\{[\s\S]*border-bottom: 1px solid var\(--border\)/);
    expect(css).toMatch(/\.workspace-body\s*\{[\s\S]*border-top: 1px solid var\(--border\)/);
    expect(css).toMatch(/\.schola-activitybar\s*\{[\s\S]*border-right: 1px solid var\(--border\)/);
    expect(css).toMatch(/\.schola-sidebar\s*\{[\s\S]*border-right: 1px solid var\(--border\)/);
    expect(css).toMatch(/\.workspace-editor-area\s*\{[\s\S]*border-left: 1px solid var\(--border\)/);
    expect(css).toMatch(/\.workspace-editor-header\s*\{[\s\S]*border-bottom: 1px solid var\(--border\)/);
    expect(css).toMatch(/\.preview-pane-header\s*\{[\s\S]*border-bottom: 1px solid var\(--border\)/);
    expect(css).toMatch(/\.schola-bottom-panel\s*\{[\s\S]*border-top: 1px solid var\(--border\)/);
    expect(css).toMatch(/\.schola-statusbar\s*\{[\s\S]*border-top: 1px solid var\(--border\)/);
  });

  it('keeps Graph toolbar, canvas, and workspace visually separated', () => {
    const graphCss = readProjectFile('src', 'features', 'graph', 'Graph.css');
    expect(graphCss).toMatch(/\.graph-workbench-titlebar\s*\{[\s\S]*border-bottom: 1px solid var\(--border\)/);
    expect(graphCss).toMatch(/\.graph-left-sidebar\s*\{[\s\S]*border-right: 1px solid var\(--border\)/);
    expect(graphCss).toMatch(/\.graph-toolbar\s*\{[\s\S]*border-bottom: 1px solid var\(--border/);
    expect(graphCss).toMatch(/\.graph-workspace\s*\{[\s\S]*border-top: 1px solid var\(--border\)/);
    expect(graphCss).toMatch(/\.graph-canvas\s*\{[\s\S]*border-right: 1px solid var\(--border\)/);
  });

  it('styles Graph toolbar controls instead of falling back to native white controls', () => {
    const graphCss = readProjectFile('src', 'features', 'graph', 'Graph.css');
    expect(graphCss).toContain('.graph-toolbar-controls');
    expect(graphCss).toContain('.graph-search-input');
    expect(graphCss).toContain('.graph-layout-segment');
    expect(graphCss).toContain('.graph-toolbar-button');
    expect(graphCss).toContain('background: var(--bg-primary)');
    expect(graphCss).toContain('background: var(--bg-surface)');
  });

  it('keeps Settings and Search as modal overlays', () => {
    const css = readProjectFile('src', 'styles.css');
    const searchCss = readProjectFile('src', 'features', 'search', 'Search.css');
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    const sideBar = readProjectFile('src', 'features', 'workspace', 'SideBar.tsx');
    expect(css).toMatch(/\.settings-modal-overlay\s*\{[\s\S]*position: fixed/);
    expect(css).toMatch(/\.settings-modal\s*\{[\s\S]*border: 1px solid var\(--border-strong\)/);
    expect(searchCss).toMatch(/\.search-overlay\s*\{[\s\S]*position: fixed/);
    expect(shell).toContain('setSettingsModalOpen(true)');
    expect(shell).toContain('setSearchModalOpen(true)');
    expect(sideBar).not.toContain('workspace-sidebar-search');
  });
});
