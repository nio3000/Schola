import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { Experimental3DNotice } from '../../../src/features/graph/components/3DExperimentalNotice.tsx';

describe('graph-3d-experimental-boundary (P0)', () => {
  it('should render when isOpen is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(Experimental3DNotice, { isOpen: true }),
    );
    expect(html).toContain('graph-3d-experimental-notice');
  });

  it('should not render when isOpen is false', () => {
    const el = Experimental3DNotice({ isOpen: false });
    expect(el).toBeNull();
  });

  it('toggle should be disabled', () => {
    const html = renderToStaticMarkup(
      React.createElement(Experimental3DNotice, { isOpen: true }),
    );
    expect(html).toContain('disabled');
    // The checkbox should NOT be checked
    expect(html).not.toContain('checked="');
  });

  it('should mention experimental candidate', () => {
    const html = renderToStaticMarkup(
      React.createElement(Experimental3DNotice, { isOpen: true }),
    );
    expect(html).toContain('3D');
  });

  it('should NOT import or reference Three.js or WebGL', () => {
    const html = renderToStaticMarkup(
      React.createElement(Experimental3DNotice, { isOpen: true }),
    );
    expect(html).not.toContain('Three.js');
    expect(html).not.toContain('three.js');
    expect(html).not.toContain('WebGL');
    expect(html).not.toContain('webgl');
  });
});
