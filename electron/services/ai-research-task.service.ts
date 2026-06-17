/**
 * AI Research Task Service — Phase 5-2-IMP-3.
 *
 * Manages the lifecycle of AI Research tasks:
 *   - createTaskDraft (idle → drafting → ready)
 *   - runConfirmedTask (ready → running/streaming → completed/failed)
 *   - cancelTask (running → cancelled)
 *   - getTaskStatus / getTaskResult / clearTaskResult
 *   - discardArtifactDraft
 *
 * ALL task state is in-memory only (session-scoped).
 * NO Vault writes. NO artifact auto-save. NO persistence.
 *
 * Provider invocation goes through the provider gateway
 * which enforces the preflight gate.
 */
import type {
  AIArtifactDraft,
  AIInvocationError,
  AIInvocationMetadata,
  AIResearchTaskRequest,
  AIResearchTaskResult,
  AIResearchTaskState,
  AIResearchTaskStatus,
  AIResearchTaskType,
  AIResearchWarning,
  CancelTaskInput,
  CreateTaskDraftInput,
  EvidenceRef,
  RunConfirmedTaskInput,
} from '../../src/lib/contracts/ai-research.types';
import { AI_RESEARCH_TASK_LABELS } from '../../src/lib/contracts/ai-research.types';
import { sanitizeIpcError } from '../lib/error-utils';
import { assertString } from '../lib/ipc-validation';

// ── In-memory stores ──────────────────────────────

interface TaskRecord {
  readonly request: AIResearchTaskRequest;
  status: AIResearchTaskStatus;
  result?: AIResearchTaskResult;
  aborted: boolean;
  /** AbortController for cancelling in-flight provider requests. */
  abortController?: AbortController;
}

const tasks = new Map<string, TaskRecord>();
const artifacts = new Map<string, AIArtifactDraft>();

let taskIdCounter = 0;

// ── Public API ────────────────────────────────────

/**
 * Create a task draft from user input.
 * State transition: idle → drafting → ready.
 */
export function createTaskDraft(input: CreateTaskDraftInput): AIResearchTaskStatus {
  try {
    assertCreateTaskDraftInput(input);

    const taskId = generateTaskId();
    const now = new Date().toISOString();

    const request: AIResearchTaskRequest = {
      taskType: input.taskType,
      contextPackId: input.contextPackId,
      instruction: input.instruction,
      providerId: input.providerId,
      model: input.model,
      skillPromptTemplate: input.skillPromptTemplate,
    };

    const status: AIResearchTaskStatus = {
      taskId,
      taskType: input.taskType,
      state: 'ready',
      createdAt: now,
      providerId: input.providerId,
      model: input.model,
    };

    tasks.set(taskId, { request, status, aborted: false });
    return status;
  } catch (err) {
    throw createSanitizedServiceError(err);
  }
}

/**
 * Run a confirmed task through the provider gateway.
 * Creates an AbortController so cancelTask can abort in-flight HTTP requests.
 * State transition: ready → running.
 */
export function startTaskExecution(input: RunConfirmedTaskInput): AIResearchTaskStatus {
  try {
    const taskId = assertString(input.taskId, 'taskId');
    const record = tasks.get(taskId);

    if (!record) {
      throw new Error('TASK_NOT_FOUND: The specified task was not found.');
    }

    if (record.status.state !== 'ready') {
      throw new Error(
        `TASK_STATE_INVALID: Task is in state "${record.status.state}", expected "ready".`,
      );
    }

    if (record.aborted) {
      throw new Error('TASK_ABORTED: The task has been cancelled.');
    }

    // Create a fresh AbortController for this task run
    record.abortController = new AbortController();

    record.status = {
      ...record.status,
      state: 'running',
      startedAt: new Date().toISOString(),
    };

    return record.status;
  } catch (err) {
    throw createSanitizedServiceError(err);
  }
}

/**
 * Cancel a running task.
 * Aborts the in-flight provider HTTP request via AbortController,
 * then transitions state: running/streaming → cancelled.
 */
export function cancelTask(input: CancelTaskInput): AIResearchTaskStatus {
  try {
    const taskId = assertString(input.taskId, 'taskId');
    const record = tasks.get(taskId);

    if (!record) {
      throw new Error('TASK_NOT_FOUND: The specified task was not found.');
    }

    const cancellableStates: AIResearchTaskState[] = ['running', 'streaming'];
    if (!cancellableStates.includes(record.status.state)) {
      throw new Error(`TASK_STATE_INVALID: Cannot cancel task in state "${record.status.state}".`);
    }

    // Abort the in-flight HTTP request if one is active
    if (record.abortController) {
      record.abortController.abort();
      record.abortController = undefined;
    }

    record.aborted = true;
    record.status = {
      ...record.status,
      state: 'cancelled',
      completedAt: new Date().toISOString(),
      message: '任务已被用户取消。',
    };

    return record.status;
  } catch (err) {
    throw createSanitizedServiceError(err);
  }
}

/**
 * Mark a running task as streaming after the first provider content chunk.
 */
