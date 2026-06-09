/**
 * Workflow Contracts — Phase 4-2-E.
 *
 * Shared types for Ingest, Query, and Lint workflows.
 * Builds on frozen ContextPack v2, Chunking, MockEmbeddingProvider,
 * InMemoryVectorIndex, and LocalKnowledgeQAService.
 *
 * All invariants:
 * - Explicit user selection required (no whole Vault)
 * - Context Confirmation required before cloud calls
 * - relativePath-only throughout
 * - No API Key / secret
 * - No real provider/embedding calls (mock-only)
 * - Lint is report-only (no file modification)
 */

// ── Workflow Status ───────────────────────────────────

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowError {
  readonly code: string;
  readonly message: string;
  readonly filePath?: string;
}

export interface WorkflowWarning {
  readonly code: string;
  readonly message: string;
  readonly filePath?: string;
}

// ── Index Manifest ────────────────────────────────────

export interface IndexedChunkRecord {
  readonly chunkId: string;
  readonly chunkIndex: number;
  readonly headingPath: readonly string[];
  readonly tokenCount: number;
}

export interface IndexedFileRecord {
  readonly relativePath: string;
  readonly indexedAt: string;
  readonly chunkCount: number;
  readonly totalTokens: number;
  readonly chunks: readonly IndexedChunkRecord[];
}

export interface IndexManifest {
  readonly vaultId: string;
  readonly updatedAt: string;
  readonly totalFiles: number;
  readonly totalChunks: number;
  readonly totalTokens: number;
  readonly files: readonly IndexedFileRecord[];
}

// ── Ingest Workflow ───────────────────────────────────

export interface IngestRequest {
  readonly scope: {
    readonly type: string;
    readonly selectedFiles: readonly { relativePath: string; displayName: string }[];
    readonly selectedFolder?: { relativePath: string; displayName: string };
  };
  readonly confirmContext: boolean;
}

export interface IngestResult {
  readonly status: WorkflowStatus;
  readonly indexedFiles: number;
  readonly totalChunks: number;
  readonly totalTokens: number;
  readonly errors: readonly WorkflowError[];
  readonly warnings: readonly WorkflowWarning[];
  readonly manifest: IndexManifest | null;
  readonly elapsedMs: number;
}

// ── Query Workflow ────────────────────────────────────

export interface QueryWorkflowRequest {
  readonly query: string;
  readonly scope?: {
    readonly relativePath?: string;
    readonly topK: number;
  };
  readonly confirmContext: boolean;
}

export interface QueryWorkflowResult {
  readonly status: WorkflowStatus;
  readonly hasSufficientEvidence: boolean;
  readonly answer: string;
  readonly sources: readonly {
    relativePath: string;
    chunkIndex: number;
    headingPath: readonly string[];
    score: number;
  }[];
  readonly retrievedCount: number;
  readonly relevantCount: number;
  readonly errors: readonly WorkflowError[];
  readonly warnings: readonly WorkflowWarning[];
  readonly elapsedMs: number;
  readonly isMockAnswer: boolean;
}

// ── Lint Workflow ─────────────────────────────────────

export type LintRule = 'broken_links' | 'missing_metadata' | 'duplicate_notes' | 'orphan_notes' | 'stale_compiled';

export interface LintRequest {
  readonly rules: readonly LintRule[];
  readonly scope?: {
    readonly selectedFiles?: readonly { relativePath: string; displayName: string }[];
    readonly selectedFolder?: { relativePath: string; displayName: string };
  };
}

export interface LintFinding {
  readonly rule: LintRule;
  readonly severity: 'error' | 'warning' | 'info';
  readonly relativePath: string;
  readonly message: string;
  readonly line?: number;
  readonly suggestion?: string;
}

export interface LintResult {
  readonly status: WorkflowStatus;
  readonly totalFiles: number;
  readonly totalFindings: number;
  readonly findings: readonly LintFinding[];
  readonly errors: readonly WorkflowError[];
  readonly warnings: readonly WorkflowWarning[];
  readonly elapsedMs: number;
}

// ── Validation ─────────────────────────────────────────

export const ALL_LINT_RULES: readonly LintRule[] = [
  'broken_links',
  'missing_metadata',
  'duplicate_notes',
  'orphan_notes',
  'stale_compiled',
];

export function isValidLintRule(value: string): value is LintRule {
  return (ALL_LINT_RULES as readonly string[]).includes(value);
}

export function isWorkflowStatus(value: string): value is WorkflowStatus {
  return ['pending', 'running', 'completed', 'failed', 'cancelled'].includes(value);
}
