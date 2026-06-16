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

const OPENAI_PRESET: ProviderPreset = {
  id: 'openai',
  kind: 'openai',
  displayName: 'OpenAI',
  protocol: 'openai-compatible',
  baseURL: 'https://api.openai.com/v1',
  defaultModel: 'gpt-5.5',
  authType: 'bearer',
  authHeader: 'Authorization',
  billingMode: 'byok',
  capabilities: ['chat'],
  description: 'Streaming test provider.',
};

function streamResponse(lines: readonly string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line));
      }
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

function idleStreamResponse(): Response {
  const body = new ReadableStream<Uint8Array>({
    start() {
      // Intentionally never enqueue or close: exercises body-phase idle timeout.
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function delayedStreamResponse(): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      setTimeout(() => {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"A"}}]}\n\n'));
      }, 9_000);
      setTimeout(() => {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"B"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }, 18_000);
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function firstFetchBody(): { readonly stream?: boolean } {
  const fetchMock = vi.mocked(globalThis.fetch);
  const init = fetchMock.mock.calls[0]?.[1];
  return JSON.parse(String(init?.body ?? '{}')) as { readonly stream?: boolean };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  mocks.getProviderPreset.mockReturnValue(OPENAI_PRESET);
  mocks.getProviderKey.mockReturnValue('sk-test-secret-12345678901234567890');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('OpenAI-compatible streaming provider', () => {
  it('AI-C-STREAM-004/005 parses SSE content chunks in order', async () => {
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    const chunks: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      ),
    );

    const result = await executeStreamingInvocation(
      'task-stream-1',
      'openai',
      'gpt-5.5',
      'analysis_summary',
      'system',
      'user',
      [],
      0,
      (chunk) => chunks.push(chunk),
    );

    expect(firstFetchBody().stream).toBe(true);
    expect(chunks).toEqual(['Hel', 'lo']);
    expect(result.artifact.content).toBe('Hello');
    expect(result.metadata.streaming).toBe(true);
  });

  it('AI-C-STREAM-004 supports message.content fallback chunks', async () => {
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    const chunks: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse([
          'data: {"choices":[{"message":{"content":"fallback"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      ),
    );

    const result = await executeStreamingInvocation(
      'task-stream-2',
      'openai',
      'gpt-5.5',
      'analysis_summary',
      'system',
      'user',
      [],
      0,
      (chunk) => chunks.push(chunk),
    );

    expect(chunks).toEqual(['fallback']);
    expect(result.artifact.content).toBe('fallback');
  });

  it('AI-C-STREAM-007 maps provider errors to sanitized errors', async () => {
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamResponse([], 401)),
    );

    await expect(
      executeStreamingInvocation(
        'task-stream-3',
        'openai',
        'gpt-5.5',
        'analysis_summary',
        'system',
        'user',
        [],
        0,
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: 'unauthorized', retryable: false });
  });

  it('AI-C-GEN-016 preserves rate_limited code in streaming errors', async () => {
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamResponse([], 429)),
    );

    await expect(
      executeStreamingInvocation(
        'task-stream-rate',
        'openai',
        'gpt-5.5',
        'analysis_summary',
        'system',
        'user',
        [],
        0,
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: 'rate_limited', retryable: true });
  });

  it('AI-C-GEN-013 preserves timeout code for streaming fetch aborts', async () => {
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    const abortError = Object.assign(new Error('request aborted'), { name: 'AbortError' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw abortError;
      }),
    );

    await expect(
      executeStreamingInvocation(
        'task-stream-timeout',
        'openai',
        'gpt-5.5',
        'analysis_summary',
        'system',
        'user',
        [],
        0,
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: 'timeout', retryable: true });
  });

  it('AI-C-GEN-017 preserves network_error and sanitizes secrets, bearer, authorization, and paths', async () => {
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error(
          'network failed sk-abcdefghijklmnopqrstuvwxyz Authorization: Bearer raw-token-123456 C:\\Users\\secret\\file.txt',
        );
      }),
    );

    await expect(
      executeStreamingInvocation(
        'task-stream-network',
        'openai',
        'gpt-5.5',
        'analysis_summary',
        'system',
        'user',
        [],
        0,
        vi.fn(),
      ),
    ).rejects.toMatchObject({
      code: 'network_error',
      message: expect.not.stringMatching(/sk-|raw-token|Authorization: Bearer|C:\\Users/),
    });
  });

  it('AI-C-STREAM-007 preserves empty_response code for empty streaming bodies', async () => {
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamResponse(['data: [DONE]\n\n'])),
    );

    await expect(
      executeStreamingInvocation(
        'task-stream-empty',
        'openai',
        'gpt-5.5',
        'analysis_summary',
        'system',
        'user',
        [],
        0,
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: 'empty_response', retryable: true });
  });

  it('AI-C-GEN-014 times out during OpenAI SSE body idle phase', async () => {
    vi.useFakeTimers();
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => idleStreamResponse()),
    );

    const result = executeStreamingInvocation(
      'task-stream-idle',
      'openai',
      'gpt-5.5',
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

  it('AI-C-GEN-014 resets OpenAI SSE idle timer after content chunks', async () => {
    vi.useFakeTimers();
    const { executeStreamingInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    const chunks: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => delayedStreamResponse()),
    );

    const result = executeStreamingInvocation(
      'task-stream-reset',
      'openai',
      'gpt-5.5',
      'analysis_summary',
      'system',
      'user',
      [],
      0,
      (chunk) => chunks.push(chunk),
    );

    await vi.advanceTimersByTimeAsync(9_000);
    await vi.advanceTimersByTimeAsync(9_000);
    await expect(result).resolves.toMatchObject({ artifact: { content: 'AB' } });
    expect(chunks).toEqual(['A', 'B']);
  });
});
