/**
 * AI Research IPC Handlers — Phase 5-2-IMP-4 + Phase 5-5-C-IMP-2.
 *
 * Registers 10 fixed-function IPC handlers for the AI Research Workbench.
 * EVERY handler validates inputs, sanitizes errors, and NEVER returns raw API keys.
 */
import { ipcMain } from 'electron';
import type {
  ChatChunk,
  AIResearchTaskStatus,
  AIResearchTaskResult,
  BuildContextPackInput,
  CancelTaskInput,
  ConfirmContextPackInput,
  ContextConfirmationSnapshot,
  CreateTaskDraftInput,
  ProviderReadiness,
  ResearchContextPreview,
  RunConfirmedTaskInput,
  SaveArtifactDraftInput,
  SaveArtifactDraftResult,
} from '../../src/lib/contracts/ai-research.types';
import {
  AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL,
  AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL,
  AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL,
  AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL,
  AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL,
  AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
  AI_RESEARCH_CANCEL_TASK_CHANNEL,
  AI_RESEARCH_GET_TASK_STATUS_CHANNEL,
  AI_RESEARCH_GET_TASK_RESULT_CHANNEL,
  AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL,
  AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL,
  AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL,
  AI_RESEARCH_TASK_CHUNK_EVENT,
  AI_RESEARCH_TASK_DONE_EVENT,
  AI_RESEARCH_TASK_ERROR_EVENT,
} from '../../src/lib/contracts/ai-research.types';
import { assertString } from '../lib/ipc-validation';
import { sanitizeIpcError } from '../lib/error-utils';
import {
  buildContextPack,
  getContextPackContent,
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
  markTaskStreaming,
  clearTaskAbortController,
  isTaskCancelled,
} from '../services/ai-research-task.service';
import { runInvocationPreflight } from '../services/ai-research-preflight.service';
import {
  buildContextMessages,
  buildSystemPrompt,
  buildUserPrompt,
  executeStreamingInvocation,
} from '../services/ai-provider-gateway.service';
import { getContextConfirmation, setContextConfirmation } from '../services/context-pack.service';
import { storeTaskResult, failTask, getTaskRequest } from '../services/ai-research-task.service';
import { saveArtifactDraft } from '../services/ai-artifact-draft.service';
import type { AIInvocationError } from '../../src/lib/contracts/ai-research.types';

// ── Registration ──────────────────────────────────

