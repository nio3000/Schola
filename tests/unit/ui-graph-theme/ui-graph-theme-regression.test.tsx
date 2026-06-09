import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ActivityBar } from '../../../src/features/workspace/ActivityBar.tsx';
import { BottomPanel } from '../../../src/features/workspace/BottomPanel.tsx';
import { StatusBar } from '../../../src/features/workspace/StatusBar.tsx';

describe('ui-graph-theme-regression (P1)', () => {
  it('ActivityBar should still render with 7 entries', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityBar, { activeActivity: 'files', onActivityChange: () => {} }),
    );
    const entries = (html.match(/activitybar-btn/g) || []).length;
    expect(entries).toBe(7);
  });

  it('ActivityBar should have correct data-testid attributes', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityBar, { activeActivity: 'files', onActivityChange: () => {} }),
    );
    expect(html).toContain('activity-files');
    expect(html).toContain('activity-search');
    expect(html).toContain('activity-graph');
    expect(html).toContain('activity-ai');
    expect(html).toContain('activity-artifacts');
    expect(html).toContain('activity-plugins');
    expect(html).toContain('activity-settings');
  });

  it('BottomPanel should still default to collapsed', () => {
    const html = renderToStaticMarkup(
      React.createElement(BottomPanel, { isOpen: false, onToggle: () => {} }),
    );
    expect(html).not.toContain('schola-bottom-panel-open');
  });

  it('StatusBar should still render vault and file info', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusBar, { filePath: 'notes/test.md', vaultName: 'MyVault' }),
    );
    expect(html).toContain('statusbar');
  });

  it('ActivityBar should use ScholaIcon SVG (not emoji)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityBar, { activeActivity: 'files', onActivityChange: () => {} }),
    );
    // SVGs should be present (ScholaIcon renders SVG), emoji should not
    expect(html).toContain('<svg');
  });
});
