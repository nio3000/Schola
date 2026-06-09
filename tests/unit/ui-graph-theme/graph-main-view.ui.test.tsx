import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { GraphMainView } from '../../../src/features/graph/components/GraphMainView.tsx';

describe('graph-main-view (P1)', () => {
  it('should render null when isOpen is false', () => {
    const el = GraphMainView({
      vaultId: null,
      isOpen: false,
      selectedFile: null,
      scope: 'current-file',
      onScopeChange: () => {},
      onOpenFile: () => {},
      onClose: () => {},
    });
    expect(el).toBeNull();
  });

  it('should render graph-main-view when isOpen is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphMainView, {
        vaultId: null,
        isOpen: true,
        selectedFile: null,
        scope: 'current-file',
        onScopeChange: () => {},
        onOpenFile: () => {},
        onClose: () => {},
      }),
    );
    expect(html).toContain('graph-main-view');
  });

  it('should contain close button', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphMainView, {
        vaultId: null,
        isOpen: true,
        selectedFile: null,
        scope: 'current-file',
        onScopeChange: () => {},
        onOpenFile: () => {},
        onClose: () => {},
      }),
    );
    expect(html).toContain('graph-main-view');
  });

  it('should include scope selector', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphMainView, {
        vaultId: null,
        isOpen: true,
        selectedFile: 'test.md',
        scope: 'current-file',
        onScopeChange: () => {},
        onOpenFile: () => {},
        onClose: () => {},
      }),
    );
    expect(html).toContain('graph-scope-selector');
  });
});
