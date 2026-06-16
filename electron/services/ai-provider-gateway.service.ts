/**
 * AI Provider Gateway — Phase 5-2-IMP-3 + Phase 5-5-C-IMP-2.
 *
 * Minimal, controlled provider invocation gateway.
 *
 * Invariants:
 *   - ONLY main process (never renderer)
 *   - ONLY through Phase 5-1 configured providers
 *   - ONLY main process reads API Key
 *   - MUST pass preflight before invocation
 *   - MUST have Context Confirmation accepted
 *   - MUST be triggered by user explicit Run click
 *   - NO background/automatic provider calls
 *   - NO auto-retry on sensitive requests
 *   - NO raw prompt logging
 *   - NO full file content logging
 *   - NO API Key in logs
 *   - Errors ALWAYS sanitized
 *   - NO embedding, NO RAG, NO vector search
 *
 * HTTP implementation:
 *   - OpenAI-compatible chat completions endpoint
 *   - Ollama /api/chat endpoint
 *   - Uses Node.js built-in fetch (Electron 42+)
 *   - Configurable timeout (default 120s for non-streaming)
 *   - NO provider SDK dependencies
 *   - NO streaming chunk persistence
 *   - Anthropic: unsupported_provider gate (native API not implemented yet)
 */
import type {
  AIArtifactDraft,
  AIInvocationError,
  AIInvocationMetadata,
  AIResearchTaskType,
  AIResearchWarning,
} from '../../src/lib/contracts/ai-research.types';
import { AI_RESEARCH_TASK_LABELS } from '../../src/lib/contracts/ai-research.types';
import type { ProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import { getProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import { sanitizeIpcError } from '../lib/error-utils';
import { getProviderKey } from './provider-key-store.service';
import { buildInvocationMetadata, storeTaskResult, failTask } from './ai-research-task.service';
import { buildEvidenceRefsForContextPack } from './ai-research-context.service';

// ── Constants ─────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes (non-streaming)
const STREAMING_IDLE_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.3; // Low temperature for analytical tasks

// Phase 5-5-C-IMP-2: Providers that return unsupported_provider.
// Anthropic has a native messages API that is NOT implemented in IMP-2.
const UNSUPPORTED_PROVIDER_IDS = new Set<string>(['anthropic']);

// ── Types ─────────────────────────────────────────

interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

interface GatewayContext {
  readonly taskId: string;
  readonly providerId: string;
  readonly model: string;
  readonly taskType: AIResearchTaskType;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly contextMessages: readonly ChatMessage[];
  readonly contextFileCount: number;
}

interface GatewayResult {
  readonly artifact: AIArtifactDraft;
  readonly metadata: AIInvocationMetadata;
  readonly warnings: readonly AIResearchWarning[];
}

// ── Public API ────────────────────────────────────

/**
 * Execute a provider invocation through the gateway.
 *
 * This is the SINGLE entry point for all AI Research provider calls.
 * All preflight checks MUST have passed before reaching here.
 *
 * @param contextMessages - ContextPack file contents as user messages (Phase 5-5-C-IMP-2).
 * @returns The artifact draft + metadata. Errors are thrown as AIInvocationError.
 */
export async function executeProviderInvocation(
  taskId: string,
  providerId: string,
  model: string,
  taskType: AIResearchTaskType,
  systemPrompt: string,
  userPrompt: string,
  contextMessages: readonly ChatMessage[],
  contextFileCount: number,
  signal?: AbortSignal,
  sourcePackId = '',
  skillId = 'default-skill',
): Promise<GatewayResult> {
  const startTime = Date.now();

  // Step 1: Provider preset validation
  const preset = getProviderPreset(providerId);
  if (!preset) {
    throw buildInvocationError(
      'PROVIDER_NOT_FOUND',
      `未找到提供者 "${providerId}" 的配置。`,
      false,
    );
  }

  // Phase 5-5-C-IMP-2: Unsupported provider gate
  if (UNSUPPORTED_PROVIDER_IDS.has(providerId)) {
    throw buildInvocationError(
      'unsupported_provider',
      `提供者 "${preset.displayName}" 当前不支持。该提供者的原生 API 尚未实现，将在后续版本中支持。`,
      false,
    );
  }

  // Step 2: API key retrieval (main process only)
  const apiKey = resolveApiKey(providerId, preset);

  // Step 3: Build messages (system + context + user)
  const messages = buildMessages(systemPrompt, contextMessages, userPrompt);

  // Step 4: Execute HTTP call based on protocol
  try {
    const content =
      preset.protocol === 'ollama'
        ? await sendOllamaChat(preset.baseURL, model, messages, signal)
        : await sendChatCompletion(
            preset.baseURL,
            apiKey,
            preset.authHeader,
            model,
            messages,
            signal,
          );

    const durationMs = Date.now() - startTime;

    // Build artifact from response
    const sanitized = sanitizeResponseContent(content);
    const artifact = buildArtifactFromResponse({
      taskId,
      taskType,
      content: sanitized,
      sourcePackId,
      providerId,
      model,
      skillId,
    });

    // Build metadata (no raw prompt, no API key)
    const approxTokens = estimateResponseTokens(sanitized);
    const metadata = buildInvocationMetadata(
      taskId,
      providerId,
      model,
      taskType,
      contextFileCount,
      approxTokens,
      durationMs,
      false, // streaming
    );

    // Metadata-only logging
    logInvocationMetadata(metadata);

    const warnings = buildResponseWarnings(sanitized, approxTokens);
    return { artifact, metadata, warnings };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const error = sanitizeAndBuildError(err, durationMs);

    // Log sanitized error only
    logInvocationError(taskId, providerId, error.code, durationMs);
    throw error;
  }
}

/**
 * Execute a streaming provider invocation.
 * Streaming chunks are delivered via callback; NOT persisted.
 * The final result is the concatenation of all chunks.
 *
 * Phase 5-5-C-IMP-3 target. Not implemented in IMP-2.
 */
export async function executeStreamingInvocation(
  taskId: string,
  providerId: string,
  model: string,
  taskType: AIResearchTaskType,
  systemPrompt: string,
  userPrompt: string,
  contextMessages: readonly ChatMessage[],
  contextFileCount: number,
  onChunk: (chunk: string, index: number) => void,
  signal?: AbortSignal,
  sourcePackId = '',
  skillId = 'default-skill',
): Promise<GatewayResult> {
  const startTime = Date.now();

  const preset = getProviderPreset(providerId);
  if (!preset) {
    throw buildInvocationError(
      'PROVIDER_NOT_FOUND',
      `未找到提供者 "${providerId}" 的配置。`,
      false,
    );
  }

  if (UNSUPPORTED_PROVIDER_IDS.has(providerId)) {
    throw buildInvocationError(
      'unsupported_provider',
      `提供者 "${preset.displayName}" 当前不支持。`,
      false,
    );
  }

  const apiKey = resolveApiKey(providerId, preset);
  const messages = buildMessages(systemPrompt, contextMessages, userPrompt);

  try {
    const content =
      preset.protocol === 'ollama'
        ? await sendStreamingOllamaChat(preset.baseURL, model, messages, onChunk, signal)
        : await sendStreamingChatCompletion(
            preset.baseURL,
            apiKey,
            preset.authHeader,
            model,
            messages,
            onChunk,
            signal,
          );

    const durationMs = Date.now() - startTime;
    const sanitized = sanitizeResponseContent(content);
    const artifact = buildArtifactFromResponse({
      taskId,
      taskType,
      content: sanitized,
      sourcePackId,
      providerId,
      model,
      skillId,
    });
    const approxTokens = estimateResponseTokens(sanitized);
    const metadata = buildInvocationMetadata(
      taskId,
      providerId,
      model,
      taskType,
      contextFileCount,
      approxTokens,
      durationMs,
      true,
    );

    logInvocationMetadata(metadata);
    const warnings = buildResponseWarnings(sanitized, approxTokens);
    return { artifact, metadata, warnings };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const error = sanitizeAndBuildError(err, durationMs);
    logInvocationError(taskId, providerId, error.code, durationMs);
    throw error;
  }
}

// ── API Key Resolution ────────────────────────────

function resolveApiKey(providerId: string, preset: ProviderPreset): string {
  // Ollama is local-free, no API key needed
  if (preset.billingMode === 'local-free' || preset.protocol === 'ollama') {
    return ''; // No key needed, empty string is safe
  }

  let apiKey: string | null = null;
  try {
    apiKey = getProviderKey(providerId);
  } catch {
    throw buildInvocationError('missing_api_key', '无法获取 API Key。请在设置中重新配置。', false);
  }

  if (apiKey == null || apiKey.length === 0) {
    throw buildInvocationError(
      'missing_api_key',
      '未配置 API Key。请在设置中为该提供者配置密钥。',
      false,
    );
  }

  return apiKey;
}

// ── Message Assembly ──────────────────────────────

/**
 * Build context messages from ContextPack file contents.
 * Each file becomes a user message with a relative path label.
 * Only text-based files contribute content; binary/pdf files are skipped.
 */
export function buildContextMessages(contents: Map<string, string>): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const [relativePath, content] of contents) {
    if (content.trim().length === 0) continue;
    messages.push({
      role: 'user',
      content: `[文件: ${relativePath}]\n\n${content}`,
    });
  }
  return messages;
}

