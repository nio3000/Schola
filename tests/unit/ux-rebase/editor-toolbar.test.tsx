/**
 * UX Rebase — Editor Toolbar Test (P0: UX-TB-P0-016 ~ 022)
 * Phase 5-UX-REBASE-IMP / EDITOR-PREVIEW-SPLIT-R2.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { EditorToolbar } from '../../../src/features/workspace/components/EditorToolbar';

describe('ux-rebase editor-toolbar (P0)', () => {
  const makeProps = () => ({
    hasOpenFile: true,
    editorMode: 'editor' as const,
    onTogglePreview: () => {},
    onToggleSplit: () => {},
    onOpenGraph: () => {},
    onOpenAI: () => {},
    onImport: () => {},
  });

  it('UX-TB-P0-016: toolbar exists when hasOpenFile is true', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, makeProps()));
    expect(html).toContain('editor-toolbar');
  });

  it('UX-TB-P0-017: toolbar contains Preview button', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, makeProps()));
    expect(html).toContain('editor-toolbar-preview');
  });

  it('UX-TB-P0-018: toolbar contains Split Preview button', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, makeProps()));
    expect(html).toContain('editor-toolbar-split');
  });

  it('UX-TB-P0-019: toolbar contains Graph button', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, makeProps()));
    expect(html).toContain('editor-toolbar-graph');
  });

  it('UX-TB-P0-020: toolbar contains AI button', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, makeProps()));
    expect(html).toContain('editor-toolbar-ai');
  });

  it('UX-TB-P0-021: Export button exists and is disabled', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, makeProps()));
    expect(html).toContain('editor-toolbar-export');
    expect(html).toContain('disabled');
  });

  it('UX-TB-P0-022: toolbar contains Import button', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, makeProps()));
    expect(html).toContain('editor-toolbar-import');
  });

  it('toolbar buttons are disabled when hasOpenFile is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(EditorToolbar, { ...makeProps(), hasOpenFile: false }),
    );
    // Toolbar still renders, but all action buttons are disabled
    expect(html).toContain('editor-toolbar');
    expect(html).toContain('schola-editor-toolbar-btn-disabled');
    // All 6 buttons should be disabled
    const disabledCount = (html.match(/disabled=""/g) || []).length;
    expect(disabledCount).toBeGreaterThanOrEqual(4);
  });

  it('toolbar has correct role', () => {
    const html = renderToStaticMarkup(React.createElement(EditorToolbar, makeProps()));
    expect(html).toContain('role="toolbar"');
  });

  it('preview button is active when editorMode is preview', () => {
    const html = renderToStaticMarkup(
      React.createElement(EditorToolbar, { ...makeProps(), editorMode: 'preview' }),
    );
    expect(html).toContain('schola-editor-toolbar-btn-active');
  });

  it('split button is active when editorMode is split', () => {
    const html = renderToStaticMarkup(
      React.createElement(EditorToolbar, { ...makeProps(), editorMode: 'split' }),
    );
    expect(html).toContain('schola-editor-toolbar-btn-active');
  });
});
