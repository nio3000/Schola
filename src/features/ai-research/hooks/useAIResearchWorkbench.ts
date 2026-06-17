import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type {
  AIArtifactDraft,
  AIResearchTaskState,
  AIResearchTaskStatus,
  AIResearchTaskType,
  AIResearchWarning,
  ContextSourceRef,
  EvidenceRef,
  InvocationPreflightResult,
  ProviderReadiness,
  ResearchContextPreview,
} from '../../../lib/contracts/ai-research.types';
import type { FileEntry } from '../../../lib/contracts/vault.types';
import type { AIPreferences } from '../../../lib/contracts/settings.types';
import {
  buildContextPack,
  cancelTask,
  createTaskDraft,
  discardArtifact,
  getProviderReadiness,
  getTaskResult,
  runConfirmedTask,
  saveArtifactDraft,
  subscribeTask,
} from '../../../lib/platform/ai-research-api';
import { getAIPreferences } from '../../../lib/platform/settings-api';

export type AIResearchWorkbenchStage =
  | 'idle'
  | 'sources_selected'
  | 'pack_built'
  | 'drafting'
  | 'draft_created'
  | 'running'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface UseAIResearchWorkbenchInput {
  readonly vaultId: string | null;
  readonly fileTree: readonly FileEntry[];
}

// Phase 5-5-C-POST-SYNC-AI-RESEARCH-CHAT-THREAD-FIX:
// Conversation thread message types for GPT-like chat UX.
export interface AIResearchUserMessage {
  readonly id: string;
  readonly role: 'user';
  readonly content: string;
  readonly createdAt: string;
  readonly contextMode: 'none' | 'selected-context';
  readonly contextPackId?: string;
}

export interface AIResearchAssistantMessage {
  readonly id: string;
  readonly role: 'assistant';
  readonly taskId: string;
  content: string;
  readonly createdAt: string;
  updatedAt: string;
  status: 'streaming' | 'completed' | 'cancelled' | 'failed';
  readonly providerId: string;
  readonly model: string;
  readonly error?: string;
  readonly artifactDraftId?: string;
  readonly evidenceRefs?: readonly EvidenceRef[];
}

export type AIResearchChatMessage = AIResearchUserMessage | AIResearchAssistantMessage;

let msgIdCounter = 0;
function nextMsgId(): string {
  msgIdCounter += 1;
  return `msg-${Date.now()}-${msgIdCounter}`;
}

function toSourceType(relativePath: string): ContextSourceRef['sourceType'] | null {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.txt')) return 'txt';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.doc')) return 'doc';
  if (lower.endsWith('.xls')) return 'xls';
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return 'pptx';
  // All other supported extensions → 'other' (metadata only)
  if (
    lower.endsWith('.json') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.tex') ||
    lower.endsWith('.bib') ||
    lower.endsWith('.ris') ||
    lower.endsWith('.rtf') ||
    lower.endsWith('.tsv')
  )
    return 'other';
  return null;
}

function flattenSourceRefs(entries: readonly FileEntry[]): ContextSourceRef[] {
  return entries.flatMap((entry) => {
    if (entry.type === 'directory') return flattenSourceRefs(entry.children ?? []);
    const sourceType = toSourceType(entry.relativePath);
    if (!sourceType) return [];
    return [
      {
        relativePath: entry.relativePath,
        displayName: entry.name,
        sourceType,
        fileSize: entry.size ?? 0,
      },
    ];
  });
}