function buildMessages(
  systemPrompt: string,
  contextMessages: readonly ChatMessage[],
  userPrompt: string,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of contextMessages) {
    messages.push(msg);
  }
  messages.push({ role: 'user', content: userPrompt });
  return messages;
}

// ── HTTP Implementation: OpenAI-compatible ─────────

interface MergedAbort {
  readonly signal: AbortSignal;
  clear(): void;
}

interface StreamingBodyGuard {
  readonly signal: AbortSignal;
  reset(): void;
  clear(): void;
  isIdleTimeout(): boolean;
}

function mergeAbortSignals(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): MergedAbort {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = (): void => {
    controller.abort();
    clearTimeout(timeoutId);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
      clearTimeout(timeoutId);
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    },
  };
}

function createStreamingBodyGuard(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): StreamingBodyGuard {
  const controller = new AbortController();
  let idleTimedOut = false;
  let timeoutId: NodeJS.Timeout | null = null;

  const clearTimer = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const armTimer = (): void => {
    clearTimer();
    timeoutId = setTimeout(() => {
      idleTimedOut = true;
      controller.abort();
    }, timeoutMs);
  };

  const onExternalAbort = (): void => {
    clearTimer();
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  armTimer();

  return {
    signal: controller.signal,
    reset() {
      if (controller.signal.aborted) return;
      armTimer();
    },
    clear() {
      clearTimer();
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    },
    isIdleTimeout() {
      return idleTimedOut;
    },
  };
}

/**
 * Send a non-streaming chat completion request to an OpenAI-compatible endpoint.
 *
 * Phase 5-5-C-IMP-2: stream=false, non-streaming only.
 * Endpoint: {baseURL}/chat/completions (baseURL already includes /v1 for standard presets).
 */
async function sendChatCompletion(
  baseURL: string,
  apiKey: string,
  authHeader: string,
  model: string,
  messages: ChatMessage[],
  externalSignal?: AbortSignal,
): Promise<string> {
  const url = normalizeOpenAIEndpoint(baseURL);
  const merged = mergeAbortSignals(externalSignal, DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers[authHeader] = authHeader === 'X-API-Key' ? apiKey : `Bearer ${apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        stream: false,
      }),
      signal: merged.signal,
    });

    merged.clear();

    if (!response.ok) {
      throw mapHttpError(response.status);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw buildInvocationError('empty_response', '提供者返回了空响应。', true);
    }

    return content;
  } catch (err) {
    merged.clear();
    if (err instanceof Error && err.name === 'AbortError') {
      throw buildInvocationError('timeout', '请求超时。提供者在规定时间内未响应。', true);
    }
    // Re-throw if already an AIInvocationError
    if (isInvocationError(err)) throw err;
    throw buildInvocationError('network_error', `网络请求失败: ${sanitizeIpcError(err)}`, true);
  }
}

/**
 * Send a non-streaming chat request to an Ollama endpoint.
 *
 * Phase 5-5-C-IMP-2: Ollama /api/chat endpoint.
 * No API key required.
 */
async function sendOllamaChat(
  baseURL: string,
  model: string,
  messages: ChatMessage[],
  externalSignal?: AbortSignal,
): Promise<string> {
  const url = `${baseURL.replace(/\/$/, '')}/api/chat`;
  const merged = mergeAbortSignals(externalSignal, DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: DEFAULT_TEMPERATURE,
          num_predict: DEFAULT_MAX_TOKENS,
        },
      }),
      signal: merged.signal,
    });

    merged.clear();

    if (!response.ok) {
      throw mapHttpError(response.status);
    }

    const data = (await response.json()) as {
      message?: { content?: string };
    };

    const content = data.message?.content;
    if (!content) {
      throw buildInvocationError('empty_response', 'Ollama 返回了空响应。', true);
    }

    return content;
  } catch (err) {
    merged.clear();
    if (err instanceof Error && err.name === 'AbortError') {
      throw buildInvocationError('timeout', 'Ollama 请求超时。请确认本地服务正在运行。', true);
    }
    if (isInvocationError(err)) throw err;
    throw buildInvocationError('network_error', `Ollama 请求失败: ${sanitizeIpcError(err)}`, true);
  }
}

/**
 * Normalize OpenAI-compatible endpoint URL.
 * - If baseURL already ends with /chat/completions, use as-is.
 * - If baseURL already ends with /v1, append /chat/completions.
 * - Otherwise, append /v1/chat/completions (standard).
 */
function normalizeOpenAIEndpoint(baseURL: string): string {
  const trimmed = baseURL.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

// ── HTTP Implementation: Streaming (IMP-3 target) ──

async function sendStreamingChatCompletion(
  baseURL: string,
  apiKey: string,
  authHeader: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: string, index: number) => void,
  externalSignal?: AbortSignal,
): Promise<string> {
  const url = normalizeOpenAIEndpoint(baseURL);
  const merged = mergeAbortSignals(externalSignal, DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers[authHeader] = authHeader === 'X-API-Key' ? apiKey : `Bearer ${apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        stream: true,
      }),
      signal: merged.signal,
    });

    merged.clear();

    if (!response.ok) {
      throw mapHttpError(response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw buildInvocationError('invalid_response', '无法读取流式响应。', false);
    }

    const bodyGuard = createStreamingBodyGuard(externalSignal, STREAMING_IDLE_TIMEOUT_MS);
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let chunkIndex = 0;

    try {
      while (true) {
        const { done, value } = await Promise.race([
          reader.read(),
          new Promise<never>((_resolve, reject) => {
            bodyGuard.signal.addEventListener(
              'abort',
              () => reject(new DOMException('Streaming idle timeout', 'AbortError')),
              { once: true },
            );
          }),
        ]);
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: { content?: string };
                message?: { content?: string };
              }>;
            };
            const delta =
              parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content;
            if (delta) {
              fullContent += delta;
              onChunk(delta, chunkIndex);
              chunkIndex += 1;
              bodyGuard.reset();
            }
          } catch {
            // Skip malformed SSE chunks silently
          }
        }
      }
    } finally {
      bodyGuard.clear();
      reader.releaseLock();
    }

    if (!fullContent) {
      throw buildInvocationError('empty_response', '流式响应未返回任何内容。', true);
    }

    return fullContent;
  } catch (err) {
    merged.clear();
    if (err instanceof Error && err.name === 'AbortError') {
      throw buildInvocationError('timeout', '流式请求已被取消或超时。', true);
    }
    if (isInvocationError(err)) throw err;
    throw buildInvocationError('network_error', `流式请求失败: ${sanitizeIpcError(err)}`, true);
  }
}