export function registerAIResearchIpc(): void {
  // 1. getProviderReadiness
  ipcMain.handle(
    AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL,
    (_event, providerId?: unknown): readonly ProviderReadiness[] => {
      try {
        const id = typeof providerId === 'string' && providerId.length > 0 ? providerId : undefined;
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
    async (_event, input: unknown): Promise<ResearchContextPreview> => {
      try {
        return await buildContextPack(input as BuildContextPackInput);
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

  // 3b. confirmContextPack — metadata-only confirmation guard
  ipcMain.handle(
    AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL,
    (_event, input: unknown): ContextConfirmationSnapshot => {
      try {
        const { contextPackId } = input as ConfirmContextPackInput;
        const id = assertString(contextPackId, 'contextPackId');
        const preview = previewContextPack(id);
        setContextConfirmation({
          fileCount: preview.fileCount,
          files: preview.selectedSourceRefs.map((source) => ({
            relativePath: source.relativePath,
            displayName: source.displayName,
            tokenCount: 0,
            truncated: false,
          })),
          totalTokens: preview.tokenEstimate.totalTokens,
          providerId: preview.providerId,
          model: preview.model,
          providerDisplayName: preview.providerId,
          truncatedFileCount: preview.truncatedFileCount,
        });
        const confirmation = getContextConfirmation();
        return {
          confirmed: confirmation.userConfirmed,
          confirmedAt: confirmation.confirmedAt ?? undefined,
          providerId: preview.providerId,
          model: preview.model,
          fileCount: preview.fileCount,
          totalTokens: preview.tokenEstimate.totalTokens,
          vaultId: null,
        };
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

        // Phase 5-5-C-POST-SYNC-AI-RESEARCH-UX-FIX:
        // Support no-context free conversation mode (empty contextPackId).
        const hasContext = request.contextPackId.length > 0;
        const contextConfirmation = getContextConfirmation();
        const contextPackPreview = hasContext ? previewContextPack(request.contextPackId) : null;

        const preflightResult = runInvocationPreflight(
          request.providerId,
          contextPackPreview,
          true, // userExplicitRun
          contextConfirmation,
        );

        if (!preflightResult.passed) {
          throw new Error(`PREFLIGHT_BLOCKED: ${preflightResult.blockedMessage ?? '预检未通过。'}`);
        }

        // Phase 5-5-C-IMP-2: Check for missing model
        if (!request.model || request.model === '未选择模型') {
          throw new Error('MISSING_MODEL: 未选择模型。请在设置中配置并选择模型。');
        }

        // Mark task as running
        const status = startTaskExecution({ taskId: id });

        // Get AbortSignal for cancellation support
        const abortSignal = getTaskAbortSignal(id);

        // Execute streaming provider invocation (main process only)
        try {
          // Phase 5-5-C-IMP-2: Use skill promptTemplate if available, otherwise default.
          const skillPrompt = request.skillPromptTemplate ?? '';
          const systemPrompt =
            skillPrompt.length > 0
              ? skillPrompt
              : buildSystemPrompt(
                  request.taskType,
                  hasContext
                    ? contextPackPreview!.selectedSourceRefs.map((s) => s.displayName)
                    : [],
                );
          const userPrompt = buildUserPrompt(request.instruction);

          // Phase 5-5-C-IMP-2: Build context messages from stored ContextPack content.
          const contentMap = hasContext ? getContextPackContent(request.contextPackId) : null;
          const contextMessages = contentMap ? buildContextMessages(contentMap) : [];

          const result = await executeStreamingInvocation(
            id,
            request.providerId,
            request.model,
            request.taskType,
            systemPrompt,
            userPrompt,
            contextMessages,
            contextPackPreview?.fileCount ?? 0,
            (content, index) => {
              markTaskStreaming(id);
              const chunk: ChatChunk = {
                type: 'content',
                taskId: id,
                content,
                index,
              };
              _event.sender.send(AI_RESEARCH_TASK_CHUNK_EVENT, chunk);
            },
            abortSignal,
            request.contextPackId,
            request.skillPromptTemplate ? 'selected-skill-template' : 'default-skill',
          );

          // Store the successful result
          storeTaskResult(id, result.artifact, result.metadata, result.warnings, 'completed');

          clearTaskAbortController(id);
          const doneChunk: ChatChunk = {
            type: 'done',
            taskId: id,
            durationMs: result.metadata.durationMs,
            totalTokens: result.metadata.approximateTokens,
          };
          _event.sender.send(AI_RESEARCH_TASK_DONE_EVENT, doneChunk);

          return getTaskStatus(id);
        } catch (err) {
          clearTaskAbortController(id);
          if (isTaskCancelled(id)) {
            return getTaskStatus(id);
          }

          // Sanitize and store as failure
          const invocationError = err as AIInvocationError;
          if (invocationError.code && invocationError.message) {
            failTask(id, invocationError);
            const errorChunk: ChatChunk = {
              type: 'error',
              taskId: id,
              error: {
                code: invocationError.code,
                message: invocationError.message,
              },
            };
            _event.sender.send(AI_RESEARCH_TASK_ERROR_EVENT, errorChunk);
          } else {
            const rawMessage = sanitizeIpcError(err);
            const fallbackError: AIInvocationError = {
              code: 'INVOCATION_FAILED',
              message: rawMessage,
              retryable: true,
            };
            failTask(id, fallbackError);
            const errorChunk: ChatChunk = {
              type: 'error',
              taskId: id,
              error: {
                code: fallbackError.code,
                message: fallbackError.message,
              },
            };
            _event.sender.send(AI_RESEARCH_TASK_ERROR_EVENT, errorChunk);
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
  ipcMain.handle(AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL, (_event, taskId: unknown): void => {
    try {
      const id = assertString(taskId, 'taskId');
      clearTaskResult(id);
    } catch (err) {
      const message = sanitizeIpcError(err);
      throw new Error(`AI_RESEARCH_ERROR: ${message}`);
    }
  });

  // 10. discardArtifact
  ipcMain.handle(AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL, (_event, artifactId: unknown): void => {
    try {
      const id = assertString(artifactId, 'artifactId');
      discardArtifactDraft(id);
    } catch (err) {
      const message = sanitizeIpcError(err);
      throw new Error(`AI_RESEARCH_ERROR: ${message}`);
    }
  });

  // 11. saveArtifactDraft
  ipcMain.handle(
    AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL,
    async (_event, input: unknown): Promise<SaveArtifactDraftResult> => {
      try {
        return await saveArtifactDraft(input as SaveArtifactDraftInput);
      } catch (err) {
        const message = sanitizeIpcError(err);
        throw new Error(`AI_RESEARCH_ERROR: ${message}`);
      }
    },
  );
}
