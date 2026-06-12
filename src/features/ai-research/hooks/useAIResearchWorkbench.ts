import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
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
  getProviderReadiness,
  getTaskResult,
  runConfirmedTask,
} from '../../../lib/platform/ai-research-api';

export type AIResearchWorkbenchStage =
  | 'idle'
  | 'sources_selected'
  | 'pack_built'
  | 'drafting'
  | 'draft_created'
  | 'running'
  | 'completed'
  | 'failed';

export interface UseAIResearchWorkbenchInput {
  readonly vaultId: string | null;
  readonly fileTree: readonly FileEntry[];
}

function toSourceType(relativePath: string): ContextSourceRef['sourceType'] | null {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
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
  const [warnings, setWarnings] = useState<readonly AIResearchWarning[]>([]);
  const [contextConfirmed, setContextConfirmed] = useState(false);
  const [privacyConsented, setPrivacyConsented] = useState(false);
  const [stage, setStage] = useState<AIResearchWorkbenchStage>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stateRevision, bumpStateRevision] = useReducer((value: number) => value + 1, 0);

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

  const changeProvider = useCallback(
    (providerId: string) => {
      const provider = providerReadiness.find((item) => item.providerId === providerId);
      setSelectedProviderId(providerId);
      setSelectedModel(provider?.models[0]?.id ?? null);
      setContextPackPreview(null);
      setContextConfirmed(false);
    },
    [providerReadiness],
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
      setStage(next.length > 0 ? 'sources_selected' : 'idle');
      bumpStateRevision();
      return next;
    });
  }, []);

  const buildPack = useCallback(async () => {
    if (!vaultId || selectedSources.length === 0 || !selectedProvider) return;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '构建上下文包失败。');
      setStage('failed');
    } finally {
      setLoading(false);
    }
  }, [model, selectedProvider, selectedSources, vaultId]);

  const createDraft = useCallback(async () => {
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
      });
      setCurrentTask(task);
      setStage('draft_created');
      bumpStateRevision();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建草稿任务失败。');
      setStage('failed');
    } finally {
      setLoading(false);
    }
  }, [contextPackPreview, instruction, model, selectedProvider, taskType]);

  const runTask = useCallback(async () => {
    if (!currentTask || !preflightResult.passed) return;
    setLoading(true);
    setError(null);
    setStage('running');
    try {
      const runningTask = await runConfirmedTask({ taskId: currentTask.taskId });
      setCurrentTask(runningTask);
      const result = await getTaskResult(runningTask.taskId);
      setCurrentArtifact(result.artifact ?? null);
      setWarnings([...result.warnings, ...(result.artifact?.warnings ?? [])]);
      setStage(result.state === 'failed' ? 'failed' : 'completed');
      setCurrentTask({ ...runningTask, state: result.state });
      bumpStateRevision();
    } catch (err) {
      setError(err instanceof Error ? err.message : '运行草稿任务失败。');
      setStage('failed');
    } finally {
      setLoading(false);
    }
  }, [currentTask, preflightResult.passed]);

  const cancelCurrentTask = useCallback(async () => {
    if (!currentTask) return;
    setLoading(true);
    try {
      const cancelledTask = await cancelTask({ taskId: currentTask.taskId });
      setCurrentTask(cancelledTask);
      setStage('failed');
      bumpStateRevision();
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消任务失败。');
    } finally {
      setLoading(false);
    }
  }, [currentTask]);

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
    setSelectedModel,
    setContextConfirmed,
    setPrivacyConsented,
    toggleSource,
    buildPack,
    createDraft,
    runTask,
    cancelCurrentTask,
  };
}
