import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProviderPage } from '../../src/features/settings/components/ProviderPage';
import { PROVIDER_PRESETS } from '../../src/lib/contracts/provider-preset.types';
import type { MaskedSecretStatus, ProviderConfig } from '../../src/lib/contracts/settings.types';

describe('provider settings Codex-like UI', () => {
  const configs: readonly ProviderConfig[] = [
    {
      providerId: 'openai',
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      customBaseURL: 'https://api.openai.com/v1',
      selectedModel: 'remote-model',
      customModels: ['manual-model'],
      remoteModels: [{ id: 'remote-model', displayName: 'Remote Model', contextWindow: 128000 }],
      lastLatencyMs: 42,
      lastLatencyTestAt: '2026-06-12T00:00:00.000Z',
      lastModelFetchAt: '2026-06-12T00:00:00.000Z',
      updatedAt: '2026-06-12T00:00:00.000Z',
    },
  ];
  const keyStatuses: readonly MaskedSecretStatus[] = [
    {
      providerId: 'openai',
      status: 'configured',
      maskedSuffix: 'sk-...abcd',
      storageType: 'safeStorage',
      updatedAt: '2026-06-12T00:00:00.000Z',
    },
  ];

  function render(): string {
    return renderToStaticMarkup(
      React.createElement(ProviderPage, {
        presets: PROVIDER_PRESETS,
        configs,
        keyStatuses,
        onRefresh: () => {},
      }),
    );
  }

  it('shows title, Codex/unified tabs, and provider chips', () => {
    const html = render();
    expect(html).toContain('模型供应商 / Model Supplier Settings');
    expect(html).toContain('Codex 供应商');
    expect(html).toContain('统一供应商');
    expect(html).toContain('provider-chip-openai');
    expect(html).toContain('provider-chip-deepseek');
  });

  it('shows API address, API key, fetch models, and latency controls', () => {
    const html = render();
    expect(html).toContain('provider-base-url-input');
    expect(html).toContain('provider-api-key-input');
    expect(html).toContain('fetch-provider-models-button');
    expect(html).toContain('test-provider-latency-button');
  });

  it('shows only current provider remote model list in mapping area', () => {
    const html = render();
    expect(html).toContain('Remote Model');
    expect(html).toContain('128000 context');
    expect(html).not.toContain('manual-model');
    expect(html).not.toContain('GPT-5.5');
  });

  it('shows BYOK notice and does not render raw API key fields', () => {
    const html = render();
    expect(html).toContain('BYOK');
    expect(html).toContain('sk-...abcd');
    expect(html).not.toContain('sk-real-secret-value');
    expect(html).not.toContain('rawKey');
    expect(html).not.toContain('plaintext');
  });
});
