/**
 * Provider Generation Request unit tests �?Phase 5-5-C-IMP-2.
 *
 * Covers provider preflight, main-process gateway request construction,
 * renderer/main chat request type separation, and sanitization guardrails.
 */
import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  RendererChatRequest,
  MainChatRequest,
} from '../../src/lib/contracts/ai-provider.types';
import type { ContextConfirmation } from '../../src/lib/contracts/context-pack.types';
import type { ProviderPreset } from '../../src/lib/contracts/provider-preset.types';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (event: unknown, input: unknown) => unknown>();

  return {
    handlers,
    getProviderPreset: vi.fn(),
    getProviderKey: vi.fn(),
    getProviderKeyStatus: vi.fn(),
    getProviderConfig: vi.fn(),
    getPrivacyConsent: vi.fn(),
    getContextSendPolicy: vi.fn(),
    getAIPreferences: vi.fn(),
    getContextConfirmation: vi.fn(),
    previewContextPack: vi.fn(),
    getContextPackContent: vi.fn(),
    buildEvidenceRefsForContextPack: vi.fn(),
    getTaskRequest: vi.fn(),
    startTaskExecution: vi.fn(),
    getTaskAbortSignal: vi.fn(),
    clearTaskAbortController: vi.fn(),
    markTaskStreaming: vi.fn(),
    isTaskCancelled: vi.fn(),
    storeTaskResult: vi.fn(),
    failTask: vi.fn(),
    getTaskStatus: vi.fn(),
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (event: unknown, input: unknown) => unknown) => {
      mocks.handlers.set(channel, handler);
    }),
  },
}));

vi.mock('../../src/lib/contracts/provider-preset.types', () => ({
  getProviderPreset: mocks.getProviderPreset,
  PROVIDER_PRESETS: [],
}));

vi.mock('../../electron/services/provider-key-store.service', () => ({
  getProviderKey: mocks.getProviderKey,
  getProviderKeyStatus: mocks.getProviderKeyStatus,
}));

vi.mock('../../electron/services/settings-store.service', () => ({
  getProviderConfig: mocks.getProviderConfig,
  getPrivacyConsent: mocks.getPrivacyConsent,
  getContextSendPolicy: mocks.getContextSendPolicy,
  getAIPreferences: mocks.getAIPreferences,
}));

vi.mock('../../electron/services/context-pack.service', () => ({
  getContextConfirmation: mocks.getContextConfirmation,
}));

vi.mock('../../electron/services/ai-research-context.service', () => ({
  previewContextPack: mocks.previewContextPack,
  getContextPackContent: mocks.getContextPackContent,
  buildEvidenceRefsForContextPack: mocks.buildEvidenceRefsForContextPack,
  getProviderReadiness: vi.fn(),
  buildContextPack: vi.fn(),
}));

vi.mock('../../electron/services/ai-research-task.service', () => ({
  buildInvocationMetadata: vi.fn(
    (
      taskId: string,
      providerId: string,
      model: string,
      taskType: string,
      contextFileCount: number,
      approxTokens: number,
      durationMs: number,
      streaming: boolean,
    ) => ({
      taskId,
      providerId,
      model,
      taskType,
      contextFileCount,
      approxTokens,
      durationMs,
      streaming,
      createdAt: '2026-06-15T00:00:00.000Z',
    }),
  ),
  createTaskDraft: vi.fn(),
  startTaskExecution: mocks.startTaskExecution,
  cancelTask: vi.fn(),
  getTaskStatus: mocks.getTaskStatus,
  getTaskResult: vi.fn(),
  clearTaskResult: vi.fn(),
  discardArtifactDraft: vi.fn(),
  getTaskAbortSignal: mocks.getTaskAbortSignal,
  clearTaskAbortController: mocks.clearTaskAbortController,
  markTaskStreaming: mocks.markTaskStreaming,
  isTaskCancelled: mocks.isTaskCancelled,
  storeTaskResult: mocks.storeTaskResult,
  failTask: mocks.failTask,
  getTaskRequest: mocks.getTaskRequest,
}));

interface CapturedBody {
  readonly model?: string;
  readonly messages?: readonly { readonly role: string; readonly content: string }[];
  readonly stream?: boolean;
  readonly options?: { readonly temperature?: number; readonly num_predict?: number };
}

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
  description: 'Test OpenAI-compatible provider.',
};

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
  description: 'Test local provider.',
};

