import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../electron/services/provider-key-store.service', () => ({
  getProviderKey: vi.fn(() => 'stored-test-key'),
}));

describe('provider latency test', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns latencyMs for successful models endpoint round trip', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'model-a' }] }),
      })),
    );
    const { testProviderLatency } = await import('../../electron/services/model-gateway.service');
    const result = await testProviderLatency({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-secret',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.endpoint).toBe('models');
    }
  });

  it('does not send prompt or generation body', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'model-a' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { testProviderLatency } = await import('../../electron/services/model-gateway.service');
    await testProviderLatency({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-secret',
    });
    const init = fetchMock.mock.calls[0]?.[1] as { method?: string; body?: unknown } | undefined;
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(JSON.stringify(init)).not.toContain('prompt');
  });

  it('maps unauthorized safely', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: 'bad key sk-test-secret' }),
      })),
    );
    const { testProviderLatency } = await import('../../electron/services/model-gateway.service');
    const result = await testProviderLatency({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-secret',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('unauthorized');
      expect(result.error).not.toContain('sk-test-secret');
    }
  });

  it('maps network errors safely', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED sk-test-secret');
      }),
    );
    const { testProviderLatency } = await import('../../electron/services/model-gateway.service');
    const result = await testProviderLatency({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-secret',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('network_error');
      expect(result.error).not.toContain('sk-test-secret');
    }
  });
});