export function markTaskStreaming(taskId: string): AIResearchTaskStatus | null {
  const record = tasks.get(taskId);
  if (!record) return null;
  if (record.aborted || record.status.state === 'cancelled') return record.status;
  if (record.status.state !== 'running' && record.status.state !== 'streaming')
    return record.status;

  record.status = {
    ...record.status,
    state: 'streaming',
  };
  return record.status;
}

/**
 * Remove the active AbortController for a finished task.
 */
export function clearTaskAbortController(taskId: string): void {
  const record = tasks.get(taskId);
  if (!record) return;
  record.abortController = undefined;
}

/**
 * Abort all pending AI Research provider requests.
 * Called from app before-quit.
 */
export function abortAllPendingTasks(): void {
  for (const record of tasks.values()) {
    if (record.status.state !== 'running' && record.status.state !== 'streaming') continue;
    record.abortController?.abort();
    record.abortController = undefined;
    record.aborted = true;
    record.status = {
      ...record.status,
      state: 'cancelled',
      completedAt: new Date().toISOString(),
      message: '应用退出，任务已取消。',
    };
  }
}

export function isTaskCancelled(taskId: string): boolean {
  const record = tasks.get(taskId);
  return record?.aborted === true || record?.status.state === 'cancelled';
}

/**
 * Get the current status of a task.
 */
export function getTaskStatus(taskId: string): AIResearchTaskStatus {
  try {
    const id = assertString(taskId, 'taskId');
    const record = tasks.get(id);

    if (!record) {
      throw new Error('TASK_NOT_FOUND: The specified task was not found.');
    }

    return record.status;
  } catch (err) {
    throw createSanitizedServiceError(err);
  }
}

/**
 * Get the result of a completed/failed task.
 */
export function getTaskResult(taskId: string): AIResearchTaskResult {
  try {
    const id = assertString(taskId, 'taskId');
    const record = tasks.get(id);

    if (!record) {
      throw new Error('TASK_NOT_FOUND: The specified task was not found.');
    }

    if (!record.result) {
      throw new Error('TASK_RESULT_NOT_READY: The task has no result yet.');
    }

    return record.result;
  } catch (err) {
    throw createSanitizedServiceError(err);
  }
}

/**
 * Clear a task's result from memory.
 */
export function clearTaskResult(taskId: string): void {
  try {
    const id = assertString(taskId, 'taskId');
    const record = tasks.get(id);

    if (record) {
      record.result = undefined;
    }
  } catch (err) {
    throw createSanitizedServiceError(err);
  }
}

/**
 * Discard an artifact draft (remove from in-memory store).
 */