const ANTHROPIC_PRESET: ProviderPreset = {
  id: 'anthropic',
  kind: 'anthropic',
  displayName: 'Anthropic',
  protocol: 'anthropic-compatible',
  baseURL: 'https://api.anthropic.com',
  defaultModel: 'claude-3-5-sonnet-latest',
  authType: 'x-api-key',
  authHeader: 'X-API-Key',
  billingMode: 'byok',
  capabilities: ['chat'],
  description: 'Unsupported in IMP-2.',
};

const CONFIRMED_CONTEXT: ContextConfirmation = {
  state: 'confirmed',
  userConfirmed: true,
  confirmedAt: '2026-06-15T00:00:00.000Z',
  summary: {
    fileCount: 1,
    files: [
      { relativePath: 'paper.md', displayName: 'paper.md', tokenCount: 12, truncated: false },
    ],
    totalTokens: 12,
    providerId: 'openai',
    model: 'gpt-5.5',
    providerDisplayName: 'OpenAI',
    truncatedFileCount: 0,
  },
};

const UNCONFIRMED_CONTEXT: ContextConfirmation = {
  state: 'unconfirmed',
  userConfirmed: false,
  confirmedAt: null,
  summary: null,
};

const repoRoot = path.resolve(__dirname, '../..');
const gatewaySource = () =>
  fs.readFileSync(path.join(repoRoot, 'electron/services/ai-provider-gateway.service.ts'), 'utf-8');
const rendererPlatformSource = () =>
  fs.readFileSync(path.join(repoRoot, 'src/lib/platform/schola-api.ts'), 'utf-8');
const preloadSource = () => fs.readFileSync(path.join(repoRoot, 'electron/preload.ts'), 'utf-8');

function response(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

function stubStreamingFetchWith(content: string): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () =>
    streamResponse([
      `data: {"choices":[{"delta":{"content":"${content}"}}]}\n\n`,
      'data: [DONE]\n\n',
    ]),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function fakeIpcEvent() {
  return {
    sender: {
      send: vi.fn(),
    },
  };
}

function stubFetchWith(responseBody: object, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => response(responseBody, status));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function firstFetchCall(): readonly [RequestInfo | URL, RequestInit | undefined] {
  const fetchMock = vi.mocked(globalThis.fetch);
  return fetchMock.mock.calls[0] as readonly [RequestInfo | URL, RequestInit | undefined];
}

function firstFetchBody(): CapturedBody {
  const [, init] = firstFetchCall();
  return JSON.parse(String(init?.body ?? '{}')) as CapturedBody;
}

function firstFetchUrl(): string {
  const [input] = firstFetchCall();
  return String(input);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mocks.handlers.clear();
  mocks.getProviderPreset.mockImplementation((providerId: string) => {
    if (providerId === 'ollama') return OLLAMA_PRESET;
    if (providerId === 'anthropic') return ANTHROPIC_PRESET;
    return OPENAI_PRESET;
  });
  mocks.getProviderKey.mockReturnValue('sk-test-secret-12345678901234567890');
  mocks.getProviderKeyStatus.mockReturnValue([{ providerId: 'openai', status: 'configured' }]);
  mocks.getProviderConfig.mockReturnValue({ enabled: true });
  mocks.getPrivacyConsent.mockReturnValue({
    privacyConsentAccepted: true,
    allowRemoteProvider: true,
  });
  mocks.getContextSendPolicy.mockReturnValue('ask');
  mocks.getAIPreferences.mockReturnValue({ aiEnabled: true });
  mocks.getContextConfirmation.mockReturnValue(CONFIRMED_CONTEXT);
  mocks.previewContextPack.mockReturnValue({
    packId: 'pack-1',
    fileCount: 1,
    selectedSourceRefs: [
      { relativePath: 'paper.md', displayName: 'paper.md', sourceType: 'markdown' },
    ],
    tokenEstimate: {
      fileTokens: 12,
      systemTokens: 8,
      totalTokens: 20,
      budget: 16000,
      exceedsBudget: false,
    },
    providerId: 'openai',
    model: 'gpt-5.5',
    truncatedFileCount: 0,
    warnings: [],
  });
  mocks.getContextPackContent.mockReturnValue(new Map([['paper.md', 'context body']]));
  mocks.buildEvidenceRefsForContextPack.mockReturnValue([
    {
      id: 'evidence-pack-1',
      kind: 'source-backed',
      label: '上下文来源',
      relativePath: 'paper.md',
      displayName: 'paper.md',
      sourceType: 'markdown',
      confidence: 'high',
      sourceRef: { relativePath: 'paper.md', displayName: 'paper.md' },
    },
    {
      id: 'evidence-model',
      kind: 'model-inferred',
      label: '模型综合推断',
      confidence: 'medium',
      modelInferredNote: '此项为模型综合推断，非原文直接引用。请人工核验。',
    },
  ]);
  mocks.getTaskRequest.mockReturnValue({
    taskType: 'analysis_summary',
    contextPackId: 'pack-1',
    instruction: 'summarize',
    providerId: 'openai',
    model: 'gpt-5.5',
    skillPromptTemplate: 'skill system prompt',
  });
  mocks.startTaskExecution.mockReturnValue({
    taskId: 'task-1',
    taskType: 'analysis_summary',
    state: 'running',
    createdAt: '2026-06-15T00:00:00.000Z',
    providerId: 'openai',
    model: 'gpt-5.5',
  });
  mocks.getTaskAbortSignal.mockReturnValue(undefined);
  mocks.clearTaskAbortController.mockReturnValue(undefined);
  mocks.markTaskStreaming.mockReturnValue(undefined);
  mocks.isTaskCancelled.mockReturnValue(false);
  mocks.getTaskStatus.mockReturnValue({
    taskId: 'task-1',
    taskType: 'analysis_summary',
    state: 'completed',
    createdAt: '2026-06-15T00:00:00.000Z',
    providerId: 'openai',
    model: 'gpt-5.5',
  });
});

