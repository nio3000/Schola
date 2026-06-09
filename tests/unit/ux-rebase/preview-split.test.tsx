/**
 * UX Rebase — Preview Split Test (P0: UX-TB-P0-013 ~ 014)
 * Phase 5-UX-REBASE-IMP-CONTINUE / EDITOR-PREVIEW-SPLIT-R2.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { EditorToolbar } from '../../../src/features/workspace/components/EditorToolbar';

describe('ux-rebase preview-split (P0)', () => {
  const makeProps = () => ({
    hasOpenFile: true,
    editorMode: 'editor' as const,
    onTogglePreview: () => {},
    onToggleSplit: () => {},
    onOpenGraph: () => {},
    onOpenAI: () => {},
    onImport: () => {},
  });

  it('UX-TB-P0-013: Preview button exists and is not disabled when file open', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, makeProps()));
    expect(html).toContain('editor-toolbar-preview');
  });

  it('UX-TB-P0-014: Split Preview button exists and is not disabled when file open', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, makeProps()));
    expect(html).toContain('editor-toolbar-split');
  });

  it('Export button is disabled', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, makeProps()));
    expect(html).toContain('editor-toolbar-export');
    expect(html).toContain('disabled');
  });

  it('preview button shows active state in preview mode', () => {
    const html = renderToStaticMarkup(
      React.createElement(EditorToolbar, { ...makeProps(), editorMode: 'preview' }),
    );
    expect(html).toContain('schola-editor-toolbar-btn-active');
  });

  it('split button shows active state in split mode', () => {
    const html = renderToStaticMarkup(
      React.createElement(EditorToolbar, { ...makeProps(), editorMode: 'split' }),
    );
    expect(html).toContain('schola-editor-toolbar-btn-active');
  });

  it('preview and split buttons are disabled when no file open', () => {
    const html = renderToStaticMarkup(
      React.createElement(EditorToolbar, { ...makeProps(), hasOpenFile: false }),
    );
    expect(html).toContain('editor-toolbar-preview');
    expect(html).toContain('editor-toolbar-split');
    expect(html).toContain('schola-editor-toolbar-btn-disabled');
  });
});