export function discardArtifactDraft(artifactId: string): void {
  try {
    const id = assertString(artifactId, 'artifactId');
    const artifact = artifacts.get(id);
    if (artifact) {
      artifacts.set(id, {
        ...artifact,
        status: 'discarded',
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    throw createSanitizedServiceError(err);
  }
}

export function getArtifactDraft(artifactId: string): AIArtifactDraft {
  try {
    const id = assertString(artifactId, 'artifactId');
    const artifact = artifacts.get(id);
    if (!artifact) {
      throw new Error('ARTIFACT_NOT_FOUND: The artifact draft was not found.');
    }
    return artifact;
  } catch (err) {
    throw createSanitizedServiceError(err);
  }
}

export function markArtifactDraftSaved(
  artifactId: string,
  relativePath: string,
): AIArtifactDraft {
  try {
    const id = assertString(artifactId, 'artifactId');
    const savedPath = assertString(relativePath, 'relativePath');
    const artifact = artifacts.get(id);
    if (!artifact) {
      throw new Error('ARTIFACT_NOT_FOUND: The artifact draft was not found.');
    }
    const saved: AIArtifactDraft = {
      ...artifact,
      status: 'saved',
      savedRelativePath: savedPath,
      updatedAt: new Date().toISOString(),
    };
    artifacts.set(id, saved);
    return saved;
  } catch (err) {
    throw createSanitizedServiceError(err);
  }
}

/**
 * Store a completed artifact draft result for a task.
 * Called by the provider gateway after a successful invocation.
 *
 * If the task was cancelled while the HTTP request was in-flight,
 * the result is silently discarded to prevent overwriting cancelled state.
 */
export function storeTaskResult(
  taskId: string,
  artifact: AIArtifactDraft,
  metadata: AIInvocationMetadata,
  warnings: readonly AIResearchWarning[],
  state: AIResearchTaskState,
  message?: string,
): void {
  const record = tasks.get(taskId);
  if (!record) return;

  // Guard: do NOT overwrite a cancelled task
  if (record.aborted || record.status.state === 'cancelled') {
    return;
  }

  record.abortController = undefined;

  artifacts.set(artifact.artifactId, artifact);

  record.result = {
    taskId,
    taskType: record.status.taskType,
    state,
    artifact,
    metadata,
    warnings,
  };

  record.status = {
    ...record.status,
    state,
    completedAt: new Date().toISOString(),
    ...(message ? { message } : {}),
  };
}

/**
 * Update task status to 'failed' with a sanitized error.
 * Does NOT overwrite a cancelled state.
 */
export function failTask(taskId: string, error: AIInvocationError): void {
  const record = tasks.get(taskId);
  if (!record) return;

  // Guard: do NOT overwrite a cancelled task
  if (record.aborted || record.status.state === 'cancelled') {
    return;
  }

  record.abortController = undefined;

  record.status = {
    ...record.status,
    state: 'failed',
    completedAt: new Date().toISOString(),
    message: error.message,
  };

  record.result = {
    taskId,
    taskType: record.status.taskType,
    state: 'failed',
    metadata: createFailedMetadata(record, error),
    warnings: [
      {
        code: 'invocation_failed',
        message: error.message,
        severity: 'high',
      },
    ],
  };
}

/**
 * Build a placeholder artifact draft. Used when the provider gateway
 * is not yet fully wired or when a mock result is needed for UI testing.
 */
export function buildPlaceholderArtifact(
  taskId: string,
  taskType: AIResearchTaskType,
): AIArtifactDraft {
  const artifactId = `artifact-${taskId}`;
  const now = new Date().toISOString();
  const label = AI_RESEARCH_TASK_LABELS[taskType] ?? taskType;

  const evidence: EvidenceRef[] = [
    {
      id: `${artifactId}-ev-1`,
      kind: 'source-backed',
      label: '文献来源引用',
      sourceRef: {
        relativePath: 'papers/example.md',
        displayName: 'example.md',
      },
    },
    {
      id: `${artifactId}-ev-2`,
      kind: 'model-inferred',
      label: '模型推断',
      modelInferredNote: '此项为模型根据上下文推断，非原文直接引用。请人工核实。',
    },
  ];

  return {
    id: artifactId,
    artifactId,
    taskId,
    taskType,
    title: `${label} — 草稿预览`,
    format: 'markdown',
    content: `# ${label}\n\n> **草稿预览** — 此内容为模型生成，需人工审核。\n\n分析结果将在此处显示。`,
    evidence,
    evidenceRefs: evidence,
    warnings: [
      {
        code: 'draft_placeholder',
        message: '此为占位草稿。实际分析结果将在 provider invocation 完成后替换。',
        severity: 'low',
      },
    ],
    isDraft: true,
    reviewRequired: true,
    createdAt: now,
    updatedAt: now,
    sourcePackId: 'placeholder-context-pack',
    providerId: 'placeholder-provider',
    model: 'placeholder-model',
    skillId: 'placeholder-skill',
    status: 'draft',
  };
}

/**
 * Build invocation metadata (no raw prompt, no API key).
 */
export function buildInvocationMetadata(
  taskId: string,
  providerId: string,
  model: string,
  taskType: AIResearchTaskType,
  contextFileCount: number,
  approximateTokens: number,
  durationMs: number,
  streaming: boolean,
): AIInvocationMetadata {
  return {
    taskId,
    providerId,
    model,
    taskType,
    contextFileCount,
    approximateTokens,
    durationMs,
    streaming,
  };
}

// ── Helpers ───────────────────────────────────────

function generateTaskId(): string {
  taskIdCounter += 1;
  return `task-${Date.now()}-${taskIdCounter}`;
}

function assertCreateTaskDraftInput(input: CreateTaskDraftInput): void {
  assertString(input.taskType, 'taskType');
  // Phase 5-5-C-POST-SYNC-AI-RESEARCH-UX-FIX:
  // Allow empty contextPackId for no-context free conversation mode.
  if (typeof input.contextPackId !== 'string') {
    throw new Error('INVALID_INPUT: contextPackId must be a string.');
  }
  assertString(input.instruction, 'instruction');
  assertString(input.providerId, 'providerId');
  assertString(input.model, 'model');
}

function createFailedMetadata(record: TaskRecord, error: AIInvocationError): AIInvocationMetadata {
  return {
    taskId: record.status.taskId,
    providerId: record.request.providerId,
    model: record.request.model,
    taskType: record.request.taskType,
    contextFileCount: 0,
    approximateTokens: 0,
    durationMs: 0,
    streaming: false,
    sanitizedError: error.message,
  };
}

function createSanitizedServiceError(err: unknown): Error {
  const message = sanitizeIpcError(err);
  return new Error(`AI_RESEARCH_TASK_ERROR: ${message}`);
}

/**
 * Check if a task is currently in a cancellable state.
 */
export function isTaskCancellable(taskId: string): boolean {
  const record = tasks.get(taskId);
  if (!record) return false;
  return record.status.state === 'running' || record.status.state === 'streaming';
}

/**
 * Get the AbortSignal for a running task.
 * Used by the provider gateway to wire cancellation into HTTP fetch.
 * Returns undefined if the task is not running or has no active controller.
 */
export function getTaskAbortSignal(taskId: string): AbortSignal | undefined {
  const record = tasks.get(taskId);
  if (!record) return undefined;
  if (record.status.state !== 'running' && record.status.state !== 'streaming') return undefined;
  return record.abortController?.signal;
}

/**
 * Get the task request (contains contextPackId for the provider gateway).
 */
export function getTaskRequest(taskId: string): AIResearchTaskRequest | undefined {
  const record = tasks.get(taskId);
  return record?.request;
}
