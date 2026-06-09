/**
 * AI Research IPC Handlers — Phase 5-2-IMP-4.
 *
 * Registers 10 fixed-function IPC handlers for the AI Research Workbench.
 * EVERY handler validates inputs, sanitizes errors, and NEVER returns raw API keys.
 */
import { ipcMain } from 'electron';
import type {
  AIResearchTaskStatus,
  AIResearchTaskResult,
  BuildContextPackInput,
  CancelTaskInput,
  CreateTaskDraftInput,
  ProviderReadiness,
  ResearchContextPreview,
  RunConfirmedTaskInput,
} from '../../src/lib/contracts/ai-research.types';
import {
  AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL,
  AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL,
  AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL,
  AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL,
  AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
  AI_RESEARCH_CANCEL_TASK_CHANNEL,
  AI_RESEARCH_GET_TASK_STATUS_CHANNEL,
  AI_RESEARCH_GET_TASK_RESULT_CHANNEL,
  AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL,
  AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL,
} from '../../src/lib/contracts/ai-research.types';
import { assertString } from '../lib/ipc-validation';
import { sanitizeIpcError } from '../lib/error-utils';
import {
  buildContextPack,
  getProviderReadiness,
  previewContextPack,
} from '../services/ai-research-context.service';
import {
  createTaskDraft,
  startTaskExecution,
  cancelTask,
  getTaskStatus,
  getTaskResult,
  clearTaskResult,
  discardArtifactDraft,
  getTaskAbortSignal,
} from '../services/ai-research-task.service';
import {
  runInvocationPreflight,
} from '../services/ai-research-preflight.service';
import {
  executeProviderInvocation,
  buildSystemPrompt,
  buildUserPrompt,
} from '../services/ai-provider-gateway.service';
import { getContextConfirmation } from '../services/context-pack.service';
import { storeTaskResult, failTask, getTaskRequest } from '../services/ai-research-task.service';
import type { AIInvocationError } from '../../src/lib/contracts/ai-research.types';

// ── Registration ──────────────────────────────────

