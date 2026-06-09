/**
 * AI Task Orchestrator — Phase 4-1-IMP-4.
 *
 * Manages streaming task lifecycle: pending → streaming → done/cancelled/error.
 * No real API calls. Skeleton only.
 */
import type { AITaskState, AITaskStatus, ChatChunk, MainChatRequest } from '../../src/lib/contracts/ai-provider.types';

// ── Task Registry ────────────────────────────────────

interface ActiveTask {
  request: MainChatRequest;
  state: AITaskState;
  createdAt: string;
  cancelFn: (() => void) | null;
}

const activeTasks = new Map<string, ActiveTask>();

// ── Public API ───────────────────────────────────────

/** Start a streaming task. Returns taskId. */
export function startTask(request: MainChatRequest): string {
  const taskId = request.taskId;
  activeTasks.set(taskId, {
    request,
    state: 'pending',
    createdAt: new Date().toISOString(),
    cancelFn: null,
  });
  return taskId;
}

/** Transition task to streaming state. */
export function setTaskStreaming(taskId: string, cancelFn: () => void): void {
  const task = activeTasks.get(taskId);
  if (task) {
    task.state = 'streaming';
    task.cancelFn = cancelFn;
  }
}

/** Cancel a streaming task. */
export function cancelTask(taskId: string): void {
  const task = activeTasks.get(taskId);
  if (task && task.state === 'streaming' && task.cancelFn) {
    task.cancelFn();
    task.state = 'cancelled';
    task.cancelFn = null;
  }
}

/** Mark task as done. */
export function setTaskDone(taskId: string): void {
  const task = activeTasks.get(taskId);
  if (task) {
    task.state = 'done';
    task.cancelFn = null;
    // Cleanup after done — keep in registry briefly for status query
    setTimeout(() => activeTasks.delete(taskId), 60_000);
  }
}

/** Mark task as error. */
export function setTaskError(taskId: string): void {
  const task = activeTasks.get(taskId);
  if (task) {
    task.state = 'error';
    task.cancelFn = null;
    setTimeout(() => activeTasks.delete(taskId), 60_000);
  }
}

/** Get task status — renderer-safe (no apiKey). */
export function getTaskStatus(taskId: string): AITaskStatus | null {
  const task = activeTasks.get(taskId);
  if (!task) return null;
  return {
    taskId,
    providerId: task.request.providerId,
    model: task.request.model,
    state: task.state,
    createdAt: task.createdAt,
  };
}

/** Check if a task is active (streaming). */
export function isTaskActive(taskId: string): boolean {
  const task = activeTasks.get(taskId);
  return task?.state === 'streaming';
}

/** Cancel all active tasks (cleanup on shutdown). */
export function cancelAllTasks(): void {
  for (const [taskId, task] of activeTasks) {
    if (task.state === 'streaming' && task.cancelFn) {
      task.cancelFn();
    }
  }
  activeTasks.clear();
}