async function sendStreamingOllamaChat(
  baseURL: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: string, index: number) => void,
  externalSignal?: AbortSignal,
): Promise<string> {
  const url = `${baseURL.replace(/\/$/, '')}/api/chat`;
  const merged = mergeAbortSignals(externalSignal, DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          temperature: DEFAULT_TEMPERATURE,
          num_predict: DEFAULT_MAX_TOKENS,
        },
      }),
      signal: merged.signal,
    });

    merged.clear();

    if (!response.ok) {
      throw mapHttpError(response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw buildInvocationError('invalid_response', '无法读取 Ollama 流式响应。', false);
    }

    const bodyGuard = createStreamingBodyGuard(externalSignal, STREAMING_IDLE_TIMEOUT_MS);
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let chunkIndex = 0;

    try {
      while (true) {
        const { done, value } = await Promise.race([
          reader.read(),
          new Promise<never>((_resolve, reject) => {
            bodyGuard.signal.addEventListener(
              'abort',
              () => reject(new DOMException('Streaming idle timeout', 'AbortError')),
              { once: true },
            );
          }),
        ]);
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed) as {
              message?: { content?: string };
              done?: boolean;
              error?: string;
            };
            if (parsed.error) {
              throw buildInvocationError('provider_error', parsed.error, true);
            }
            const delta = parsed.message?.content;
            if (delta) {
              fullContent += delta;
              onChunk(delta, chunkIndex);
              chunkIndex += 1;
              bodyGuard.reset();
            }
            if (parsed.done === true) {
              break;
            }
          } catch (err) {
            if (isInvocationError(err)) throw err;
          }
        }
      }
    } finally {
      bodyGuard.clear();
      reader.releaseLock();
    }

    if (!fullContent) {
      throw buildInvocationError('empty_response', 'Ollama 流式响应未返回任何内容。', true);
    }

    return fullContent;
  } catch (err) {
    merged.clear();
    if (err instanceof Error && err.name === 'AbortError') {
      throw buildInvocationError('timeout', 'Ollama 流式请求已被取消或超时。', true);
    }
    if (isInvocationError(err)) throw err;
    throw buildInvocationError(
      'network_error',
      `Ollama 流式请求失败: ${sanitizeIpcError(err)}`,
      true,
    );
  }
}

