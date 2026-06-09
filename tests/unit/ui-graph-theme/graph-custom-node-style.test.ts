import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { GraphNodeRenderer, DEFAULT_NODE_STYLE, PSEUDO_3D_DEFAULT, type GraphNodeRendererProps } from '../../../src/features/graph/components/GraphNodeRenderer.tsx';

const makeProps = (overrides?: Partial<GraphNodeRendererProps>): GraphNodeRendererProps => ({
  layoutNode: { id: 'n1', x: 100, y: 100, vx: 0, vy: 0 },
  graphNode: {
    id: 'n1',
    label: 'Test Node',
    title: 'Test Node',
    kind: 'file',
    linkCount: 2,
    backlinkCount: 1,
    relativePath: null,
    isOrphan: false,
  },
  isSelected: false,
  isHighlighted: false,
  isCurrentFile: false,
  nodeStyle: DEFAULT_NODE_STYLE,
  pseudo3d: PSEUDO_3D_DEFAULT,
  theme: {
    id: 'schola-clinical-light',
    name: 'test',
    background: '#fff',
    surface: '#fff',
    grid: '#eee',
    text: '#000',
    mutedText: '#666',
    accent: '#00f',
    node: { file: '#4a90d9', fileStroke: '#fff', current: '#ff0', currentStroke: '#f00', currentHalo: '#ff0', unresolved: '#f00', unresolvedStroke: '#fff', orphan: '#ccc', orphanStroke: '#fff', hoverStroke: '#00f', label: '#000' },
    edge: { wikilink: '#999', wikilinkActive: '#00f', unresolved: '#f00', unresolvedActive: '#f00', muted: '#ddd' },
    effects: { panelShadow: 'none', nodeShadow: 'none', currentShadow: 'none' },
  },
  radius: 12,
  onClick: () => {},
  onMouseEnter: () => {},
  onMouseLeave: () => {},
  ...overrides,
});

describe('graph-custom-node-style (P1)', () => {
  it('should render node as SVG group', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphNodeRenderer, makeProps()),
    );
    expect(html).toContain('graph-node-group');
    expect(html).toContain('<g');
  });

  it('should render circle shape by default', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphNodeRenderer, makeProps()),
    );
    expect(html).toContain('<circle');
  });

  it('should render rectangle shape when specified', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphNodeRenderer, makeProps({
        nodeStyle: { ...DEFAULT_NODE_STYLE, shape: 'rectangle' },
      })),
    );
    expect(html).toContain('<rect');
  });

  it('should render hexagon shape when specified', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphNodeRenderer, makeProps({
        nodeStyle: { ...DEFAULT_NODE_STYLE, shape: 'hexagon' },
      })),
    );
    expect(html).toContain('<polygon');
  });

  it('should render diamond shape when specified', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphNodeRenderer, makeProps({
        nodeStyle: { ...DEFAULT_NODE_STYLE, shape: 'diamond' },
      })),
    );
    expect(html).toContain('<polygon');
  });

  it('should contain label text', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphNodeRenderer, makeProps()),
    );
    expect(html).toContain('Test Node');
  });

  it('should apply data attributes for selected state', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphNodeRenderer, makeProps({ isSelected: true })),
    );
    expect(html).toContain('data-selected="true"');
  });
});