describe('Provider Generation Request �?preflight guards', () => {
  it('AI-C-GEN-001 blocks runConfirmedTask when contextConfirmed is false', async () => {
    const { runInvocationPreflight } =
      await import('../../electron/services/ai-research-preflight.service');

    const result = runInvocationPreflight(
      'openai',
      mocks.previewContextPack(),
      true,
      UNCONFIRMED_CONTEXT,
    );

    expect(result.passed).toBe(false);
    expect(result.blockedReason).toBe('context_not_confirmed');
    expect(result.contextConfirmed).toBe(false);
  });

  it('AI-C-GEN-002 blocks runConfirmedTask when provider readiness fails', async () => {
    const { runInvocationPreflight } =
      await import('../../electron/services/ai-research-preflight.service');
    mocks.getProviderConfig.mockReturnValue({ enabled: false });

    const result = runInvocationPreflight(
      'openai',
      mocks.previewContextPack(),
      true,
      CONFIRMED_CONTEXT,
    );

    expect(result.passed).toBe(false);
    expect(result.blockedReason).toBe('provider_disabled');
    expect(result.providerReady).toBe(false);
  });

  it('AI-C-GEN-003 blocks runConfirmedTask when selectedModel is missing', async () => {
    const { registerAIResearchIpc } = await import('../../electron/ipc/ai-research.ipc');
    const { AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL } =
      await import('../../src/lib/contracts/ai-research.types');
    mocks.getTaskRequest.mockReturnValue({
      taskType: 'analysis_summary',
      contextPackId: 'pack-1',
      instruction: 'summarize',
      providerId: 'openai',
      model: '未选择模型',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    registerAIResearchIpc();
    const handler = mocks.handlers.get(AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL);

    await expect(handler?.(undefined, { taskId: 'task-1' })).rejects.toThrow(/MISSING_MODEL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Provider Generation Request �?chat request contracts', () => {
  it('AI-C-GEN-005 RendererChatRequest does not contain apiKey', () => {
    const rendererRequest: RendererChatRequest = {
      taskId: 'task-1',
      providerId: 'openai',
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'hello' }],
      options: { temperature: 0.3 },
    };

    // @ts-expect-error Renderer requests must not carry secrets.
    const invalidRendererRequest: RendererChatRequest = { ...rendererRequest, apiKey: 'sk-secret' };

    expect('apiKey' in rendererRequest).toBe(false);
    expect('apiKey' in invalidRendererRequest).toBe(true);
  });

  it('AI-C-GEN-006 MainChatRequest allows apiKey', () => {
    const mainRequest: MainChatRequest = {
      taskId: 'task-1',
      providerId: 'openai',
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'hello' }],
      options: { temperature: 0.3 },
      apiKey: 'sk-main-process-only',
    };

    expect(mainRequest.apiKey).toBe('sk-main-process-only');
  });
});

describe('Provider Generation Request �?HTTP request construction', () => {
  it('AI-C-GEN-007 normalizes OpenAI-compatible base URLs to /v1/chat/completions', async () => {
    const { executeProviderInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    mocks.getProviderPreset.mockReturnValue({ ...OPENAI_PRESET, baseURL: 'https://example.test/' });
    stubFetchWith({ choices: [{ message: { content: 'draft' } }] });

    await executeProviderInvocation(
      'task-1',
      'openai',
      'gpt-5.5',
      'analysis_summary',
      'system',
      'user',
      [],
      0,
    );

    expect(firstFetchUrl()).toBe('https://example.test/v1/chat/completions');
  });

  it('AI-C-GEN-008 sends Ollama requests to /api/chat', async () => {
    const { executeProviderInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    stubFetchWith({ message: { content: 'local draft' } });

    await executeProviderInvocation(
      'task-1',
      'ollama',
      'llama3',
      'analysis_summary',
      'system',
      'user',
      [],
      0,
    );

    expect(firstFetchUrl()).toBe('http://127.0.0.1:11434/api/chat');
    expect(firstFetchBody()).toMatchObject({ model: 'llama3', stream: false });
  });

  it('AI-C-GEN-009 returns unsupported_provider for Anthropic before fetch', async () => {
    const { executeProviderInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    const fetchMock = stubFetchWith({ choices: [{ message: { content: 'should not happen' } }] });

    await expect(
      executeProviderInvocation(
        'task-1',
        'anthropic',
        'claude',
        'analysis_summary',
        'system',
        'user',
        [],
        0,
      ),
    ).rejects.toMatchObject({ code: 'unsupported_provider' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AI-C-GEN-010 uses skill promptTemplate as the system message', async () => {
    const { registerAIResearchIpc } = await import('../../electron/ipc/ai-research.ipc');
    const { AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL } =
      await import('../../src/lib/contracts/ai-research.types');
    stubStreamingFetchWith('draft');

    registerAIResearchIpc();
    const handler = mocks.handlers.get(AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL);
    await handler?.(fakeIpcEvent(), { taskId: 'task-1' });

    expect(firstFetchBody().messages?.[0]).toEqual({
      role: 'system',
      content: 'skill system prompt',
    });
  });

  it('AI-C-GEN-013 maps an aborted provider request to a sanitized timeout failure', async () => {
    const { executeProviderInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    const abortError = Object.assign(
      new Error('raw timeout with sk-test-secret-12345678901234567890'),
      {
        name: 'AbortError',
      },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(abortError)),
    );

    await expect(
      executeProviderInvocation(
        'task-1',
        'openai',
        'gpt-5.5',
        'analysis_summary',
        'system',
        'user',
        [],
        0,
      ),
    ).rejects.toMatchObject({ code: 'timeout', retryable: true });
  });
});

describe('Streaming IPC events', () => {
  it('AI-C-STREAM-006 success path sends done exactly once and no error', async () => {
    const { registerAIResearchIpc } = await import('../../electron/ipc/ai-research.ipc');
    const {
      AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
      AI_RESEARCH_TASK_DONE_EVENT,
      AI_RESEARCH_TASK_ERROR_EVENT,
    } = await import('../../src/lib/contracts/ai-research.types');
    stubStreamingFetchWith('draft');

    registerAIResearchIpc();
    const event = fakeIpcEvent();
    const handler = mocks.handlers.get(AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL);
    await handler?.(event, { taskId: 'task-1' });

    const send = event.sender.send;
    expect(
      send.mock.calls.filter(([channel]) => channel === AI_RESEARCH_TASK_DONE_EVENT),
    ).toHaveLength(1);
    expect(
      send.mock.calls.filter(([channel]) => channel === AI_RESEARCH_TASK_ERROR_EVENT),
    ).toHaveLength(0);
  });

  it('AI-C-STREAM-006 provider multiple DONE frames still produce one done event', async () => {
    const { registerAIResearchIpc } = await import('../../electron/ipc/ai-research.ipc');
    const {
      AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
      AI_RESEARCH_TASK_DONE_EVENT,
      AI_RESEARCH_TASK_ERROR_EVENT,
    } = await import('../../src/lib/contracts/ai-research.types');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse([
          'data: {"choices":[{"delta":{"content":"draft"}}]}\n\n',
          'data: [DONE]\n\n',
          'data: [DONE]\n\n',
        ]),
      ),
    );

    registerAIResearchIpc();
    const event = fakeIpcEvent();
    const handler = mocks.handlers.get(AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL);
    await handler?.(event, { taskId: 'task-1' });

    const send = event.sender.send;
    expect(
      send.mock.calls.filter(([channel]) => channel === AI_RESEARCH_TASK_DONE_EVENT),
    ).toHaveLength(1);
    expect(
      send.mock.calls.filter(([channel]) => channel === AI_RESEARCH_TASK_ERROR_EVENT),
    ).toHaveLength(0);
  });

  it('AI-C-STREAM-007 failure path sends error exactly once and no done', async () => {
    const { registerAIResearchIpc } = await import('../../electron/ipc/ai-research.ipc');
    const {
      AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
      AI_RESEARCH_TASK_DONE_EVENT,
      AI_RESEARCH_TASK_ERROR_EVENT,
    } = await import('../../src/lib/contracts/ai-research.types');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamResponse([], 401)),
    );

    registerAIResearchIpc();
    const event = fakeIpcEvent();
    const handler = mocks.handlers.get(AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL);
    await handler?.(event, { taskId: 'task-1' });

    const send = event.sender.send;
    const errorCalls = send.mock.calls.filter(
      ([channel]) => channel === AI_RESEARCH_TASK_ERROR_EVENT,
    );
    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0]?.[1]).toMatchObject({
      type: 'error',
      taskId: 'task-1',
      error: { code: 'unauthorized' },
    });
    expect(
      send.mock.calls.filter(([channel]) => channel === AI_RESEARCH_TASK_DONE_EVENT),
    ).toHaveLength(0);
  });

  it('AI-C-STREAM-014 cancel path sends no fatal error and no done', async () => {
    const { registerAIResearchIpc } = await import('../../electron/ipc/ai-research.ipc');
    const {
      AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
      AI_RESEARCH_TASK_DONE_EVENT,
      AI_RESEARCH_TASK_ERROR_EVENT,
    } = await import('../../src/lib/contracts/ai-research.types');
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw abortError;
      }),
    );
    mocks.isTaskCancelled.mockReturnValue(true);
    mocks.getTaskStatus.mockReturnValue({
      taskId: 'task-1',
      taskType: 'analysis_summary',
      state: 'cancelled',
      createdAt: '2026-06-15T00:00:00.000Z',
      providerId: 'openai',
      model: 'gpt-5.5',
    });

    registerAIResearchIpc();
    const event = fakeIpcEvent();
    const handler = mocks.handlers.get(AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL);
    await handler?.(event, { taskId: 'task-1' });

    const send = event.sender.send;
    expect(
      send.mock.calls.filter(([channel]) => channel === AI_RESEARCH_TASK_ERROR_EVENT),
    ).toHaveLength(0);
    expect(
      send.mock.calls.filter(([channel]) => channel === AI_RESEARCH_TASK_DONE_EVENT),
    ).toHaveLength(0);
  });
});