// ── HTTP Error Mapping ─────────────────────────────

function mapHttpError(status: number): AIInvocationError {
  switch (status) {
    case 401:
    case 403:
      return buildInvocationError(
        'unauthorized',
        'API Key 无效或权限不足。请在设置中检查密钥配置。',
        false,
      );
    case 429:
      return buildInvocationError('rate_limited', '请求过于频繁，请稍后重试。', true);
    case 400:
      return buildInvocationError(
        'invalid_response',
        `提供者返回请求错误 (HTTP ${status})。`,
        false,
      );
    case 500:
    case 502:
    case 503:
      return buildInvocationError(
        'provider_error',
        `提供者服务异常 (HTTP ${status})，请稍后重试。`,
        true,
      );
    default:
      return buildInvocationError('provider_error', `提供者返回 HTTP ${status}。`, true);
  }
}

function isInvocationError(err: unknown): err is AIInvocationError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    'retryable' in err
  );
}

// ── Response Processing ───────────────────────────

function sanitizeResponseContent(rawContent: string): string {
  // Strip potential API-key-like patterns (belt-and-suspenders)
  return rawContent.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]');
}

function estimateResponseTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

function buildArtifactFromResponse(input: {
  readonly taskId: string;
  readonly taskType: AIResearchTaskType;
  readonly content: string;
  readonly sourcePackId: string;
  readonly providerId: string;
  readonly model: string;
  readonly skillId: string;
}): AIArtifactDraft {
  const { taskId, taskType, content, sourcePackId, providerId, model, skillId } = input;
  const artifactId = `artifact-${taskId}`;
  const label = AI_RESEARCH_TASK_LABELS[taskType] ?? taskType;
  const now = new Date().toISOString();
  const evidence =
    sourcePackId.length > 0
      ? buildEvidenceRefsForContextPack(sourcePackId, content)
      : [
          {
            id: `${artifactId}-ev-1`,
            kind: 'model-inferred' as const,
            label: '模型生成内容',
            confidence: 'medium' as const,
            note: '此内容由 AI 模型根据上下文生成，非文献原文直接引用。请逐条核实。',
            modelInferredNote: '此内容由 AI 模型根据上下文生成，非文献原文直接引用。请逐条核实。',
          },
        ];

  return {
    id: artifactId,
    artifactId,
    taskId,
    taskType,
    title: `${label} — 草稿`,
    format: 'markdown',
    content,
    evidence,
    evidenceRefs: evidence,
    warnings: [],
    isDraft: true,
    reviewRequired: true,
    createdAt: now,
    updatedAt: now,
    sourcePackId,
    providerId,
    model,
    skillId,
    status: 'draft',
  };
}

