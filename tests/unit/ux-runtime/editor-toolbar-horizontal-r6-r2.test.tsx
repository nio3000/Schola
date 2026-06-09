/**
 * R6-R2 Workbench UI — EditorToolbar horizontalization.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { EditorToolbar } from '../../../src/features/workspace/components/EditorToolbar';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('editor-toolbar-horizontal-r6-r2', () => {
  const props = {
    hasOpenFile: true,
    editorMode: 'editor' as const,
    onTogglePreview: () => {},
    onToggleSplit: () => {},
    onOpenGraph: () => {},
    onOpenAI: () => {},
    onImport: () => {},
  };

  it('renders Preview/Split/Import/Graph/AI/Export in one toolbar group', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, props));
    const order = [
      'editor-toolbar-preview',
      'editor-toolbar-split',
      'editor-toolbar-import',
      'editor-toolbar-graph',
      'editor-toolbar-ai',
      'editor-toolbar-export',
    ];

    let previousIndex = -1;
    for (const testId of order) {
      const index = html.indexOf(testId);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }

    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-label="编辑器工具栏"');
  });

  it('keeps Export disabled and action buttons accessible', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, props));
    expect(html).toContain('editor-toolbar-export');
    expect(html).toContain('disabled');
    expect(html).toContain('aria-label="导出 — Phase 5-4 可用"');
    expect(html).toContain('aria-label="Editor + Preview 左右分屏"');
  });

  it('uses a horizontal flex toolbar, not a right-side vertical rail', () => {
    const css = readProjectFile('src', 'styles.css');
    const toolbarRule = css.match(/\.schola-editor-toolbar\s*\{[^}]+\}/)?.[0] ?? '';
    expect(toolbarRule).toContain('display: flex');
    expect(toolbarRule).toContain('flex-direction: row');
    expect(toolbarRule).toContain('justify-content: flex-end');
    expect(toolbarRule).toContain('gap: 4px');
    expect(toolbarRule).not.toContain('column');
    expect(toolbarRule).not.toContain('position: fixed');
    expect(toolbarRule).not.toContain('position: absolute');
  });

  it('uses stable icon button dimensions and hover/active/disabled states', () => {
    const css = readProjectFile('src', 'styles.css');
    const buttonRule = css.match(/\.schola-editor-toolbar-btn\s*\{[^}]+\}/)?.[0] ?? '';
    expect(buttonRule).toContain('width: 28px');
    expect(buttonRule).toContain('height: 28px');
    expect(css).toContain('.schola-editor-toolbar-btn:hover:not(:disabled)');
    expect(css).toContain('.schola-editor-toolbar-btn-active');
    expect(css).toContain('.schola-editor-toolbar-btn-disabled');
  });
});
