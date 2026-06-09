/**
 * AI Provider / Model Gateway / Task Orchestrator contracts — Phase 4-1-IMP-1.
 *
 * Defines the type system for Schola AI Workbench.
 * No real API calls. No API key storage. No streaming implementation.
 * BYOK only. No built-in credits.
 */

// ── Provider ────────────────────────────────────────

/** Supported AI provider kinds. */
export type AIProviderKind = 'openai' | 'anthropic' | 'ollama';

/** AI provider configuration — user-managed. */
export interface AIProviderConfig {
  readonly id: string;
  readonly kind: AIProviderKind;
  readonly displayName: string;
  readonly baseURL: string;
  /** Whether an API key has been configured (NOT the key itself). */
  readonly keyConfigured: boolean;
  readonly enabled: boolean;
}

/** Model information — returned by ModelGateway. */
export interface AIModelInfo {
  readonly id: string;
  readonly providerId: string;
  readonly displayName: string;
  readonly contextWindow: number;
  readonly capabilities: readonly string[];
}

// ── Chat ────────────────────────────────────────────

/** Chat message role. */
export type ChatRole = 'system' | 'user' | 'assistant';

/** A single chat message. */
export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
}

/** Chat options — model parameters. */
export interface ChatOptions {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
}

/**
 * Chat request — renderer-safe.
 * NO apiKey field. Renderer uses this type.
 */
export interface RendererChatRequest {
  readonly taskId: string;
  readonly providerId: string;
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly options: ChatOptions;
}

/**
 * Chat request — main-process only (Phase 4-1-IMP-2 split).
 * Contains apiKey. NEVER exposed to renderer.
 */
export interface MainChatRequest extends RendererChatRequest {
  /** Present only in main process. Renderer NEVER sees or constructs this. */
  readonly apiKey: string;
}

/** Backward-compatible alias — use MainChatRequest in main, RendererChatRequest in renderer. */
export type ChatRequest = MainChatRequest;

// ── Streaming ────────────────────────────────────────

/** Streaming chunk types. */
export type ChatChunk =
  | { readonly type: 'content'; readonly content: string }
  | { readonly type: 'done' }
  | { readonly type: 'error'; readonly error: string /* sanitized */ };

// ── Task ─────────────────────────────────────────────

/** AI task lifecycle state. */
export type AITaskState =
  | 'pending'
  | 'streaming'
  | 'cancelled'
  | 'done'
  | 'error';

/** AI task status — renderer-safe (no apiKey). */
export interface AITaskStatus {
  readonly taskId: string;
  readonly providerId: string;
  readonly model: string;
  readonly state: AITaskState;
  readonly createdAt: string;
}

// ── Provider Adapter ─────────────────────────────────

/**
 * AI Provider Adapter contract.
 * Implementations handle provider-specific HTTP details.
 * apiKey is received in ChatRequest — never read from renderer.
 */
export interface AIProviderAdapter {
  readonly id: string;
  readonly kind: AIProviderKind;

  /** Stream chat response as AsyncIterable of ChatChunk. */
  chat(request: ChatRequest): AsyncIterable<ChatChunk>;

  /** Cancel an ongoing chat task. */
  cancel(taskId: string): void;
}

// ── Model Gateway ────────────────────────────────────

/**
 * Model Gateway — unified entry point for AI chat requests.
 * Routes to correct provider adapter.
 * Renderer interacts via fixed-function IPC only.
 */
export interface AIModelGateway {
  /** Register a provider adapter. */
  register(adapter: AIProviderAdapter): void;

  /** List available models across all registered providers. */
  getAvailableModels(): AIModelInfo[];

  /** Stream chat — routes to correct adapter. */
  chat(request: ChatRequest): AsyncIterable<ChatChunk>;

  /** Cancel a task by ID. */
  cancel(taskId: string): void;
}

// ── Error ────────────────────────────────────────────

/** Sanitized AI error — safe for renderer/logs. No API key, no raw response. */
export interface AISanitizedError {
  readonly code: string;
  readonly message: string;
  readonly providerId?: string;
  readonly statusCode?: number;
}
