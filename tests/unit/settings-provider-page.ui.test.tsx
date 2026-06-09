import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'vitest';

import { ProviderPage } from '../../src/features/settings/components/ProviderPage';
import type { ProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import type { MaskedSecretStatus, ProviderConfig } from '../../src/lib/contracts/settings.types';

(globalThis as Record<string, unknown>).window = {
  schola: {
    settings: {
      setApiKey: async (providerId: string): Promise<MaskedSecretStatus> => ({
        providerId,
        status: 'configured',
        maskedSuffix: 'sk-...abc4',
        storageType: 'memory',
      }),
      clearApiKey: async (providerId: string): Promise<MaskedSecretStatus> => ({
        providerId,
        status: 'not-configured',
      }),
      setProviderConfig: async (
        providerId: string,
        config: Partial<ProviderConfig>,
      ): Promise<ProviderConfig> => ({
        providerId,
        enabled: config.enabled ?? false,
        updatedAt: '',
      }),
    },
  },
};

const mockPresets: ProviderPreset[] = [
  {
    id: 'ollama',
    kind: 'ollama',
    displayName: 'Ollama',
    protocol: 'ollama',
    baseURL: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    capabilities: [],
    billingMode: 'local-free' as const,
    authType: 'none' as const,
    authHeader: '',
    description: '本地提供者，免 Key。',
  },
  {
    id: 'openai',
    kind: 'openai',
    displayName: 'OpenAI',
    protocol: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    capabilities: ['chat'],
    billingMode: 'byok' as const,
    authType: 'bearer' as const,
    authHeader: 'Authorization',
    description: 'Requires your own API key.',
  },
];

const mockConfigs: ProviderConfig[] = [
  { providerId: 'ollama', enabled: true, updatedAt: '' },
  { providerId: 'openai', enabled: false, updatedAt: '' },
];

const mockKeyStatuses: MaskedSecretStatus[] = [
  { providerId: 'ollama', status: 'not-configured' },
  {
    providerId: 'openai',
    status: 'configured',
    maskedSuffix: 'sk-...abc4',
    storageType: 'memory',
  },
];

function renderProviderPage(
  presets: ProviderPreset[] = mockPresets,
  configs: ProviderConfig[] = mockConfigs,
  keyStatuses: MaskedSecretStatus[] = mockKeyStatuses,
): string {
  return renderToStaticMarkup(
    React.createElement(ProviderPage, {
      presets,
      configs,
      keyStatuses,
      onRefresh: () => {},
    }),
  );
}

describe('ProviderPage UI', () => {
  it('renders a provider settings page test id', () => {
    const html = renderProviderPage();

    assert.match(html, /data-testid="settings-provider-page"/);
  });

  it('renders provider presets list when presets are provided', () => {
    const html = renderProviderPage();

    assert.match(html, /data-testid="settings-provider-ollama"/);
    assert.match(html, /data-testid="settings-provider-openai"/);
    assert.match(html, /Ollama/);
    assert.match(html, /OpenAI/);
  });

  it('shows API Key related text', () => {
    const html = renderProviderPage();

    assert.match(html, /API Key/);
  });

  it('shows masked key status display for configured providers', () => {
    const html = renderProviderPage();

    assert.match(html, /sk-\.\.\.abc4/);
  });

  it('shows not-configured status for providers without keys', () => {
    const html = renderProviderPage();

    assert.match(html, /未配置/);
  });

  it('has enabled and disabled toggles for providers', () => {
    const html = renderProviderPage();

    assert.match(html, /data-testid="settings-provider-toggle-ollama"/);
    assert.match(html, /已启用/);
    assert.match(html, /data-testid="settings-provider-toggle-openai"/);
    assert.match(html, /已禁用/);
  });

  it('shows local ollama provider as key-free', () => {
    const html = renderProviderPage();

    assert.match(html, /Ollama/);
    assert.match(html, /免 Key/);
  });

  it('does not contain provider-ready text', () => {
    const html = renderProviderPage();

    assert.doesNotMatch(html, /provider-ready/i);
  });

  it('does not contain marketplace-ready text', () => {
    const html = renderProviderPage();

    assert.doesNotMatch(html, /marketplace-ready/i);
  });

  it('does not contain runtime-ready text', () => {
    const html = renderProviderPage();

    assert.doesNotMatch(html, /runtime-ready/i);
  });

  it('does not contain test connection text', () => {
    const html = renderProviderPage();

    assert.doesNotMatch(html, /test connection/i);
  });

  it('renders API key input as password when key entry is open', async () => {
    const { vi } = await import('vitest');

    vi.resetModules();
    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof React>();
      let stateIndex = 0;

      return {
        ...actual,
        useState: <State,>(initialState: State) => {
          stateIndex += 1;
          const value = stateIndex === 1 ? 'openai' : initialState;

          return [value, () => {}] as const;
        },
      };
    });

    try {
      const { ProviderPage: ProviderPageWithOpenKeyForm } = await import(
        '../../src/features/settings/components/ProviderPage'
      );
      const html = renderToStaticMarkup(
        React.createElement(ProviderPageWithOpenKeyForm, {
          presets: mockPresets,
          configs: mockConfigs,
          keyStatuses: mockKeyStatuses,
          onRefresh: () => {},
        }),
      );

      assert.match(html, /data-testid="settings-key-input-openai"/);
      assert.match(html, /type="password"/);
    } finally {
      vi.doUnmock('react');
      vi.resetModules();
    }
  });
});
