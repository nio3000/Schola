import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../electron/services/provider-key-store.service', () => ({
  getProviderKey: vi.fn(() => 'stored-test-key'),
}));

describe('provider model fetch', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('normalizes baseUrl by appending /v1/models', async () => {
    const { normalizeProviderModelsUrl } =
      await import('../../electron/services/model-gateway.service');
    expect(normalizeProviderModelsUrl('https://api.deepseek.com', 'deepseek')).toBe(
      'https://api.deepseek.com/v1/models',
    );
  });

  it('does not duplicate /models', async () => {
    const { normalizeProviderModelsUrl } =
      await import('../../electron/services/model-gateway.service');
    expect(normalizeProviderModelsUrl('https://api.deepseek.com/v1/models', 'deepseek')).toBe(
      'https://api.deepseek.com/v1/models',
    );
  });

  it('parses OpenAI-compatible data[]', async () => {
    const { parseProviderModelsResponse } =
      await import('../../electron/services/model-gateway.service');
    const models = parseProviderModelsResponse({
      data: [{ id: 'model-a', owned_by: 'provider' }],
    });
    expect(models).toEqual([{ id: 'model-a', displayName: 'model-a', ownedBy: 'provider' }]);
  });

  it('parses object models[] and string models[]', async () => {
    const { parseProviderModelsResponse } =
      await import('../../electron/services/model-gateway.service');
    expect(parseProviderModelsResponse({ models: [{ id: 'model-b' }] })[0]?.id).toBe('model-b');
    expect(parseProviderModelsResponse({ models: ['model-c'] })[0]?.id).toBe('model-c');
  });

  it('returns missing_base_url without network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { fetchProviderModels } = await import('../../electron/services/model-gateway.service');
    const result = await fetchProviderModels({ providerId: 'openai', baseUrl: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('missing_base_url');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps 401 to unauthorized and does not include API key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: 'bad key sk-secret-value' }),
      })),
    );
    const { fetchProviderModels } = await import('../../electron/services/model-gateway.service');
    const result = await fetchProviderModels({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-secret-value',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('unauthorized');
      expect(result.error).not.toContain('sk-secret-value');
    }
  });

  it('fetches only models endpoint and never generation endpoints', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'model-a' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchProviderModels } = await import('../../electron/services/model-gateway.service');
    const result = await fetchProviderModels({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-secret',
    });
    expect(result.ok).toBe(true);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/models');
    expect(url).not.toContain('/chat/completions');
    expect(url).not.toContain('/responses');
    expect(url).not.toContain('/messages');
  });
});
