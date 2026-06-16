import type {
  AIResearchTaskResult,
  AIResearchTaskStatus,
  BuildContextPackInput,
  CancelTaskInput,
  ChatChunk,
  ConfirmContextPackInput,
  ContextConfirmationSnapshot,
  CreateTaskDraftInput,
  ProviderReadiness,
  ResearchContextPreview,
  RunConfirmedTaskInput,
  SaveArtifactDraftInput,
  SaveArtifactDraftResult,
  SubscribeTaskCallbacks,
} from '../contracts/ai-research.types';

function getAIResearchApi() {
  if (typeof window.schola?.aiResearch === 'undefined') {
    throw new Error('[ai-research-api] window.schola.aiResearch 不可用。');
  }
  return window.schola.aiResearch;
}

export async function getProviderReadiness(
  providerId?: string,
): Promise<readonly ProviderReadiness[]> {
  try {
    return getAIResearchApi().getProviderReadiness(providerId);
  } catch {
    return [];
  }
}

export async function buildContextPack(
  input: BuildContextPackInput,
): Promise<ResearchContextPreview> {
  return getAIResearchApi().buildContextPack(input);
}

export async function previewContextPack(contextPackId: string): Promise<ResearchContextPreview> {
  return getAIResearchApi().previewContextPack(contextPackId);
}

export async function confirmContextPack(
  input: ConfirmContextPackInput,
): Promise<ContextConfirmationSnapshot> {
  return getAIResearchApi().confirmContextPack(input);
}

export async function createTaskDraft(input: CreateTaskDraftInput): Promise<AIResearchTaskStatus> {
  return getAIResearchApi().createTaskDraft(input);
}

export async function runConfirmedTask(
  input: RunConfirmedTaskInput,
): Promise<AIResearchTaskStatus> {
  return getAIResearchApi().runConfirmedTask(input);
}

export async function cancelTask(input: CancelTaskInput): Promise<AIResearchTaskStatus> {
  return getAIResearchApi().cancelTask(input);
}

export async function getTaskStatus(taskId: string): Promise<AIResearchTaskStatus> {
  return getAIResearchApi().getTaskStatus(taskId);
}

export async function getTaskResult(taskId: string): Promise<AIResearchTaskResult> {
  return getAIResearchApi().getTaskResult(taskId);
}

export async function clearTaskResult(taskId: string): Promise<void> {
  return getAIResearchApi().clearTaskResult(taskId);
}

export async function discardArtifact(artifactId: string): Promise<void> {
  return getAIResearchApi().discardArtifact(artifactId);
}

export async function saveArtifactDraft(
  input: SaveArtifactDraftInput,
): Promise<SaveArtifactDraftResult> {
  return getAIResearchApi().saveArtifactDraft(input);
}

export function subscribeTask(taskId: string, callbacks: SubscribeTaskCallbacks): () => void {
  return getAIResearchApi().subscribeTask(taskId, callbacks);
}

export type { ChatChunk, SubscribeTaskCallbacks };
