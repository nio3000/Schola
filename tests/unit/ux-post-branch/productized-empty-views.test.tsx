/**
 * UX Post-Branch — Productized Empty Views Test
 * Phase 5-UX-POST-BRANCH-CLOSE-BATCH.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ArtifactEmptyView, PluginPreviewOnlyView } from '../../../src/features/workspace/views/ProductizedEmptyViews';

describe('ux-post-branch productized-empty-views', () => {
  it('Artifact view renders disabled export/save', () => {
    const html = renderToStaticMarkup(React.createElement(ArtifactEmptyView));
    expect(html).toContain('artifact-empty-view');
    expect(html).toContain('artifact-export-btn');
    expect(html).toContain('artifact-save-btn');
    expect(html).toContain('disabled');
  });

  it('Plugin view renders preview-only', () => {
    const html = renderToStaticMarkup(React.createElement(PluginPreviewOnlyView));
    expect(html).toContain('plugin-preview-view');
    expect(html).toContain('Phase 5-P');
    // Not real plugin runtime
    expect(html).not.toContain('install');
    expect(html).not.toContain('enable');
  });
});
