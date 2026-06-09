import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ScholaIcon } from '../../../src/features/icons/ScholaIcon.tsx';
import type { ScholaIconId } from '../../../src/features/icons/schola-icons.ts';

describe('activity-bar-icons (P1)', () => {
  const iconIds: ScholaIconId[] = ['files', 'search', 'graph', 'ai-research', 'artifacts', 'plugins', 'settings'];

  for (const iconId of iconIds) {
    it(`ScholaIcon "${iconId}" should render an SVG`, () => {
      const html = renderToStaticMarkup(
        React.createElement(ScholaIcon, { iconId, size: 20 }),
      );
      expect(html).toContain('<svg');
      expect(html).toContain('</svg>');
    });

    it(`ScholaIcon "${iconId}" should have strokeWidth 1.5`, () => {
      const html = renderToStaticMarkup(
        React.createElement(ScholaIcon, { iconId, size: 20 }),
      );
      expect(html).toContain('strokeWidth="1.5"');
    });
  }

  it('ScholaIcon should respect size prop', () => {
    const html = renderToStaticMarkup(
      React.createElement(ScholaIcon, { iconId: 'files', size: 22 }),
    );
    expect(html).toContain('width="22"');
    expect(html).toContain('height="22"');
  });

  it('ScholaIcon should apply className', () => {
    const html = renderToStaticMarkup(
      React.createElement(ScholaIcon, { iconId: 'files', size: 20, className: 'test-icon' }),
    );
    expect(html).toContain('test-icon');
  });

  it('All icons should render SVG path elements', () => {
    for (const iconId of iconIds) {
      const html = renderToStaticMarkup(
        React.createElement(ScholaIcon, { iconId, size: 20 }),
      );
      expect(html).toContain('<svg');
    }
  });
});
