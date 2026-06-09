/**
 * UX Rebase — Model Selector Test (P0: UX-TB-P0-031 ~ 032)
 * Phase 5-UX-REBASE-IMP-CONTINUE.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ModelSelector } from '../../../src/features/settings/components/ModelSelector';

describe('ux-rebase model-selector-opencode-like (P0)', () => {
  const emptyKeyStatuses: readonly any[] = [];

  it('UX-TB-P0-031: has Provider dropdown and Model dropdown', () => {
    const html = renderToStaticMarkup(
      React.createElement(ModelSelector, {
        selectedProviderId: 'openai',
        selectedModel: 'gpt-4o',
        keyStatuses: [{ providerId: 'openai', status: 'configured', maskedSuffix: 'sk-...abc' }],
        onProviderChange: () => {},
        onModelChange: () => {},
        onConnectProvider: () => {},
      }),
    );
    expect(html).toContain('model-selector-provider');
    expect(html).toContain('model-selector-model');
  });

  it('UX-TB-P0-032: shows connect button when provider not connected', () => {
    const html = renderToStaticMarkup(
      React.createElement(ModelSelector, {
        selectedProviderId: 'openai',
        selectedModel: 'gpt-4o',
        keyStatuses: emptyKeyStatuses,
        onProviderChange: () => {},
        onModelChange: () => {},
        onConnectProvider: () => {},
      }),
    );
    expect(html).toContain('model-selector-connect');
  });

  it('model dropdown is disabled when provider not connected', () => {
    const html = renderToStaticMarkup(
      React.createElement(ModelSelector, {
        selectedProviderId: 'openai',
        selectedModel: 'gpt-4o',
        keyStatuses: emptyKeyStatuses,
        onProviderChange: () => {},
        onModelChange: () => {},
        onConnectProvider: () => {},
      }),
    );
    expect(html).toContain('disabled');
  });

  it('shows connected status when provider has key', () => {
    const html = renderToStaticMarkup(
      React.createElement(ModelSelector, {
        selectedProviderId: 'openai',
        selectedModel: 'gpt-4o',
        keyStatuses: [{ providerId: 'openai', status: 'configured', maskedSuffix: 'sk-...abc' }],
        onProviderChange: () => {},
        onModelChange: () => {},
        onConnectProvider: () => {},
      }),
    );
    expect(html).toContain('model-selector-status');
    expect(html).toContain('已连接');
  });
});
