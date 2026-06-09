/**
 * AI Research Workbench / 文献分析平台 — Phase 5-2-IMP-1.
 *
 * Contract types for the productized AI Research Workbench:
 *   - Context source selection and ContextPack building
 *   - Provider readiness + invocation preflight
 *   - Task lifecycle (create, run, cancel, get status/result)
 *   - Artifact-first draft output with evidence boundary
 *
 * Key invariants:
 *   - NO apiKey or secret in any renderer-exported type
 *   - ContextPackPreview does NOT contain full file content
 *   - AIInvocationMetadata does NOT contain raw prompt
 *   - AIInvocationError is always sanitized
 *   - EvidenceRef distinguishes source-backed vs model-inferred
 *   - ContextSourceRef does NOT expose system absolute paths
 *   - All IPC is fixed-function (no generic invoke)
 *   - NO provider invocation from renderer
 *   - NO automatic Vault writes
 *   - NO artifact auto-save
 */
import type { AIModelInfo } from './ai-provider.types';
import type { ProviderPreset } from './provider-preset.types';

// ═══════════════════════════════════════════════════════
// IPC Channel Constants (whitelist)
// ═══════════════════════════════════════════════════════

export const AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL = 'ai-research:get-provider-readiness';
export const AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL = 'ai-research:build-context-pack';
export const AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL = 'ai-research:preview-context-pack';
export const AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL = 'ai-research:create-task-draft';
export const AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL = 'ai-research:run-confirmed-task';
export const AI_RESEARCH_CANCEL_TASK_CHANNEL = 'ai-research:cancel-task';
export const AI_RESEARCH_GET_TASK_STATUS_CHANNEL = 'ai-research:get-task-status';
export const AI_RESEARCH_GET_TASK_RESULT_CHANNEL = 'ai-research:get-task-result';
export const AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL = 'ai-research:clear-task-result';
export const AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL = 'ai-research:discard-artifact';

// ═══════════════════════════════════════════════════════
// AI Research Task Types
// ═══════════════════════════════════════════════════════

export type AIResearchTaskType =
  | 'analysis_summary'
  | 'paper_matrix'
  | 'reading_note_draft'
  | 'evidence_table'
  | 'terminology_list'
  | 'research_question_breakdown'
  | 'general_research_note';

/** Human-readable labels for task types. */
export const AI_RESEARCH_TASK_LABELS: Record<AIResearchTaskType, string> = {
  analysis_summary: '文献分析摘要',
  paper_matrix: '文献矩阵',
  reading_note_draft: '阅读笔记草稿',
  evidence_table: '证据表',
  terminology_list: '术语表',
  research_question_breakdown: '研究问题拆解',
  general_research_note: '通用研究笔记',
};

// ═══════════════════════════════════════════════════════
// Context Sources
// ═══════════════════════════════════════════════════════

/** Reference to a selected context source file. No system absolute path. */
export interface ContextSourceRef {
  /** Relative path from Vault root. */
  readonly relativePath: string;
  /** Display name (filename or title). */
  readonly displayName: string;
  /** Source type. */
  readonly sourceType: 'markdown' | 'pdf' | 'note';
  /** File size in bytes (for token estimation). */
  readonly fileSize: number;
}

/** A user-selected research context source. */
export interface ResearchContextSource {
  /** Unique source reference. */
  readonly ref: ContextSourceRef;
  /** Whether the user has explicitly selected this source. */
  readonly selected: boolean;
  /** For PDF sources: page range metadata (optional). */
  readonly pdfMetadata?: {
    readonly pageCount: number;
    readonly selectedPages?: readonly number[];
  };
}

// ═══════════════════════════════════════════════════════
// ContextPack
// ═══════════════════════════════════════════════════════

/** Token estimate for the context pack. */
export interface ContextTokenEstimate {
  /** Estimated tokens from all selected files. */
  readonly fileTokens: number;
  /** Estimated tokens from the system prompt / instruction template. */
  readonly systemTokens: number;
  /** Total estimated tokens. */
  readonly totalTokens: number;
  /** Token budget limit. */
  readonly budget: number;
  /** Whether the total exceeds the budget. */
  readonly exceedsBudget: boolean;
}

/** A file entry within the ContextPack, with truncation metadata. */
export interface ContextPackFileEntry {
  /** Relative path from Vault root. */
  readonly relativePath: string;
  /** Display name. */
  readonly displayName: string;
  /** Source type. */
  readonly sourceType: 'markdown' | 'pdf' | 'note';
  /** Estimated token count. */
  readonly tokenCount: number;
  /** Whether this file was truncated to fit token budget. */
  readonly truncated: boolean;
  /** For PDF sources: page metadata. */
  readonly pdfPageRange?: string;
  /** For Markdown sources: heading/block metadata. */
  readonly markdownHeadings?: readonly string[];
}

/** Full ContextPack — built in main process, renderer-safe summary only. */
export interface ResearchContextPack {
  /** ContextPack unique ID. */
  readonly id: string;
  /** Selected file entries. */
  readonly files: readonly ContextPackFileEntry[];
  /** Token estimate. */
  readonly tokenEstimate: ContextTokenEstimate;
  /** Target provider ID. */
  readonly providerId: string;
  /** Target model name. */
  readonly model: string;
  /** Number of truncated files. */
  readonly truncatedFileCount: number;
  /** Whether the pack contains only user-explicitly selected files. */
  readonly userSelectedOnly: boolean;
}

