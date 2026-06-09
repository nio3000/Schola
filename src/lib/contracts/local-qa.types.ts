/**
 * Local Knowledge QA Contract — Phase 4-2-D.
 *
 * Defines the types for local-only knowledge QA:
 * - QueryRequest, QueryScope, QueryResult, QueryAnswerDraft
 * - SourceRef, EvidenceRef (citation contracts)
 *
 * This is the LOCAL-ONLY / MOCK-ONLY minimal closed loop.
 * No real LLM calls. No real embedding calls. No external DB.
 *
 * All invariants:
 * - SourceRef relativePath-only
 * - EvidenceRef excerpt length limited
 * - No fake references
 * - No external database claims
 * - Artifact / Draft-first output
 *
 * BYOK only. Query answers are draft skeletons until Phase 4-2-E+.
 */

import type { VectorSearchResult } from './vector-index.types';

// ── Source Reference ───────────────────────────────────

/** A reference to a source file chunk that supports an answer. */
export interface SourceRef {
  /** Vault-relative path to the source file. NEVER absolute. */
  readonly relativePath: string;
  /** Chunk index within the source file (0-based). */
  readonly chunkIndex: number;
  /** Heading path leading to this chunk. */
  readonly headingPath: readonly string[];
  /** Similarity score of this source to the query. */
  readonly score: number;
}

// ── Evidence Reference ─────────────────────────────────

/** An excerpt from a source that supports a specific claim. */
export interface EvidenceRef {
  /** The source this evidence comes from. */
  readonly source: SourceRef;
  /** Excerpt text from the chunk (≤ MAX_EXCERPT_LENGTH chars). */
  readonly excerpt: string;
  /** Token count of the excerpt. */
  readonly excerptTokenCount: number;
}

/** Maximum length of an evidence excerpt in characters. */
export const MAX_EXCERPT_LENGTH = 200;

/**
 * Truncate an excerpt to the maximum allowed length.
 * Appends "…" if truncated.
 */
export function truncateExcerpt(text: string): string {
  if (text.length <= MAX_EXCERPT_LENGTH) return text;
  return text.slice(0, MAX_EXCERPT_LENGTH - 1) + '…';
}

// ── Query Types ────────────────────────────────────────

/** Scope filter for a query. */
export interface QueryScope {
  /** Optional relative path filter — only search within this file/folder. */
  readonly relativePath?: string;
  /** Maximum number of results to return. */
  readonly topK: number;
  /** Minimum relevance threshold for results. */
  readonly relevanceThreshold: number;
}

/** Default query scope. */
export const DEFAULT_QUERY_SCOPE: QueryScope = {
  topK: 5,
  relevanceThreshold: 0.5,
};

/** Input to a knowledge QA query. */
export interface QueryRequest {
  /** The user's natural language question. */
  readonly query: string;
  /** Optional scope filter. */
  readonly scope?: QueryScope;
}

// ── Answer Draft ───────────────────────────────────────

/** A skeleton answer with source evidence. */
export interface QueryAnswerDraft {
  /** The query that was asked. */
  readonly query: string;
  /** Whether there was sufficient evidence to draft an answer. */
  readonly hasSufficientEvidence: boolean;
  /** The answer text (empty if insufficient evidence). */
  readonly answer: string;
  /** Source references supporting the answer. */
  readonly sources: readonly SourceRef[];
  /** Evidence excerpts (≤ MAX_EXCERPT_LENGTH each). */
  readonly evidence: readonly EvidenceRef[];
  /** Number of sources retrieved. */
  readonly retrievedCount: number;
  /** Number of sources that met relevance threshold. */
  readonly relevantCount: number;
  /** Total token count of assembled context. */
  readonly contextTokens: number;
  /** Whether this is a mock/skeleton answer (not real LLM). */
  readonly isMockAnswer: boolean;
}

// ── Query Result ──────────────────────────────────────

/** Full result of a knowledge QA operation. */
export interface QueryResult {
  /** The answer draft. */
  readonly answer: QueryAnswerDraft;
  /** Raw search results (for diagnostics / preview). */
  readonly searchResults: readonly VectorSearchResult[];
  /** Elapsed time in milliseconds. */
  readonly elapsedMs: number;
}

// ── Validation ─────────────────────────────────────────

/**
 * Validate that a SourceRef uses relativePath (not absolute).
 */
export function validateSourceRef(ref: SourceRef): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!ref.relativePath) {
    issues.push('SourceRef relativePath is required');
  }
  if (ref.relativePath.includes(':\\')) {
    issues.push(`SourceRef absolute path detected: "${ref.relativePath}" (Windows)`);
  }
  if (ref.relativePath.includes('\\\\')) {
    issues.push(`SourceRef UNC path detected: "${ref.relativePath}"`);
  }
  if (ref.relativePath.startsWith('/')) {
    issues.push(`SourceRef Unix absolute path detected: "${ref.relativePath}"`);
  }
  if (ref.chunkIndex < 0) {
    issues.push('SourceRef chunkIndex must be non-negative');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Create an insufficient-evidence answer draft.
 */
export function createInsufficientEvidenceAnswer(query: string): QueryAnswerDraft {
  return {
    query,
    hasSufficientEvidence: false,
    answer: '',
    sources: [],
    evidence: [],
    retrievedCount: 0,
    relevantCount: 0,
    contextTokens: 0,
    isMockAnswer: true,
  };
}
