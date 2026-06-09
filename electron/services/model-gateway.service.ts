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

  async *chat(_request: MainChatRequest): AsyncIterable<ChatChunk> {
    // No-op: returns single error chunk
    yield { type: 'error', error: 'AI Workbench not yet implemented. Phase 4-1-IMP-3 required.' };
    yield { type: 'done' };
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
    { id: 'gpt-4o', providerId: 'openai', displayName: 'GPT-4o', contextWindow: 128000, capabilities: ['chat', 'streaming'] },
    { id: 'gpt-4o-mini', providerId: 'openai', displayName: 'GPT-4o Mini', contextWindow: 128000, capabilities: ['chat', 'streaming'] },
    { id: 'claude-sonnet-4-20250514', providerId: 'anthropic', displayName: 'Claude Sonnet 4', contextWindow: 200000, capabilities: ['chat', 'streaming'] },
    { id: 'llama3.2', providerId: 'ollama', displayName: 'Llama 3.2 (local)', contextWindow: 128000, capabilities: ['chat', 'streaming', 'local'] },
  ]);

  return gw;
}

/** Singleton gateway instance. */
export const modelGateway: AIModelGateway = createModelGateway();
