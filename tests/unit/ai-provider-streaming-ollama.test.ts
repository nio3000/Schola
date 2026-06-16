import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderPreset } from '../../src/lib/contracts/provider-preset.types';

const mocks = vi.hoisted(() => ({
  getProviderPreset: vi.fn(),
  getProviderKey: vi.fn(),
}));

vi.mock('../../src/lib/contracts/provider-preset.types', () => ({
  getProviderPreset: mocks.getProviderPreset,
}));

vi.mock('../../electron/services/provider-key-store.service', () => ({
  getProviderKey: mocks.getProviderKey,
}));

const OLLAMA_PRESET: ProviderPreset = {
  id: 'ollama',
  kind: 'ollama',
  displayName: 'Ollama',
  protocol: 'ollama',
  baseURL: 'http://127.0.0.1:11434/',
  defaultModel: 'llama3',
  authType: 'none',
  authHeader: '',
  billingMode: 'local-free',
  capabilities: ['chat', 'local'],
  description: 'Local streaming provider.',
};

function ndjsonResponse(lines: readonly string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line));
      }
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'application/x-ndjson' } });
}

function idleNdjsonResponse(): Response {
  const body = new ReadableStream<Uint8Array>({
    start() {
      // Intentionally idle: exercises body-phase idle timeout.
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
}

function delayedNdjsonResponse(): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      setTimeout(() => {
        controller.enqueue(encoder.encode('{"message":{"content":"本"},"done":false}\n'));
      }, 9_000);
      setTimeout(() => {
        controller.enqueue(encoder.encode('{"message":{"content":"地"},"done":false}\n'));
        controller.enqueue(encoder.encode('{"done":true}\n'));
        controller.close();
      }, 18_000);
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
}

function firstFetch(): readonly [RequestInfo | URL, RequestInit | undefined] {
  const fetchMock = vi.mocked(globalThis.fetch);
  return fetchMock.mock.calls[0] as readonly [RequestInfo | URL, RequestInit | undefined];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  mocks.getProviderPreset.mockReturnValue(OLLAMA_PRESET);
  mocks.getProviderKey.mockReturnValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Ollama streaming provider', () => {
  it('AI-C-STREAM-004/005 parses NDJSON chunks in order', async () => {
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    const chunks: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ndjsonResponse([
          '{"message":{"content":"本地"},"done":false}\n',
          '{"message":{"content":"模型"},"done":false}\n',
          '{"done":true}\n',
        ]),
      ),
    );

    const result = await executeStreamingInvocation(
      'task-ollama-1',
      'ollama',
      'llama3',
      'analysis_summary',
      'system',
      'user',
      [],
      0,
      (chunk) => chunks.push(chunk),
    );

    const [url, init] = firstFetch();
    const body = JSON.parse(String(init?.body ?? '{}')) as { readonly stream?: boolean };
    expect(String(url)).toBe('http://127.0.0.1:11434/api/chat');
    expect(body.stream).toBe(true);
    expect(chunks).toEqual(['本地', '模型']);
    expect(result.artifact.content).toBe('本地模型');
  });

  it('AI-C-P0-005 does not require or send an API key for Ollama streaming', async () => {
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ndjsonResponse(['{"message":{"content":"ok"},"done":true}\n'])),
    );

    await executeStreamingInvocation(
      'task-ollama-2',
      'ollama',
      'llama3',
      'analysis_summary',
      'system',
      'user',
      [],
      0,
      vi.fn(),
    );

    const [, init] = firstFetch();
    expect(mocks.getProviderKey).not.toHaveBeenCalled();
    expect(init?.headers).not.toHaveProperty('Authorization');
  });

  it('AI-C-GEN-014 times out during Ollama NDJSON body idle phase', async () => {
    vi.useFakeTimers();
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => idleNdjsonResponse()),
    );

    const result = executeStreamingInvocation(
      'task-ollama-idle',
      'ollama',
      'llama3',
      'analysis_summary',
      'system',
      'user',
      [],
      0,
      vi.fn(),
    );

    const assertion = expect(result).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it('AI-C-GEN-014 resets Ollama NDJSON idle timer after content chunks', async () => {
    vi.useFakeTimers();
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    const chunks: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => delayedNdjsonResponse()),
    );

    const result = executeStreamingInvocation(
      'task-ollama-reset',
      'ollama',
      'llama3',
      'analysis_summary',
      'system',
      'user',
      [],
      0,
      (chunk) => chunks.push(chunk),
    );

    await vi.advanceTimersByTimeAsync(9_000);
    await vi.advanceTimersByTimeAsync(9_000);
    await expect(result).resolves.toMatchObject({ artifact: { content: '本地' } });
    expect(chunks).toEqual(['本', '地']);
  });
});
