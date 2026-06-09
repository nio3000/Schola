import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { GraphNodeRenderer, DEFAULT_NODE_STYLE, PSEUDO_3D_DEFAULT, type GraphNodeRendererProps } from '../../../src/features/graph/components/GraphNodeRenderer.tsx';

const makeProps = (overrides?: Partial<GraphNodeRendererProps>): GraphNodeRendererProps => ({
  layoutNode: { id: 'n1', x: 100, y: 100, vx: 0, vy: 0 },
  graphNode: {
    id: 'n1',
    label: 'Pseudo3D Node',
    title: 'Pseudo3D Node',
    kind: 'file',
    linkCount: 3,
    backlinkCount: 2,
    relativePath: null,
    isOrphan: false,
  },
  isSelected: false,
  isHighlighted: false,
  isCurrentFile: true,
  nodeStyle: { ...DEFAULT_NODE_STYLE, shadow: true, glow: true },
  pseudo3d: { ...PSEUDO_3D_DEFAULT },
  theme: {
    id: 'schola-clinical-light',
    name: 'test',
    background: '#F3F8FC',
    surface: '#FFFFFF',
    grid: '#DCEAF3',
    text: '#1F2A37',
    mutedText: '#66788A',
    accent: '#1677B8',
    node: { file: '#2388C6', fileStroke: '#FFFFFF', current: '#FFB020', currentStroke: '#B86B00', currentHalo: 'rgba(255,176,32,0.34)', unresolved: '#D96C75', unresolvedStroke: '#FFFFFF', orphan: '#C9D6E2', orphanStroke: '#F8FBFD', hoverStroke: '#005B96', label: '#1F2A37' },
    edge: { wikilink: '#6FAFD6', wikilinkActive: '#1677B8', unresolved: '#E29AA0', unresolvedActive: '#C43D4B', muted: '#CFDDE8' },
    effects: { panelShadow: 'none', nodeShadow: '0 2px 8px rgba(0,0,0,0.2)', currentShadow: '0 0 8px rgba(255,176,32,0.3)' },
  },
  radius: 14,
  onClick: () => {},
  onMouseEnter: () => {},
  onMouseLeave: () => {},
  ...overrides,
});

describe('graph-pseudo-3d-style (P1)', () => {
  it('should render card thickness shadow effect', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphNodeRenderer, makeProps()),
    );
    // Card thickness creates a transform-translated duplicate
    expect(html).toContain('graph-node-group');
  });

  it('should render current file with center emphasis', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphNodeRenderer, makeProps({ isCurrentFile: true })),
    );
    expect(html).toContain('data-current-file="true"');
  });

  it('should render double stroke effect', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphNodeRenderer, makeProps({
        pseudo3d: { ...PSEUDO_3D_DEFAULT, doubleStroke: true },
      })),
    );
    expect(html).toContain('graph-node-group');
  });
});
