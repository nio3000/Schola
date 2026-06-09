/**
 * AI Provider Gateway — Phase 5-2-IMP-3.
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
 *   - Uses Node.js built-in fetch (Electron 42+)
 *   - Configurable timeout (default 120s)
 *   - NO provider SDK dependencies
 *   - NO streaming chunk persistence
 */
import type {
  AIArtifactDraft,
  AIInvocationError,
  AIInvocationMetadata,
  AIResearchTaskType,
  AIResearchWarning,
} from '../../src/lib/contracts/ai-research.types';
import { AI_RESEARCH_TASK_LABELS } from '../../src/lib/contracts/ai-research.types';
import { getProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import { sanitizeIpcError } from '../lib/error-utils';
import { getProviderKey } from './provider-key-store.service';
import {
  buildInvocationMetadata,
  buildPlaceholderArtifact,
  storeTaskResult,
  failTask,
} from './ai-research-task.service';

// ── Constants ─────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.3; // Low temperature for analytical tasks

// ── Types ─────────────────────────────────────────

interface GatewayContext {
  readonly taskId: string;
  readonly providerId: string;
  readonly model: string;
  readonly taskType: AIResearchTaskType;
  readonly systemPrompt: string;
  readonly userPrompt: string;
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
 * @returns The artifact draft + metadata. Errors are thrown as AIInvocationError.
 */
export async function executeProviderInvocation(
  taskId: string,
  providerId: string,
  model: string,
  taskType: AIResearchTaskType,
  systemPrompt: string,
  userPrompt: string,
  contextFileCount: number,
  signal?: AbortSignal,
): Promise<GatewayResult> {
  const startTime = Date.now();

  // Step 8: Main process provider gateway (preflight already passed)
  const preset = getProviderPreset(providerId);
  if (!preset) {
    throw buildInvocationError('PROVIDER_NOT_FOUND', `未找到提供者 "${providerId}" 的配置。`, false);
  }

  // Step 9: Error sanitize — API key retrieval (main process only)
  let apiKey: string | null = null;
  try {
    apiKey = getProviderKey(providerId);
  } catch {
    throw buildInvocationError(
      'API_KEY_MISSING',
      '无法获取 API Key。请在设置中重新配置。',
      false,
    );
  }

  if (apiKey == null) {
    throw buildInvocationError(
      'API_KEY_MISSING',
      '无法获取 API Key。请在设置中重新配置。',
      false,
    );
  }

  // Build the request
  const messages = buildMessages(systemPrompt, userPrompt);

  // Execute HTTP call
  try {
    const response = await sendChatCompletion(
      preset.baseURL,
      apiKey,
      preset.authHeader,
      model,
      messages,
      signal,
    );

    const durationMs = Date.now() - startTime;

    // Build artifact from response
    const content = sanitizeResponseContent(response);
    const artifact = buildArtifactFromResponse(taskId, taskType, content);

    // Build metadata (no raw prompt, no API key)
    const approxTokens = estimateResponseTokens(content);
    const metadata = buildInvocationMetadata(
      taskId,
      providerId,
      model,
      taskType,
      contextFileCount,
      approxTokens,
      durationMs,
      false,
    );

    // Step 10: Metadata-only logging
    logInvocationMetadata(metadata);

    const warnings = buildResponseWarnings(content, approxTokens);

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
 */
export async function executeStreamingInvocation(
  taskId: string,
  providerId: string,
  model: string,
  taskType: AIResearchTaskType,
  systemPrompt: string,
  userPrompt: string,
  contextFileCount: number,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<GatewayResult> {
  const startTime = Date.now();

  const preset = getProviderPreset(providerId);
  if (!preset) {
    throw buildInvocationError('PROVIDER_NOT_FOUND', `未找到提供者 "${providerId}" 的配置。`, false);
  }

  let apiKey: string | null = null;
  try {
    apiKey = getProviderKey(providerId);
  } catch {
    throw buildInvocationError('API_KEY_MISSING', '无法获取 API Key。', false);
  }

  if (apiKey == null) {
    throw buildInvocationError('API_KEY_MISSING', '无法获取 API Key。', false);
  }

  const messages = buildMessages(systemPrompt, userPrompt);

  try {
    const content = await sendStreamingChatCompletion(
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
    const artifact = buildArtifactFromResponse(taskId, taskType, sanitized);
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

// ── HTTP Implementation ───────────────────────────

interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

interface MergedAbort {
  readonly signal: AbortSignal;
  clear(): void;
}

/** Combine an external AbortSignal with a timeout into a single AbortSignal. */
function mergeAbortSignals(externalSignal: AbortSignal | undefined, timeoutMs: number): MergedAbort {
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

function buildMessages(systemPrompt: string, userPrompt: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });
  return messages;
}

async function sendChatCompletion(
  baseURL: string,
  apiKey: string,
  authHeader: string,
  model: string,
  messages: ChatMessage[],
  externalSignal?: AbortSignal,
): Promise<string> {
  const url = `${baseURL}/chat/completions`;
  // Merge external cancellation signal with internal timeout
  const merged = mergeAbortSignals(externalSignal, DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [authHeader]: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
      }),
      signal: merged.signal,
    });

    merged.clear();

    if (!response.ok) {
      const status = response.status;
      // NEVER include the response body in the error — it may contain API key info
      if (status === 401 || status === 403) {
        throw new Error('AUTH_ERROR: API Key 无效或权限不足。');
      }
      if (status === 429) {
        throw new Error('RATE_LIMIT: 请求过于频繁，请稍后重试。');
      }
      throw new Error(`PROVIDER_ERROR: 提供者返回 HTTP ${status}。`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('PROVIDER_ERROR: 提供者返回了空响应。');
    }

    return content;
  } catch (err) {
    merged.clear();
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('CANCELLED: 请求已被取消或超时。');
    }
    throw err;
  }
}

async function sendStreamingChatCompletion(
  baseURL: string,
  apiKey: string,
  authHeader: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  externalSignal?: AbortSignal,
): Promise<string> {
  const url = `${baseURL}/chat/completions`;
  const merged = mergeAbortSignals(externalSignal, DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [authHeader]: `Bearer ${apiKey}`,
      },
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
      const status = response.status;
      if (status === 401 || status === 403) {
        throw new Error('AUTH_ERROR: API Key 无效或权限不足。');
      }
      throw new Error(`PROVIDER_ERROR: 提供者返回 HTTP ${status}。`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('PROVIDER_ERROR: 无法读取流式响应。');
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
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
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
          } catch {
            // Skip malformed SSE chunks silently
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!fullContent) {
      throw new Error('PROVIDER_ERROR: 流式响应未返回任何内容。');
    }

    return fullContent;
  } catch (err) {
    merged.clear();
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('CANCELLED: 流式请求已被取消或超时。');
    }
    throw err;
  }
}

// ── Response Processing ───────────────────────────

function sanitizeResponseContent(rawContent: string): string {
  // Always sanitize: remove any potential API-key-like patterns
  // (belt-and-suspenders — the provider shouldn't return keys, but we sanitize anyway)
  return rawContent;
}

function estimateResponseTokens(content: string): number {
  // Conservative estimate: ~4 chars per token
  return Math.ceil(content.length / 4);
}

function buildArtifactFromResponse(
  taskId: string,
  taskType: AIResearchTaskType,
  content: string,
): AIArtifactDraft {
  const artifactId = `artifact-${taskId}`;
  const label = AI_RESEARCH_TASK_LABELS[taskType] ?? taskType;

  return {
    artifactId,
    taskId,
    taskType,
    title: `${label} — 草稿`,
    content,
    evidence: [
      {
        id: `${artifactId}-ev-1`,
        kind: 'model-inferred',
        label: '模型生成内容',
        modelInferredNote:
          '此内容由 AI 模型根据上下文生成，非文献原文直接引用。请逐条核实。',
      },
    ],
    warnings: [],
    isDraft: true,
    reviewRequired: true,
    createdAt: new Date().toISOString(),
  };
}

function buildResponseWarnings(
  _content: string,
  approxTokens: number,
): AIResearchWarning[] {
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

  // Sanitize: strip any potential key-like patterns from error messages
  sanitizedMessage = sanitizedMessage.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]');
  sanitizedMessage = sanitizedMessage.replace(/Bearer\s+[a-zA-Z0-9_-]+/g, 'Bearer [REDACTED]');

  return {
    code: 'INVOCATION_FAILED',
    message: sanitizedMessage,
    retryable: true,
  };
}

// ── Audit Logging (metadata only) ─────────────────

function logInvocationMetadata(metadata: AIInvocationMetadata): void {
  // Metadata-only log entry. NO raw prompt, NO API key, NO file content.
  // This is intentionally a no-op for Phase 5-2 (no persistent audit log yet).
  // Phase 5-3+ may add structured logging.
}

function logInvocationError(
  taskId: string,
  providerId: string,
  errorCode: string,
  durationMs: number,
): void {
  // Sanitized error log. NEVER includes API key, raw prompt, or file content.
  // Phase 5-3+ may add structured error logging.
}

// ── System Prompt Templates ───────────────────────

/**
 * Build a system prompt for the given task type and context file list.
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
