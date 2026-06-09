import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { GraphStylePanel } from '../../../src/features/graph/components/GraphStylePanel.tsx';
import { DEFAULT_STYLE_CONFIG } from '../../../src/features/graph/lib/graphTypes.ts';

describe('graph-style-panel (P1)', () => {
  it('should render when isOpen is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphStylePanel, {
        styleConfig: DEFAULT_STYLE_CONFIG,
        onChange: () => {},
        isOpen: true,
        onClose: () => {},
      }),
    );
    expect(html).toContain('graph-style-panel');
  });

  it('should not render when isOpen is false', () => {
    const el = GraphStylePanel({
      styleConfig: DEFAULT_STYLE_CONFIG,
      onChange: () => {},
      isOpen: false,
      onClose: () => {},
    });
    expect(el).toBeNull();
  });

  it('should have node size control', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphStylePanel, {
        styleConfig: DEFAULT_STYLE_CONFIG,
        onChange: () => {},
        isOpen: true,
        onClose: () => {},
      }),
    );
    expect(html).toContain('style-node-size');
  });

  it('should have node color control', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphStylePanel, {
        styleConfig: DEFAULT_STYLE_CONFIG,
        onChange: () => {},
        isOpen: true,
        onClose: () => {},
      }),
    );
    expect(html).toContain('style-node-color');
  });

  it('should have edge width control', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphStylePanel, {
        styleConfig: DEFAULT_STYLE_CONFIG,
        onChange: () => {},
        isOpen: true,
        onClose: () => {},
      }),
    );
    expect(html).toContain('style-edge-width');
  });

  it('should have show labels toggle', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphStylePanel, {
        styleConfig: DEFAULT_STYLE_CONFIG,
        onChange: () => {},
        isOpen: true,
        onClose: () => {},
      }),
    );
    expect(html).toContain('style-show-labels');
  });

  it('should have close button', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphStylePanel, {
        styleConfig: DEFAULT_STYLE_CONFIG,
        onChange: () => {},
        isOpen: true,
        onClose: () => {},
      }),
    );
    expect(html).toContain('graph-style-panel-close');
  });
});
