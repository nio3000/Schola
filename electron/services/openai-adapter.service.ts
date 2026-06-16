/**
 * OpenAI-compatible Adapter — Phase 4-1-IMP-3.
 *
 * Maps MainChatRequest to OpenAI-compatible HTTP requests.
 * SKELETON — no real HTTP calls. Production in IMP-4 (streaming).
 * BYOK only. No built-in keys. No built-in credits.
 */
import type {
  AIProviderAdapter,
  AIProviderKind,
  MainChatRequest,
  ChatChunk,
} from '../../src/lib/contracts/ai-provider.types';
import type { ProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import { getProviderKey } from './provider-key-store.service';
import { startTask, setTaskStreaming, cancelTask } from './ai-task-orchestrator.service';

export class OpenAICompatibleAdapter implements AIProviderAdapter {
  readonly id: string;
  readonly kind: AIProviderKind = 'openai';
  private readonly preset: ProviderPreset;

  constructor(preset: ProviderPreset) {
    this.id = preset.id;
    this.preset = preset;
  }

  async *chat(request: MainChatRequest): AsyncIterable<ChatChunk> {
    const apiKey = getProviderKey(this.id);
    if (!apiKey) {
      yield {
        type: 'error',
        taskId: request.taskId,
        error: {
          code: 'missing_api_key',
          message: `No API key configured for ${this.preset.displayName}.`,
        },
      };
      yield { type: 'done', taskId: request.taskId };
      return;
    }

    startTask(request);
    let cancelled = false;

    setTaskStreaming(request.taskId, () => {
      cancelled = true;
    });

    try {
      // Skeleton — no real HTTP. Production: fetch() SSE/streaming.
      yield {
        type: 'content',
        taskId: request.taskId,
        content: `[${this.preset.displayName}] Streaming ready (BYOK). Real API calls require Phase 4-1-IMP-4 production integration.`,
      };

      if (cancelled) {
        yield {
          type: 'error',
          taskId: request.taskId,
          error: { code: 'cancelled', message: 'Task cancelled.' },
        };
        return;
      }

      yield { type: 'done', taskId: request.taskId };
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 200) : 'Unknown error';
      yield {
        type: 'error',
        taskId: request.taskId,
        error: { code: 'provider_error', message: msg },
      };
    } finally {
      yield { type: 'done', taskId: request.taskId };
    }
  }

  cancel(taskId: string): void {
    cancelTask(taskId);
  }
}