export function registerAIResearchIpc(): void {
  // 1. getProviderReadiness
  ipcMain.handle(
    AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL,
    (_event, providerId?: unknown): readonly ProviderReadiness[] => {
      try {
        const id = typeof providerId === 'string' && providerId.length > 0
          ? providerId
          : undefined;
        return getProviderReadiness(id);
      } catch (err) {
        const message = sanitizeIpcError(err);
        throw new Error(`AI_RESEARCH_ERROR: ${message}`);
      }
    },
  );

  // 2. buildContextPack
  ipcMain.handle(
    AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL,
    (_event, input: unknown): ResearchContextPreview => {
      try {
        return buildContextPack(input as BuildContextPackInput);
      } catch (err) {
        const message = sanitizeIpcError(err);
        throw new Error(`AI_RESEARCH_ERROR: ${message}`);
      }
    },
  );

  // 3. previewContextPack
  ipcMain.handle(
    AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL,
    (_event, contextPackId: unknown): ResearchContextPreview => {
      try {
        const id = assertString(contextPackId, 'contextPackId');
        return previewContextPack(id);
      } catch (err) {
        const message = sanitizeIpcError(err);
        throw new Error(`AI_RESEARCH_ERROR: ${message}`);
      }
    },
  );

  // 4. createTaskDraft
  ipcMain.handle(
    AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL,
    (_event, input: unknown): AIResearchTaskStatus => {
      try {
        return createTaskDraft(input as CreateTaskDraftInput);
      } catch (err) {
        const message = sanitizeIpcError(err);
        throw new Error(`AI_RESEARCH_ERROR: ${message}`);
      }
    },
  );

  // 5. runConfirmedTask — with full preflight guard
  ipcMain.handle(
    AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
    async (_event, input: unknown): Promise<AIResearchTaskStatus> => {
      try {
        const { taskId } = input as RunConfirmedTaskInput;
        const id = assertString(taskId, 'taskId');

        // Get task request for context
        const request = getTaskRequest(id);
        if (!request) {
          throw new Error('TASK_NOT_FOUND: 任务未找到。');
        }

        // Preflight gate (all 7 steps)
        const contextConfirmation = getContextConfirmation();
        const contextPackPreview = previewContextPack(request.contextPackId);

        const preflightResult = runInvocationPreflight(
          request.providerId,
          contextPackPreview,
          true, // userExplicitRun
          contextConfirmation,
        );

        if (!preflightResult.passed) {
          throw new Error(
            `PREFLIGHT_BLOCKED: ${preflightResult.blockedMessage ?? '预检未通过。'}`,
          );
        }

        // Mark task as running
        const status = startTaskExecution({ taskId: id });

        // Get AbortSignal for cancellation support
        const abortSignal = getTaskAbortSignal(id);

        // Execute provider invocation (main process only)
        try {
          const systemPrompt = buildSystemPrompt(
            request.taskType,
            contextPackPreview.selectedSourceRefs.map((s) => s.displayName),
          );
          const userPrompt = buildUserPrompt(request.instruction);

          const result = await executeProviderInvocation(
            id,
            request.providerId,
            request.model,
            request.taskType,
            systemPrompt,
            userPrompt,
            contextPackPreview.fileCount,
            abortSignal,
          );

          // Store the successful result
          storeTaskResult(
            id,
            result.artifact,
            result.metadata,
            result.warnings,
            'completed',
          );

          return getTaskStatus(id);
        } catch (err) {
          // Sanitize and store as failure
          const invocationError = err as AIInvocationError;
          if (invocationError.code && invocationError.message) {
            failTask(id, invocationError);
          } else {
            const rawMessage = sanitizeIpcError(err);
            failTask(id, {
              code: 'INVOCATION_FAILED',
              message: rawMessage,
              retryable: true,
            });
          }
          return getTaskStatus(id);
        }
      } catch (err) {
        const message = sanitizeIpcError(err);
        throw new Error(`AI_RESEARCH_ERROR: ${message}`);
      }
    },
  );

  // 6. cancelTask
  ipcMain.handle(
    AI_RESEARCH_CANCEL_TASK_CHANNEL,
    (_event, input: unknown): AIResearchTaskStatus => {
      try {
        return cancelTask(input as CancelTaskInput);
      } catch (err) {
        const message = sanitizeIpcError(err);
        throw new Error(`AI_RESEARCH_ERROR: ${message}`);
      }
    },
  );

  // 7. getTaskStatus
  ipcMain.handle(
    AI_RESEARCH_GET_TASK_STATUS_CHANNEL,
    (_event, taskId: unknown): AIResearchTaskStatus => {
      try {
        const id = assertString(taskId, 'taskId');
        return getTaskStatus(id);
      } catch (err) {
        const message = sanitizeIpcError(err);
        throw new Error(`AI_RESEARCH_ERROR: ${message}`);
      }
    },
  );

  // 8. getTaskResult
  ipcMain.handle(
    AI_RESEARCH_GET_TASK_RESULT_CHANNEL,
    (_event, taskId: unknown): AIResearchTaskResult => {
      try {
        const id = assertString(taskId, 'taskId');
        return getTaskResult(id);
      } catch (err) {
        const message = sanitizeIpcError(err);
        throw new Error(`AI_RESEARCH_ERROR: ${message}`);
      }
    },
  );

  // 9. clearTaskResult
  ipcMain.handle(
    AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL,
    (_event, taskId: unknown): void => {
      try {
        const id = assertString(taskId, 'taskId');
        clearTaskResult(id);
      } catch (err) {
        const message = sanitizeIpcError(err);
        throw new Error(`AI_RESEARCH_ERROR: ${message}`);
      }
    },
  );

  // 10. discardArtifact
  ipcMain.handle(
    AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL,
    (_event, artifactId: unknown): void => {
      try {
        const id = assertString(artifactId, 'artifactId');
        discardArtifactDraft(id);
      } catch (err) {
        const message = sanitizeIpcError(err);
        throw new Error(`AI_RESEARCH_ERROR: ${message}`);
      }
    },
  );
}