function createPreflightResult(params: {
  readonly provider: ProviderReadiness | null;
  readonly contextPackPreview: ResearchContextPreview | null;
  readonly contextConfirmed: boolean;
  readonly privacyConsented: boolean;
  readonly isNoContext: boolean;
}): InvocationPreflightResult {
  if (!params.provider?.ready) {
    return {
      passed: false,
      blockedReason: params.provider?.enabled === false ? 'provider_disabled' : 'no_api_key',
      blockedMessage: params.provider?.blockedReason ?? '提供者尚未就绪。',
      providerReady: false,
      privacyConsented: params.privacyConsented,
      contextConfirmed: params.contextConfirmed,
      userExplicitRun: false,
    };
  }

  // Phase 5-5-C-POST-SYNC-AI-RESEARCH-UX-FIX:
  // No-context mode skips ContextPack-related gates.
  if (!params.isNoContext) {
    if (!params.contextPackPreview) {
      return {
        passed: false,
        blockedReason: 'context_pack_not_ready',
        blockedMessage: '请先构建上下文包。',
        providerReady: true,
        privacyConsented: params.privacyConsented,
        contextConfirmed: params.contextConfirmed,
        userExplicitRun: false,
      };
    }

    if (!params.contextConfirmed) {
      return {
        passed: false,
        blockedReason: 'context_not_confirmed',
        blockedMessage: '请确认将发送的上下文摘要。',
        providerReady: true,
        privacyConsented: params.privacyConsented,
        contextConfirmed: false,
        userExplicitRun: false,
      };
    }
  }

  if (!params.privacyConsented) {
    return {
      passed: false,
      blockedReason: 'privacy_consent_required',
      blockedMessage: '请先完成隐私同意确认。',
      providerReady: true,
      privacyConsented: false,
      contextConfirmed: true,
      userExplicitRun: false,
    };
  }

  return {
    passed: true,
    providerReady: true,
    privacyConsented: true,
    contextConfirmed: params.contextConfirmed || params.isNoContext,
    userExplicitRun: false,
  };
}