function buildResponseWarnings(_content: string, approxTokens: number): AIResearchWarning[] {
  const warnings: AIResearchWarning[] = [];

  if (approxTokens > DEFAULT_MAX_TOKENS * 0.9) {
    warnings.push({
      code: 'response_near_limit',
      message: '响应接近 token 限制，可能被截断。',
      severity: 'medium',
    });
  }

  return warnings;
}

// ── Error Handling ────────────────────────────────

function buildInvocationError(
  code: string,
  message: string,
  retryable: boolean,
): AIInvocationError {
  return { code, message, retryable };
}

function sanitizeAndBuildError(err: unknown, _durationMs: number): AIInvocationError {
  const rawMessage = sanitizeIpcError(err);
  let sanitizedMessage = rawMessage;

  // Strip potential key-like patterns from error messages
  sanitizedMessage = sanitizedMessage.replace(/sk-[a-zA-Z0-9_-]{20,}/g, '[REDACTED]');
  sanitizedMessage = sanitizedMessage.replace(/Bearer\s+[a-zA-Z0-9_-]+/g, 'Bearer [REDACTED]');
  sanitizedMessage = sanitizedMessage.replace(/Authorization:\s*.+/gi, 'Authorization: [REDACTED]');
  // Strip system absolute paths
  sanitizedMessage = sanitizedMessage.replace(/[A-Za-z]:\\[^\s,;]*/g, '[PATH]');

  if (isInvocationError(err)) {
    return {
      code: err.code,
      message: sanitizedMessage,
      retryable: err.retryable,
    };
  }

  return {
    code: 'provider_error',
    message: sanitizedMessage,
    retryable: true,
  };
}