/** Renderer-safe preview — no full file content, no secrets. */
export interface ResearchContextPreview {
  readonly packId: string;
  readonly fileCount: number;
  readonly selectedSourceRefs: readonly ContextSourceRef[];
  readonly tokenEstimate: ContextTokenEstimate;
  readonly providerId: string;
  readonly model: string;
  readonly truncatedFileCount: number;
  /** Warning if any truncation occurred. */
  readonly warnings: readonly string[];
}

// ═══════════════════════════════════════════════════════
// Provider Readiness
// ═══════════════════════════════════════════════════════

export interface ProviderReadiness {
  /** Provider ID. */
  readonly providerId: string;
  /** Provider preset info. */
  readonly preset: ProviderPreset;
  /** Whether the provider is enabled. */
  readonly enabled: boolean;
  /** Whether an API Key has been configured. */
  readonly keyConfigured: boolean;
  /** For local-free providers, whether local model is available. */
  readonly localFreeReady: boolean;
  /** Available models. */
  readonly models: readonly AIModelInfo[];
  /** Readiness status. */
  readonly ready: boolean;
  /** If not ready, reason. */
  readonly blockedReason?: string;
}

// ═══════════════════════════════════════════════════════
// Invocation Preflight
// ═══════════════════════════════════════════════════════

export type InvocationBlockedReason =
  | 'provider_disabled'
  | 'no_api_key'
  | 'local_free_not_available'
  | 'privacy_consent_required'
  | 'context_send_policy_denied'
  | 'context_pack_not_ready'
  | 'context_not_confirmed'
  | 'user_not_explicitly_run';

export interface InvocationPreflightResult {
  /** Whether all gates passed. */
  readonly passed: boolean;
  /** If blocked, the reason. */
  readonly blockedReason?: InvocationBlockedReason;
  /** Human-readable blocked message. */
  readonly blockedMessage?: string;
  /** Provider readiness status. */
  readonly providerReady: boolean;
  /** Privacy consent accepted. */
  readonly privacyConsented: boolean;
  /** Context confirmed. */
  readonly contextConfirmed: boolean;
  /** Whether user explicitly initiated run. */
  readonly userExplicitRun: boolean;
}

export interface ProviderInvocationPolicy {
  /** Must pass preflight before invocation. */
  readonly preflightRequired: true;
  /** Only main process performs invocation. */
  readonly mainProcessOnly: true;
  /** User must explicitly click Run. */
  readonly explicitRunRequired: true;
  /** No background/automatic provider calls. */
  readonly noBackgroundCalls: true;
}

// ═══════════════════════════════════════════════════════
// Context Confirmation Snapshot
// ═══════════════════════════════════════════════════════

export interface ContextConfirmationSnapshot {
  readonly confirmed: boolean;
  readonly confirmedAt?: string;
  readonly providerId: string;
  readonly model: string;
  readonly fileCount: number;
  readonly totalTokens: number;
  readonly vaultId: string | null;
}

// ═══════════════════════════════════════════════════════
// AI Research Task
// ═══════════════════════════════════════════════════════

export type AIResearchTaskState =
  | 'idle'
  | 'drafting'
  | 'ready'
  | 'running'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AIResearchTaskRequest {
  /** Task type. */
  readonly taskType: AIResearchTaskType;
  /** ContextPack ID. */
  readonly contextPackId: string;
  /** User instruction text (renderer-safe, no secrets). */
  readonly instruction: string;
  /** Target provider ID. */
  readonly providerId: string;
  /** Target model. */
  readonly model: string;
  /** Optional pre-configured instruction template. */
  readonly templateId?: string;
}

export interface AIResearchTaskStatus {
  readonly taskId: string;
  readonly taskType: AIResearchTaskType;
  readonly state: AIResearchTaskState;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly providerId: string;
  readonly model: string;
  /** If failed or cancelled, human-readable reason (sanitized). */
  readonly message?: string;
}

export interface AIArtifactDraft {
  readonly artifactId: string;
  readonly taskId: string;
  readonly taskType: AIResearchTaskType;
  readonly title: string;
  /** The draft content (Markdown). */
  readonly content: string;
  /** Evidence references. */
  readonly evidence: readonly EvidenceRef[];
  /** Warnings (e.g., truncation, low confidence). */
  readonly warnings: readonly AIResearchWarning[];
  /** Whether this is a draft (always true in Phase 5-2). */
  readonly isDraft: true;
  /** Review required banner. */
  readonly reviewRequired: true;
  /** Created timestamp. */
  readonly createdAt: string;
}

export interface AIResearchTaskResult {
  readonly taskId: string;
  readonly taskType: AIResearchTaskType;
  readonly state: AIResearchTaskState;
  /** Artifact draft (in-memory only). */
  readonly artifact?: AIArtifactDraft;
  /** Invocation metadata (no raw prompt). */
  readonly metadata: AIInvocationMetadata;
  /** Warnings. */
  readonly warnings: readonly AIResearchWarning[];
}