describe('Provider Generation Request �?sanitized errors and responses', () => {
  it('AI-C-GEN-015 sanitizes unauthorized errors without leaking API keys', async () => {
    const { executeProviderInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    stubFetchWith({ error: 'bad key' }, 401);

    await expect(
      executeProviderInvocation(
        'task-1',
        'openai',
        'gpt-5.5',
        'analysis_summary',
        'system',
        'user',
        [],
        0,
      ),
    ).rejects.not.toThrow(/sk-test-secret/);
  });

  it('AI-C-GEN-016 sanitizes rate_limited errors without provider response body leakage', async () => {
    const { executeProviderInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    stubFetchWith({ error: 'sk-test-secret-12345678901234567890' }, 429);

    await expect(
      executeProviderInvocation(
        'task-1',
        'openai',
        'gpt-5.5',
        'analysis_summary',
        'system',
        'user',
        [],
        0,
      ),
    ).rejects.not.toThrow(/sk-test-secret/);
  });

  it('AI-C-GEN-017 sanitizes network_error without leaking API keys', async () => {
    const { executeProviderInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.reject(new Error('connect failed sk-test-secret-12345678901234567890')),
      ),
    );

    await expect(
      executeProviderInvocation(
        'task-1',
        'openai',
        'gpt-5.5',
        'analysis_summary',
        'system',
        'user',
        [],
        0,
      ),
    ).rejects.not.toThrow(/sk-test-secret/);
  });

  it('AI-C-GEN-018 treats invalid provider payloads as sanitized invocation failures', async () => {
    const { executeProviderInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    stubFetchWith({ choices: [{ message: {} }] });

    await expect(
      executeProviderInvocation(
        'task-1',
        'openai',
        'gpt-5.5',
        'analysis_summary',
        'system',
        'user',
        [],
        0,
      ),
    ).rejects.toMatchObject({ code: 'empty_response', retryable: true });
  });

  it('AI-C-P0-008 strips API-key-like tokens from provider response content', async () => {
    const { executeProviderInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    stubFetchWith({
      choices: [{ message: { content: 'draft sk-testsecret12345678901234567890 done' } }],
    });

    const result = await executeProviderInvocation(
      'task-1',
      'openai',
      'gpt-5.5',
      'analysis_summary',
      'system',
      'user',
      [],
      0,
    );

    expect(result.artifact.content).toContain('[REDACTED]');
    expect(result.artifact.content).not.toContain('sk-testsecret12345678901234567890');
  });

  it('AI-C-P0-022 sanitization source redacts Authorization headers', () => {
    expect(gatewaySource()).toContain('Authorization: [REDACTED]');
    expect(gatewaySource()).toContain('Authorization:\\s*.+');
  });

  it('AI-C-P0-023 sanitization source redacts Windows absolute paths', () => {
    expect(gatewaySource()).toContain('[A-Za-z]:\\\\[^\\s,;]*');
    expect(gatewaySource()).toContain('[PATH]');
  });
});

describe('Provider Generation Request �?no implicit persistence or renderer provider calls', () => {
  it('AI-C-GEN-019 provider response does not auto-write Vault files', async () => {
    const { executeProviderInvocation } =
      await import('../../electron/services/ai-provider-gateway.service');
    stubFetchWith({ choices: [{ message: { content: 'draft' } }] });

    await executeProviderInvocation(
      'task-1',
      'openai',
      'gpt-5.5',
      'analysis_summary',
      'system',
      'user',
      [],
      0,
    );

    expect(mocks.storeTaskResult).not.toHaveBeenCalled();
    expect(gatewaySource()).toContain('NO auto-retry on sensitive requests');
    expect(gatewaySource()).not.toMatch(/saveNote\(|writeFileSync\(|writeFile\(/);
  });

  it('AI-C-GEN-020 runConfirmedTask stores provider response in task UI state only', async () => {
    const { registerAIResearchIpc } = await import('../../electron/ipc/ai-research.ipc');
    const { AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL } =
      await import('../../src/lib/contracts/ai-research.types');
    stubStreamingFetchWith('draft');

    registerAIResearchIpc();
    const handler = mocks.handlers.get(AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL);
    await handler?.(fakeIpcEvent(), { taskId: 'task-1' });

    expect(mocks.storeTaskResult).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ content: 'draft', isDraft: true, reviewRequired: true }),
      expect.objectContaining({ providerId: 'openai' }),
      expect.any(Array),
      'completed',
    );
  });

  it('AI-C-P0-005 renderer API wrapper does not contact raw API keys or provider fetch directly', () => {
    const source = rendererPlatformSource();

    expect(source).not.toContain('apiKey');
    expect(source).not.toMatch(/fetch\s*\(/);
  });

  it('AI-C-P0-009 provider request implementation is confined to main-process gateway architecture', () => {
    expect(gatewaySource()).toContain('ONLY main process');
    expect(gatewaySource()).toContain('await fetch(url');
    expect(rendererPlatformSource()).not.toContain('sendChatCompletion');
    expect(preloadSource()).not.toContain('sendChatCompletion');
  });
});

// Phase 5-5-C-IMP-2-TD: Supplementary tests for R2 fix
describe('Provider Generation — TD supplemental', () => {
  it('AI-C-GEN-011 context messages from ContextPack with relative path labels', async () => {
    const { buildContextMessages } =
      await import('../../electron/services/ai-provider-gateway.service');
    const contents = new Map([
      ['notes/research.md', '# Research\n\nFindings about ML.'],
      ['data/empty.csv', '  '],
    ]);
    const messages = buildContextMessages(contents);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('[文件: notes/research.md]');
    expect(messages[0].content).not.toMatch(/[A-Za-z]:\\/);
  });

  it('AI-C-GEN-012 user message wraps instruction from editor', async () => {
    const { buildUserPrompt } = await import('../../electron/services/ai-provider-gateway.service');
    const result = buildUserPrompt('分析文献A和方法B');
    expect(result).toContain('用户指令：分析文献A和方法B');
    expect(result).toContain('请按照上述要求进行分析并输出结果');
  });
});
