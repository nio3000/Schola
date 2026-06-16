import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type {
  AIArtifactDraft,
  AIResearchTaskState,
  AIResearchTaskStatus,
  AIResearchTaskType,
  AIResearchWarning,
  ContextSourceRef,
  InvocationPreflightResult,
  ProviderReadiness,
  ResearchContextPreview,
} from '../../../lib/contracts/ai-research.types';
import type { FileEntry } from '../../../lib/contracts/vault.types';
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
    contextConfirmed: true,
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

  useEffect(() => {
    let cancelled = false;
    void getProviderReadiness().then((readiness) => {
      if (cancelled) return;
      setProviderReadiness(readiness);
      const readyProvider = readiness.find((provider) => provider.ready) ?? readiness[0] ?? null;
      if (readyProvider) {
        setSelectedProviderId((current) => current ?? readyProvider.providerId);
        setSelectedModel((current) => current ?? readyProvider.models[0]?.id ?? null);
      }
    });
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

  const preflightResult = useMemo(
    () =>
      createPreflightResult({
        provider: selectedProvider,
        contextPackPreview,
        contextConfirmed,
        privacyConsented,
      }),
    [contextConfirmed, contextPackPreview, privacyConsented, selectedProvider],
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
      if (!contextPackPreview || !selectedProvider || instruction.trim().length === 0) return;
      setLoading(true);
      setError(null);
      setStage('drafting');
      try {
        const task = await createTaskDraft({
          taskType,
          contextPackId: contextPackPreview.packId,
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
    [contextPackPreview, instruction, model, selectedProvider, taskType],
  );

  const runTask = useCallback(async () => {
    if (!currentTask || !preflightResult.passed || runInFlightRef.current) return;
    if (currentTask.state === 'running' || currentTask.state === 'streaming') return;
    runInFlightRef.current = true;
    setLoading(true);
    setError(null);
    setStage('running');
    setStreamingResponse('');
    unsubscribeTaskRef.current?.();
    unsubscribeTaskRef.current = subscribeTask(currentTask.taskId, {
      onChunk: (chunk) => {
        setCurrentTask((task) =>
          task && task.taskId === chunk.taskId ? { ...task, state: 'streaming' } : task,
        );
        setStage('streaming');
        setStreamingResponse((current) => `${current}${chunk.content}`);
      },
      onError: (chunk) => {
        setError(chunk.error.message);
        setStage('failed');
      },
    });
    try {
      const runningTask = await runConfirmedTask({ taskId: currentTask.taskId });
      setCurrentTask(runningTask);
      if (runningTask.state === 'cancelled') {
        setStage('cancelled');
        return;
      }
      const result = await getTaskResult(runningTask.taskId);
      setCurrentArtifact(result.artifact ?? null);
      setSavedArtifactPath(result.artifact?.savedRelativePath ?? null);
      setWarnings([...result.warnings, ...(result.artifact?.warnings ?? [])]);
      setStage(result.state === 'failed' ? 'failed' : 'completed');
      setCurrentTask({ ...runningTask, state: result.state });
      bumpStateRevision();
    } catch (err) {
      setError(err instanceof Error ? err.message : '运行草稿任务失败。');
      setStage('failed');
    } finally {
      setLoading(false);
      runInFlightRef.current = false;
      unsubscribeTaskRef.current?.();
      unsubscribeTaskRef.current = null;
    }
  }, [currentTask, preflightResult.passed]);

  const cancelCurrentTask = useCallback(async () => {
    if (!currentTask) return;
    setLoading(true);
    try {
      const cancelledTask = await cancelTask({ taskId: currentTask.taskId });
      setCurrentTask(cancelledTask);
      setStage('cancelled');
      unsubscribeTaskRef.current?.();
      unsubscribeTaskRef.current = null;
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
    setTaskType,
    setInstruction,
    changeProvider,
    setSelectedModel: changeModel,
    setContextConfirmed,
    setPrivacyConsented,
    toggleSource,
    buildPack,
    createDraft,
    runTask,
    cancelCurrentTask,
    saveCurrentArtifact,
    discardCurrentArtifact,
  };
}