// ── Audit Logging (metadata only) ─────────────────

function logInvocationMetadata(metadata: AIInvocationMetadata): void {
  // Metadata-only log entry. NO raw prompt, NO API key, NO file content.
}

function logInvocationError(
  taskId: string,
  providerId: string,
  errorCode: string,
  durationMs: number,
): void {
  // Sanitized error log. NEVER includes API key, raw prompt, or file content.
}

// ── System Prompt Templates ───────────────────────

/**
 * Build a default system prompt for the given task type and context file list.
 * Used as fallback when no skill promptTemplate is provided.
 */
export function buildSystemPrompt(
  taskType: AIResearchTaskType,
  contextFileList: readonly string[],
): string {
  const label = AI_RESEARCH_TASK_LABELS[taskType] ?? '研究分析';
  const fileList = contextFileList.map((f) => `- ${f}`).join('\n');

  return `你是一位专业的科研文献分析助手。请根据提供的文献内容，完成以下任务：${label}。

文献来源：
${fileList}

要求：
1. 所有引用必须标注来源（source-backed）；
2. 模型推断必须明确标注（model-inferred）；
3. 不可伪造引用或生成不存在的文献；
4. 输出为结构化的 Markdown 格式；
5. 不确定的内容请明确说明。`;
}

/**
 * Build a user prompt for the given instruction.
 */
export function buildUserPrompt(instruction: string): string {
  return `用户指令：${instruction}

请按照上述要求进行分析并输出结果。`;
}