// ═══════════════════════════════════════════════════════
// Evidence
// ═══════════════════════════════════════════════════════

export type EvidenceKind = 'source-backed' | 'model-inferred';

export interface EvidenceRef {
  readonly id: string;
  readonly kind: EvidenceKind;
  /** Human-readable label. */
  readonly label: string;
  /** For source-backed: reference to source file metadata. */
  readonly sourceRef?: {
    readonly relativePath: string;
    readonly displayName: string;
    /** For PDF: page/section metadata. */
    readonly pdfPage?: number;
    readonly pdfRegion?: string;
    /** For Markdown: heading/block metadata. */
    readonly markdownHeading?: string;
    readonly markdownLine?: number;
  };
  /** For model-inferred: explicit disclaimer that this is NOT source evidence. */
  readonly modelInferredNote?: string;
}

// ═══════════════════════════════════════════════════════
// Invocation Metadata (no raw prompt, no secrets)
// ═══════════════════════════════════════════════════════

export interface AIInvocationMetadata {
  readonly taskId: string;
  readonly providerId: string;
  readonly model: string;
  readonly taskType: AIResearchTaskType;
  /** Number of context files used. */
  readonly contextFileCount: number;
  /** Total tokens consumed (approximate). */
  readonly approximateTokens: number;
  /** Duration in ms. */
  readonly durationMs: number;
  /** Whether streaming was used. */
  readonly streaming: boolean;
  /** Sanitized error if invocation failed. */
  readonly sanitizedError?: string;
}

// ═══════════════════════════════════════════════════════
// Invocation Error (always sanitized)
// ═══════════════════════════════════════════════════════

export interface AIInvocationError {
  readonly code: string;
  readonly message: string /* sanitized — no raw prompt, no API key, no file content */;
  readonly details?: string;
  readonly retryable: boolean;
}

// ═══════════════════════════════════════════════════════
// AI Research Warning
// ═══════════════════════════════════════════════════════

export interface AIResearchWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: 'low' | 'medium' | 'high';
  /** Which file(s) this warning relates to. */
  readonly relatedFiles?: readonly string[];
}

// ═══════════════════════════════════════════════════════
// Workbench State
// ═══════════════════════════════════════════════════════

export interface AIResearchWorkbenchState {
  /** Current task status, or null if no task. */
  readonly currentTask: AIResearchTaskStatus | null;
  /** Current artifact draft preview, or null. */
  readonly currentArtifact: AIArtifactDraft | null;
  /** Selected context sources. */
  readonly selectedSources: readonly ContextSourceRef[];
  /** Provider readiness for configured providers. */
  readonly providerReadiness: readonly ProviderReadiness[];
  /** Current ContextPack preview, or null. */
  readonly contextPackPreview: ResearchContextPreview | null;
  /** Preflight result. */
  readonly preflightResult: InvocationPreflightResult | null;
  /** Warnings. */
  readonly warnings: readonly AIResearchWarning[];
  /** Whether a task is currently running. */
  readonly isRunning: boolean;
}

// ═══════════════════════════════════════════════════════
// IPC Input / Output Types
// ═══════════════════════════════════════════════════════

/** Input: build a ContextPack from selected sources. */
export interface BuildContextPackInput {
  readonly vaultId: string;
  readonly selectedSources: readonly ContextSourceRef[];
  readonly providerId: string;
  readonly model: string;
  readonly tokenBudget?: number;
}

/** Input: create a task draft. */
export interface CreateTaskDraftInput {
  readonly taskType: AIResearchTaskType;
  readonly contextPackId: string;
  readonly instruction: string;
  readonly providerId: string;
  readonly model: string;
}

/** Input: run a confirmed task. */
export interface RunConfirmedTaskInput {
  readonly taskId: string;
}

/** Input: cancel a running task. */
export interface CancelTaskInput {
  readonly taskId: string;
}

// ═══════════════════════════════════════════════════════
// Renderer API (fixed-function, no generic invoke)
// ═══════════════════════════════════════════════════════

export interface ScholaAIResearchApi {
  readonly getProviderReadiness: (providerId?: string) => Promise<readonly ProviderReadiness[]>;
  readonly buildContextPack: (input: BuildContextPackInput) => Promise<ResearchContextPreview>;
  readonly previewContextPack: (contextPackId: string) => Promise<ResearchContextPreview>;
  readonly createTaskDraft: (input: CreateTaskDraftInput) => Promise<AIResearchTaskStatus>;
  readonly runConfirmedTask: (input: RunConfirmedTaskInput) => Promise<AIResearchTaskStatus>;
  readonly cancelTask: (input: CancelTaskInput) => Promise<AIResearchTaskStatus>;
  readonly getTaskStatus: (taskId: string) => Promise<AIResearchTaskStatus>;
  readonly getTaskResult: (taskId: string) => Promise<AIResearchTaskResult>;
  readonly clearTaskResult: (taskId: string) => Promise<void>;
  readonly discardArtifact: (artifactId: string) => Promise<void>;
}
