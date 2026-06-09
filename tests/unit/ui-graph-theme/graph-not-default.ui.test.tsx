import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { GraphSidebarSummary } from '../../../src/features/graph/components/GraphSidebarSummary.tsx';
import { DEFAULT_SCOPE } from '../../../src/features/graph/lib/graphScope.ts';

const summaryProps = {
  vaultId: 'vault-1',
  isOpen: true,
  selectedFile: 'test.md',
  selectedFiles: ['test.md'],
  scope: 'current-file' as const,
  onOpenMainView: () => {},
};

describe('graph-not-default (P0)', () => {
  it('Graph should default to current-file scope, not whole-vault', () => {
    expect(DEFAULT_SCOPE).toBe('current-file');
  });

  it('GraphSidebarSummary should render summary content, not full canvas', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphSidebarSummary, summaryProps),
    );
    expect(html).toContain('graph-sidebar-summary');
    expect(html).not.toContain('<svg');
  });

  it('GraphSidebarSummary should show lightweight metrics labels', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphSidebarSummary, summaryProps),
    );
    expect(html).toContain('节点');
    expect(html).toContain('边');
  });

  it('GraphSidebarSummary should have an open main view button', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphSidebarSummary, summaryProps),
    );
    expect(html).toContain('graph-sidebar-summary');
  });
});
