/**
 * VectorIndex Contract — Phase 4-2-D.
 *
 * Defines the in-memory vector index interface for local knowledge QA.
 * This is a MOCK implementation — no persistent storage, no external DB.
 *
 * All invariants:
 * - relativePath-only metadata
 * - No API Key / secret
 * - No network calls
 * - No Vault writes
 *
 * BYOK only. Full persistence deferred to Phase 4-2-E (Ingest).
 */

// ── Index Entry ────────────────────────────────────────

/** A single entry in the vector index. */
export interface VectorIndexEntry {
  /** Unique chunk identifier (from Phase 4-2-C Chunk contract). */
  readonly chunkId: string;
  /** Relative path of the source file. */
  readonly relativePath: string;
  /** Heading path leading to this chunk. */
  readonly headingPath: readonly string[];
  /** Token count of the chunk. */
  readonly tokenCount: number;
  /** The embedding vector (dimension depends on provider). */
  readonly vector: readonly number[];
  /** Vector dimensions. */
  readonly dimensions: number;
  /** Strategy used to produce this chunk. */
  readonly strategy: string;
}

// ── Search Result ─────────────────────────────────────

/** A single search result with similarity score. */
export interface VectorSearchResult {
  /** The matched entry. */
  readonly entry: VectorIndexEntry;
  /** Cosine similarity score (0..1). */
  readonly score: number;
}

// ── Score Metadata ────────────────────────────────────

/** Metadata about a similarity score. */
export interface SearchScore {
  /** Raw cosine similarity. */
  readonly value: number;
  /** Whether this result exceeds the relevance threshold. */
  readonly relevant: boolean;
}

/** Default relevance threshold for cosine similarity. */
export const DEFAULT_RELEVANCE_THRESHOLD = 0.5;

/**
 * Check if a similarity score meets the relevance threshold.
 */
export function isRelevantScore(score: number, threshold?: number): boolean {
  return score >= (threshold ?? DEFAULT_RELEVANCE_THRESHOLD);
}

// ── Vector Index Stats ─────────────────────────────────

/** Statistics about the vector index. */
export interface VectorIndexStats {
  /** Total number of entries in the index. */
  readonly totalEntries: number;
  /** Number of unique source files. */
  readonly uniqueFiles: number;
  /** Total token count of all entries. */
  readonly totalTokens: number;
  /** Vector dimensions. */
  readonly dimensions: number;
}

// ── VectorIndex Interface ─────────────────────────────

/** Abstract vector index — in-memory mock for Phase 4-2-D. */
export interface VectorIndex {
  /**
   * Add entries to the index.
   * Duplicate chunkIds are overwritten (reindex behavior).
   */
  add(entries: readonly VectorIndexEntry[]): Promise<void>;

  /**
   * Search for entries most similar to a query vector.
   * Returns topK results sorted by cosine similarity (descending).
   */
  search(queryVector: readonly number[], topK: number): Promise<VectorSearchResult[]>;

  /**
   * Delete all entries for a given source file (by relativePath).
   */
  delete(relativePath: string): Promise<number>;

  /**
   * Get current index statistics.
   */
  stats(): VectorIndexStats;

  /**
   * Clear all entries from the index.
   */
  clear(): Promise<void>;
}

// ── Cosine Similarity ─────────────────────────────────

/**
 * Compute cosine similarity between two vectors of the same dimension.
 * Returns a value in [0, 1] (negative values clamped to 0).
 * Returns 0 if vectors have different dimensions.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  const similarity = dotProduct / magnitude;
  return Math.max(0, similarity);
}
