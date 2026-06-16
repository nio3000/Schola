/**
 * Model Gateway Skeleton — Phase 4-1-IMP-1.
 *
 * No-op implementation. No real API calls. No API key storage.
 * Registers providers and exposes model info only.
 * Real implementation deferred to IMP-3 (OpenAI adapter) + IMP-4 (streaming).
 */
import type {
  AIProviderAdapter,
  AIModelGateway,
  AIModelInfo,
  MainChatRequest,
  ChatChunk,
} from '../../src/lib/contracts/ai-provider.types';
import type {
  FetchProviderModelsInput,
  FetchProviderModelsErrorCode,
  FetchProviderModelsResult,
  ProviderRemoteModel,
  TestProviderLatencyInput,
  TestProviderLatencyErrorCode,
  TestProviderLatencyResult,
} from '../../src/lib/contracts/settings.types';
import { getProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import { getProviderKey } from './provider-key-store.service';

const MODEL_FETCH_TIMEOUT_MS = 10_000;

// ── No-op gateway ────────────────────────────────────

class NoopModelGateway implements AIModelGateway {
  private adapters = new Map<string, AIProviderAdapter>();
  private modelInfos = new Map<string, AIModelInfo[]>();

  register(adapter: AIProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  getAvailableModels(): AIModelInfo[] {
    return this.modelInfos.get('default') ?? [];
  }

  registerModels(providerId: string, models: AIModelInfo[]): void {
    this.modelInfos.set(providerId, models);
  }

  async *chat(request: MainChatRequest): AsyncIterable<ChatChunk> {
    // No-op: returns single error chunk
    yield {
      type: 'error',
      taskId: request.taskId,
      error: {
        code: 'unsupported_provider',
        message: 'AI Workbench not yet implemented. Phase 4-1-IMP-3 required.',
      },
    };
    yield { type: 'done', taskId: request.taskId };
  }

  cancel(_taskId: string): void {
    // No-op
  }
}

// ── Registered providers (static presets — no real calls) ──

export function createModelGateway(): AIModelGateway {
  const gw = new NoopModelGateway();

  // Register static model info for presets
  gw.registerModels('default', [
    {
      id: 'gpt-4o',
      providerId: 'openai',
      displayName: 'GPT-4o',
      contextWindow: 128000,
      capabilities: ['chat', 'streaming'],
    },
    {
      id: 'gpt-4o-mini',
      providerId: 'openai',
      displayName: 'GPT-4o Mini',
      contextWindow: 128000,
      capabilities: ['chat', 'streaming'],
    },
    {
      id: 'claude-sonnet-4-20250514',
      providerId: 'anthropic',
      displayName: 'Claude Sonnet 4',
      contextWindow: 200000,
      capabilities: ['chat', 'streaming'],
    },
    {
      id: 'llama3.2',
      providerId: 'ollama',
      displayName: 'Llama 3.2 (local)',
      contextWindow: 128000,
      capabilities: ['chat', 'streaming', 'local'],
    },
  ]);

  return gw;
}

/** Singleton gateway instance. */
export const modelGateway: AIModelGateway = createModelGateway();

interface RemoteModelObject {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly displayName?: unknown;
  readonly owned_by?: unknown;
  readonly ownedBy?: unknown;
  readonly context_window?: unknown;
  readonly contextWindow?: unknown;
}

interface NormalizedEndpoint {
  readonly url: string;
  readonly endpoint: 'models' | 'health' | 'root';
}

function normalizeBaseUrl(baseUrl: string, providerId: string): NormalizedEndpoint {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (providerId === 'ollama' && !trimmed.endsWith('/v1') && !trimmed.endsWith('/models')) {
    return { url: `${trimmed}/api/tags`, endpoint: 'models' };
  }
  if (trimmed.endsWith('/models')) {
    return { url: trimmed, endpoint: 'models' };
  }
  if (trimmed.endsWith('/v1')) {
    return { url: `${trimmed}/models`, endpoint: 'models' };
  }
  return { url: `${trimmed}/v1/models`, endpoint: 'models' };
}

function buildHeaders(providerId: string, apiKey: string | null): Record<string, string> {
  const preset = getProviderPreset(providerId);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (!preset || preset.authType === 'none' || !apiKey) {
    return headers;
  }
  if (preset.authType === 'x-api-key') {
    headers[preset.authHeader] = apiKey;
    return headers;
  }
  headers[preset.authHeader] = `Bearer ${apiKey}`;
  return headers;
}

function getRequestKey(providerId: string, apiKey?: string): string | null {
  const trimmed = apiKey?.trim();
  if (trimmed) {
    return trimmed;
  }
  return getProviderKey(providerId);
}

function sanitizeProviderError(errorCode: FetchProviderModelsErrorCode): string {
  switch (errorCode) {
    case 'missing_base_url':
      return '请先填写 API 请求地址。';
    case 'missing_api_key':
      return '请先保存或输入 API Key。';
    case 'unauthorized':
      return '认证失败，请检查 API Key。';
    case 'timeout':
      return '请求超时，请稍后重试。';
    case 'invalid_response':
      return '模型服务返回格式无法识别。';
    case 'unsupported_provider':
      return '该 Provider 暂不支持自动获取模型列表，可手动填写模型。';
    case 'network_error':
    default:
      return '网络请求失败，请检查 API 地址。';
  }
}

function sanitizeLatencyError(errorCode: TestProviderLatencyErrorCode): string {
  if (errorCode === 'invalid_response') return '服务返回格式无法识别。';
  return sanitizeProviderError(errorCode);
}

function normalizeRemoteModel(model: string | RemoteModelObject): ProviderRemoteModel | null {
  if (typeof model === 'string') {
    const id = model.trim();
    return id ? { id, displayName: id } : null;
  }
  const idSource = model.id ?? model.name;
  if (typeof idSource !== 'string' || idSource.trim().length === 0) {
    return null;
  }
  const id = idSource.trim();
  const displayName =
    typeof model.displayName === 'string' && model.displayName.trim().length > 0
      ? model.displayName.trim()
      : id;
  const contextSource = model.contextWindow ?? model.context_window;
  const contextWindow =
    typeof contextSource === 'number' && Number.isFinite(contextSource) ? contextSource : undefined;
  const ownerSource = model.ownedBy ?? model.owned_by;
  const ownedBy =
    typeof ownerSource === 'string' && ownerSource.trim().length > 0
      ? ownerSource.trim()
      : undefined;
  return { id, displayName, contextWindow, ownedBy };
}

export function parseProviderModelsResponse(payload: unknown): readonly ProviderRemoteModel[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const source = payload as {
    data?: unknown;
    models?: unknown;
  };
  const rawModels = Array.isArray(source.data)
    ? source.data
    : Array.isArray(source.models)
      ? source.models
      : [];
  const models: ProviderRemoteModel[] = [];
  for (const raw of rawModels) {
    if (typeof raw === 'string') {
      const model = normalizeRemoteModel(raw);
      if (model) models.push(model);
    } else if (raw && typeof raw === 'object') {
      const model = normalizeRemoteModel(raw as RemoteModelObject);
      if (model) models.push(model);
    }
  }
  return models;
}

export function normalizeProviderModelsUrl(baseUrl: string, providerId = 'openai'): string {
  return normalizeBaseUrl(baseUrl, providerId).url;
}

async function fetchJsonWithTimeout(
  url: string,
  headers: Record<string, string>,
): Promise<{
  readonly status: number;
  readonly ok: boolean;
  readonly payload: unknown;
  readonly latencyMs: number;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS);
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { status: response.status, ok: response.ok, payload, latencyMs };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchProviderModels(
  input: FetchProviderModelsInput,
): Promise<FetchProviderModelsResult> {
  const providerId = input.providerId.trim();
  const preset = getProviderPreset(providerId);
  const baseUrl = input.baseUrl.trim();
  if (!baseUrl) {
    return {
      ok: false,
      providerId,
      error: sanitizeProviderError('missing_base_url'),
      errorCode: 'missing_base_url',
    };
  }
  if (!preset || preset.kind === 'anthropic') {
    return {
      ok: false,
      providerId,
      error: sanitizeProviderError('unsupported_provider'),
      errorCode: 'unsupported_provider',
    };
  }
  const apiKey = getRequestKey(providerId, input.apiKey);
  if (preset.billingMode === 'byok' && !apiKey) {
    return {
      ok: false,
      providerId,
      error: sanitizeProviderError('missing_api_key'),
      errorCode: 'missing_api_key',
    };
  }

  try {
    const endpoint = normalizeBaseUrl(baseUrl, providerId);
    const response = await fetchJsonWithTimeout(endpoint.url, buildHeaders(providerId, apiKey));
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        providerId,
        error: sanitizeProviderError('unauthorized'),
        errorCode: 'unauthorized',
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        providerId,
        error: sanitizeProviderError('network_error'),
        errorCode: 'network_error',
      };
    }
    const models = parseProviderModelsResponse(response.payload);
    if (models.length === 0) {
      return {
        ok: false,
        providerId,
        error: sanitizeProviderError('invalid_response'),
        errorCode: 'invalid_response',
      };
    }
    return {
      ok: true,
      providerId,
      models,
      fetchedAt: new Date().toISOString(),
      latencyMs: response.latencyMs,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const errorCode = isAbort ? 'timeout' : 'network_error';
    return { ok: false, providerId, error: sanitizeProviderError(errorCode), errorCode };
  }
}

export async function testProviderLatency(
  input: TestProviderLatencyInput,
): Promise<TestProviderLatencyResult> {
  const providerId = input.providerId.trim();
  const preset = getProviderPreset(providerId);
  const baseUrl = input.baseUrl.trim();
  if (!baseUrl) {
    return {
      ok: false,
      providerId,
      error: sanitizeLatencyError('missing_base_url'),
      errorCode: 'missing_base_url',
    };
  }
  const apiKey = getRequestKey(providerId, input.apiKey);
  if (preset?.billingMode === 'byok' && !apiKey) {
    return {
      ok: false,
      providerId,
      error: sanitizeLatencyError('missing_api_key'),
      errorCode: 'missing_api_key',
    };
  }

  try {
    const endpoint = normalizeBaseUrl(baseUrl, providerId);
    const response = await fetchJsonWithTimeout(endpoint.url, buildHeaders(providerId, apiKey));
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        providerId,
        latencyMs: response.latencyMs,
        error: sanitizeLatencyError('unauthorized'),
        errorCode: 'unauthorized',
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        providerId,
        latencyMs: response.latencyMs,
        error: sanitizeLatencyError('network_error'),
        errorCode: 'network_error',
      };
    }
    return {
      ok: true,
      providerId,
      latencyMs: response.latencyMs,
      testedAt: new Date().toISOString(),
      endpoint: endpoint.endpoint,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const errorCode = isAbort ? 'timeout' : 'network_error';
    return { ok: false, providerId, error: sanitizeLatencyError(errorCode), errorCode };
  }
}