export function useAIResearchWorkbench({ vaultId, fileTree }: UseAIResearchWorkbenchInput) {
  const availableSources = useMemo(() => flattenSourceRefs(fileTree), [fileTree]);
  const [selectedSources, setSelectedSources] = useState<readonly ContextSourceRef[]>([]);
  const [providerReadiness, setProviderReadiness] = useState<readonly ProviderReadiness[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<AIResearchTaskType>('analysis_summary');
  const [instruction, setInstruction] = useState('');
  const [contextPackPreview, setContextPackPreview] = useState<ResearchContextPreview | null>(null);
  const [currentTask, setCurrentTask] = useState<AIResearchTaskStatus | null>(null);
  const [currentArtifact, setCurrentArtifact] = useState<AIArtifactDraft | null>(null);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [chatMessages, setChatMessages] = useState<readonly AIResearchChatMessage[]>([]);
  const [savedArtifactPath, setSavedArtifactPath] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<readonly AIResearchWarning[]>([]);
  const [contextConfirmed, setContextConfirmed] = useState(false);
  const [privacyConsented, setPrivacyConsented] = useState(false);
  const [stage, setStage] = useState<AIResearchWorkbenchStage>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stateRevision, bumpStateRevision] = useReducer((value: number) => value + 1, 0);
  const unsubscribeTaskRef = useRef<(() => void) | null>(null);
  const runInFlightRef = useRef(false);
  const currentAssistantIdRef = useRef<string | null>(null);
  const pendingSendRef = useRef<{ skillPromptTemplate?: string } | null>(null);
  const currentTaskRef = useRef<AIResearchTaskStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Phase 5-5-C-POST-SYNC-MODEL-BINDING-FIX:
      // Read user's saved AI preferences (defaultProviderId + defaultModel) from Settings
      // BEFORE falling back to provider readiness defaults.
      // This ensures AI Research shows the same model the user selected in Settings.
      let prefs: AIPreferences | null = null;
      try {
        prefs = await getAIPreferences();
      } catch {
        // Settings API unavailable — fall through to provider readiness
      }

      const readiness = await getProviderReadiness();
      if (cancelled) return;
      setProviderReadiness(readiness);

      // Priority: user's saved preference → first ready provider → first available
      if (prefs?.defaultProviderId && prefs?.defaultModel) {
        const preferredProvider = readiness.find(
          (p) => p.providerId === prefs!.defaultProviderId,
        );
        if (preferredProvider) {
          const preferredModel = preferredProvider.models.find(
            (m) => m.id === prefs!.defaultModel,
          );
          if (preferredModel) {
            setSelectedProviderId(prefs!.defaultProviderId);
            setSelectedModel(prefs!.defaultModel);
            return;
          }
        }
      }

      // Fallback: first ready provider or first available
      const readyProvider =
        readiness.find((provider) => provider.ready) ?? readiness[0] ?? null;
      if (readyProvider) {
        setSelectedProviderId((current) => current ?? readyProvider.providerId);
        setSelectedModel((current) => current ?? readyProvider.models[0]?.id ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProvider = useMemo(
    () =>
      providerReadiness.find((provider) => provider.providerId === selectedProviderId) ??
      providerReadiness[0] ??
      null,
    [providerReadiness, selectedProviderId],
  );

  const model = selectedModel ?? selectedProvider?.models[0]?.id ?? '未选择模型';

  const cancelTaskIfActive = useCallback((task: AIResearchTaskStatus | null) => {
    if (!task || (task.state !== 'running' && task.state !== 'streaming')) return;
    void cancelTask({ taskId: task.taskId }).catch(() => undefined);
  }, []);

  const changeProvider = useCallback(
    (providerId: string) => {
      cancelTaskIfActive(currentTask);
      unsubscribeTaskRef.current?.();
      unsubscribeTaskRef.current = null;
      const provider = providerReadiness.find((item) => item.providerId === providerId);
      setSelectedProviderId(providerId);
      setSelectedModel(provider?.models[0]?.id ?? null);
      setContextPackPreview(null);
      setContextConfirmed(false);
      setStreamingResponse('');
    },
    [cancelTaskIfActive, currentTask, providerReadiness],
  );

  const changeModel = useCallback(
    (modelId: string | null) => {
      cancelTaskIfActive(currentTask);
      unsubscribeTaskRef.current?.();
      unsubscribeTaskRef.current = null;
      setSelectedModel(modelId);
      setContextPackPreview(null);
      setContextConfirmed(false);
      setStreamingResponse('');
    },
    [cancelTaskIfActive, currentTask],
  );

  const isNoContext = selectedSources.length === 0;
  const preflightResult = useMemo(
    () =>
      createPreflightResult({
        provider: selectedProvider,
        contextPackPreview,
        contextConfirmed,
        privacyConsented,
        isNoContext,
      }),
    [contextConfirmed, contextPackPreview, privacyConsented, selectedProvider, isNoContext],
  );

  const taskState: AIResearchTaskState =
    currentTask?.state ?? (stage === 'sources_selected' ? 'drafting' : 'idle');

  const toggleSource = useCallback((source: ContextSourceRef) => {
    setSelectedSources((current) => {
      const exists = current.some((item) => item.relativePath === source.relativePath);
      const next = exists
        ? current.filter((item) => item.relativePath !== source.relativePath)
        : [...current, source];
      setContextPackPreview(null);
      setContextConfirmed(false);
      setCurrentTask(null);
      setCurrentArtifact(null);
      setSavedArtifactPath(null);
      setStreamingResponse('');
      setStage(next.length > 0 ? 'sources_selected' : 'idle');
      bumpStateRevision();
      return next;
    });
  }, []);

  const buildPack = useCallback(async () => {
    if (!vaultId || selectedSources.length === 0 || !selectedProvider) return false;
    setLoading(true);
    setError(null);
    try {
      const preview = await buildContextPack({
        vaultId,
        selectedSources,
        providerId: selectedProvider.providerId,
        model,
      });
      setContextPackPreview(preview);
      setWarnings(
        preview.warnings.map((message, index) => ({
          code: `context-warning-${index}`,
          message,
          severity: preview.truncatedFileCount > 0 ? 'medium' : 'low',
        })),
      );
      setContextConfirmed(false);
      setStage('pack_built');
      bumpStateRevision();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '构建上下文包失败。');
      setStage('failed');
      return false;
    } finally {
      setLoading(false);
    }
  }, [model, selectedProvider, selectedSources, vaultId]);

  const createDraft = useCallback(
    async (skillPromptTemplate?: string) => {
      // Phase 5-5-C-POST-SYNC-AI-RESEARCH-UX-FIX:
      // Allow creating draft without context (no-context free conversation mode).
      const isNoContext = selectedSources.length === 0;
      const hasContext = !isNoContext && contextPackPreview !== null;
      if (!selectedProvider || instruction.trim().length === 0) return;
      if (!isNoContext && !hasContext) return;
      setLoading(true);
      setError(null);
      setStage('drafting');
      try {
        const task = await createTaskDraft({
          taskType,
          contextPackId: hasContext ? contextPackPreview.packId : '',
          instruction: instruction.trim(),
          providerId: selectedProvider.providerId,
          model,
          skillPromptTemplate,
        });
        setCurrentTask(task);
        setCurrentArtifact(null);
        setSavedArtifactPath(null);
        setStreamingResponse('');
        setStage('draft_created');
        bumpStateRevision();
      } catch (err) {
        setError(err instanceof Error ? err.message : '创建草稿任务失败。');
        setStage('failed');
      } finally {
        setLoading(false);
      }
    },
    [contextPackPreview, instruction, model, selectedProvider, selectedSources, taskType],
  );

  const runTask = useCallback(async (overrideTask?: AIResearchTaskStatus | null) => {
    // Use override task if provided (from executePendingSend), else current state
    const task = overrideTask ?? currentTask;
    if (!task || !preflightResult.passed || runInFlightRef.current) return;
    if (task.state === 'running' || task.state === 'streaming') return;
    const taskId = task.taskId;
    runInFlightRef.current = true;
    setLoading(true);
    setError(null);
    setStage('running');
    setStreamingResponse('');
    unsubscribeTaskRef.current?.();

    // Phase 5-5-C-POST-SYNC-AI-RESEARCH-CHAT-THREAD-FIX:
    // Append user message + assistant placeholder to conversation thread.
    const userMsg: AIResearchUserMessage = {
      id: nextMsgId(),
      role: 'user',
      content: instruction.trim(),
      createdAt: new Date().toISOString(),
      contextMode: isNoContext ? 'none' : 'selected-context',
      contextPackId: contextPackPreview?.packId,
    };
    const assistantId = nextMsgId();
    currentAssistantIdRef.current = assistantId;
    const assistantMsg: AIResearchAssistantMessage = {
      id: assistantId,
      role: 'assistant',
      taskId,
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'streaming',
      providerId: selectedProvider?.providerId ?? task.providerId,
      model,
    };
    setChatMessages((msgs) => [...msgs, userMsg, assistantMsg]);
    setInstruction('');
    bumpStateRevision();

    unsubscribeTaskRef.current = subscribeTask(taskId, {
      onChunk: (chunk) => {
        setCurrentTask((task) =>
          task && task.taskId === chunk.taskId ? { ...task, state: 'streaming' } : task,
        );
        setStage('streaming');
        setStreamingResponse((current) => `${current}${chunk.content}`);
        // Append chunk to the matching assistant message
        setChatMessages((msgs) =>
          msgs.map((msg) =>
            msg.role === 'assistant' && msg.id === assistantId
              ? {
                  ...msg,
                  content: msg.content + chunk.content,
                  updatedAt: new Date().toISOString(),
                }
              : msg,
          ),
        );
      },
      onError: (chunk) => {
        setError(chunk.error.message);
        setStage('failed');
        setChatMessages((msgs) =>
          msgs.map((msg) =>
            msg.role === 'assistant' && msg.id === assistantId
              ? {
                  ...msg,
                  status: 'failed',
                  error: chunk.error.message,
                  updatedAt: new Date().toISOString(),
                }
              : msg,
          ),
        );
        currentAssistantIdRef.current = null;
      },
    });
    try {
      const runningTask = await runConfirmedTask({ taskId });
      setCurrentTask(runningTask);
      if (runningTask.state === 'cancelled') {
        setStage('cancelled');
        setChatMessages((msgs) =>
          msgs.map((msg) =>
            msg.role === 'assistant' && msg.id === assistantId
              ? { ...msg, status: 'cancelled', updatedAt: new Date().toISOString() }
              : msg,
          ),
        );
        currentAssistantIdRef.current = null;
        // Phase 5-5-C-POST-SYNC-AI-RESEARCH-SEND-FLOW-FIX:
        // Reset for next round of conversation.
        setCurrentTask(null);
        return;
      }
      const result = await getTaskResult(runningTask.taskId);
      setCurrentArtifact(result.artifact ?? null);
      setSavedArtifactPath(result.artifact?.savedRelativePath ?? null);
      setWarnings([...result.warnings, ...(result.artifact?.warnings ?? [])]);
      setStage(result.state === 'failed' ? 'failed' : 'completed');
      setCurrentTask({ ...runningTask, state: result.state });
      // Mark assistant message as completed with evidence refs
      setChatMessages((msgs) =>
        msgs.map((msg) =>
          msg.role === 'assistant' && msg.id === assistantId
            ? {
                ...msg,
                status: result.state === 'failed' ? ('failed' as const) : ('completed' as const),
                artifactDraftId: result.artifact?.artifactId,
                evidenceRefs: result.artifact?.evidenceRefs ?? result.artifact?.evidence,
                updatedAt: new Date().toISOString(),
                error: result.state === 'failed' ? '任务执行失败。' : undefined,
              }
            : msg,
        ),
      );
      currentAssistantIdRef.current = null;
      // Reset for next round
      setCurrentTask(null);
      bumpStateRevision();
    } catch (err) {
      setError(err instanceof Error ? err.message : '运行草稿任务失败。');
      setStage('failed');
      setChatMessages((msgs) =>
        msgs.map((msg) =>
          msg.role === 'assistant' && msg.id === assistantId
            ? {
                ...msg,
                status: 'failed',
                error: err instanceof Error ? err.message : '运行草稿任务失败。',
                updatedAt: new Date().toISOString(),
              }
            : msg,
        ),
      );
      currentAssistantIdRef.current = null;
      // Reset for next round
      setCurrentTask(null);
    } finally {
      setLoading(false);
      runInFlightRef.current = false;
      unsubscribeTaskRef.current?.();
      unsubscribeTaskRef.current = null;
    }
  }, [currentTask, preflightResult.passed, instruction, isNoContext, contextPackPreview, selectedProvider, model]);

  // Phase 5-5-C-POST-SYNC-AI-RESEARCH-SEND-DISABLED-FIX:
  // Keep a ref to the latest runTask so setTimeout callbacks don't capture stale closures.
  const runTaskRef = useRef(runTask);
  runTaskRef.current = runTask;

  const cancelCurrentTask = useCallback(async () => {
    if (!currentTask) return;
    setLoading(true);
    const assistantId = currentAssistantIdRef.current;
    try {
      const cancelledTask = await cancelTask({ taskId: currentTask.taskId });
      setCurrentTask(cancelledTask);
      setStage('cancelled');
      if (assistantId) {
        setChatMessages((msgs) =>
          msgs.map((msg) =>
            msg.role === 'assistant' && msg.id === assistantId
              ? { ...msg, status: 'cancelled', updatedAt: new Date().toISOString() }
              : msg,
          ),
        );
      }
      unsubscribeTaskRef.current?.();
      unsubscribeTaskRef.current = null;
      currentAssistantIdRef.current = null;
      // Reset for next round
      setCurrentTask(null);
      bumpStateRevision();
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消任务失败。');
    } finally {
      setLoading(false);
    }
  }, [currentTask]);

  const saveCurrentArtifact = useCallback(
    async (targetRelativePath: string, overwriteConfirmed: boolean) => {
      if (!vaultId || !currentArtifact) return null;
      setLoading(true);
      setError(null);
      try {
        const result = await saveArtifactDraft({
          vaultId,
          artifactId: currentArtifact.artifactId,
          targetRelativePath,
          overwriteConfirmed,
        });
        setCurrentArtifact(result.artifact);
        setSavedArtifactPath(result.relativePath);
        bumpStateRevision();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存草稿失败。');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [currentArtifact, vaultId],
  );

  const discardCurrentArtifact = useCallback(async () => {
    if (!currentArtifact) return;
    setLoading(true);
    setError(null);
    try {
      await discardArtifact(currentArtifact.artifactId);
      setCurrentArtifact(null);
      setSavedArtifactPath(null);
      bumpStateRevision();
    } catch (err) {
      setError(err instanceof Error ? err.message : '丢弃草稿失败。');
    } finally {
      setLoading(false);
    }
  }, [currentArtifact]);

  // Phase 5-5-C-POST-SYNC-AI-RESEARCH-SEND-FLOW-FIX:
  // Single "send" action. Returns a defer reason if a gate blocks (caller shows modal),
  // or null if the send proceeded. When a gate is hit, pendingSendRef is set so
  // continuePendingSend() can resume after the modal confirms.
  const sendMessage = useCallback(
    async (skillPromptTemplate?: string): Promise<'context' | 'privacy' | null> => {
      if (!selectedProvider) {
        setError('请先在设置中配置模型供应商并选择模型。');
        return null;
      }
      if (instruction.trim().length === 0) {
        return null;
      }
      if (loading || stage === 'running' || stage === 'streaming') return null;

      // If context mode but no ContextPack, build it first
      const hasSources = selectedSources.length > 0;
      if (hasSources && !contextPackPreview) {
        const ok = await buildPack();
        if (!ok) return null;
      }

      // If context mode but not confirmed, defer to confirmation modal
      if (hasSources && !contextConfirmed) {
        pendingSendRef.current = { skillPromptTemplate };
        return 'context';
      }

      // If privacy not consented, defer to privacy modal
      if (!privacyConsented) {
        pendingSendRef.current = { skillPromptTemplate };
        return 'privacy';
      }

      // All gates passed: create draft + auto-run
      await executePendingSend(skillPromptTemplate);
      return null;
    },
    [selectedProvider, instruction, loading, stage, selectedSources, contextPackPreview, contextConfirmed, privacyConsented, buildPack],
  );

  // Internal: execute the pending send after all gates are passed.
  const executePendingSend = useCallback(
    async (skillPromptTemplate?: string) => {
      if (instruction.trim().length === 0 || !selectedProvider) return;

      // Create task draft internally (not exposed to user as separate step)
      const isNoCtx = selectedSources.length === 0;
      const hasCtx = !isNoCtx && contextPackPreview !== null;
      const packId = hasCtx ? contextPackPreview!.packId : '';

      setLoading(true);
      setError(null);
      setStage('drafting');
      try {
        const task = await createTaskDraft({
          taskType,
          contextPackId: packId,
          instruction: instruction.trim(),
          providerId: selectedProvider.providerId,
          model,
          skillPromptTemplate,
        });
        setCurrentTask(task);
        setCurrentArtifact(null);
        setSavedArtifactPath(null);
        setStreamingResponse('');
        setStage('draft_created');
        bumpStateRevision();
        pendingSendRef.current = null;
        // Chain to auto-run: pass the fresh task directly to avoid stale closure.
        // runTask will manage its own loading state.
        setTimeout(() => {
          void runTaskRef.current(task);
        }, 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : '创建任务失败。');
        setStage('failed');
        pendingSendRef.current = null;
      } finally {
        setLoading(false);
      }
    },
    [taskType, instruction, selectedProvider, model, contextPackPreview, selectedSources],
  );

  // Phase 5-5-C-POST-SYNC-AI-RESEARCH-SEND-FLOW-FIX:
  // After a task is completed/cancelled/failed, reset currentTask to enable next send.
  // This is handled in the runTask callback itself.

  // Continue pending send after privacy consent is granted or context confirmed.
  const continuePendingSend = useCallback(() => {
    const pending = pendingSendRef.current;
    pendingSendRef.current = null;
    if (!pending) return;
    void executePendingSend(pending.skillPromptTemplate);
  }, [executePendingSend]);

  useEffect(
    () => () => {
      unsubscribeTaskRef.current?.();
      unsubscribeTaskRef.current = null;
    },
    [],
  );

  return {
    availableSources,
    selectedSources,
    selectedProvider,
    providerReadiness,
    taskType,
    instruction,
    contextPackPreview,
    currentTask,
    currentArtifact,
    streamingResponse,
    savedArtifactPath,
    warnings,
    preflightResult,
    contextConfirmed,
    privacyConsented,
    stage,
    taskState,
    loading,
    error,
    stateRevision,
    model,
    chatMessages,
    setTaskType,
    setInstruction,
    changeProvider,
    setSelectedModel: changeModel,
    setContextConfirmed,
    setPrivacyConsented,
    toggleSource,
    buildPack,
    createDraft,
    sendMessage,
    continuePendingSend,
    runTask,
    cancelCurrentTask,
    saveCurrentArtifact,
    discardCurrentArtifact,
  };
}
