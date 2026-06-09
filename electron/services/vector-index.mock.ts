/**
 * InMemoryVectorIndex — Phase 4-2-D.
 *
 * In-memory vector index mock for local knowledge QA.
 * Stores entries in a Map for fast lookup by chunkId.
 * Search uses cosine similarity ranking.
 *
 * Key invariants:
 * - In-memory only (no persistence, no disk I/O)
 * - No network calls
 * - No external vector database
 * - relativePath-only metadata
 * - Deterministic results (no randomness in search)
 *
 * This is the ONLY vector index in Phase 4-2-D.
 * Persistent index deferred to Phase 4-2-E (Ingest).
 */
import type {
  VectorIndex,
  VectorIndexEntry,
  VectorSearchResult,
  VectorIndexStats,
} from '../../src/lib/contracts/vector-index.types';
import { cosineSimilarity } from '../../src/lib/contracts/vector-index.types';

// ── Dimension Mismatch Error ───────────────────────────

/** Error thrown when adding an entry with incompatible dimensions. */
export class VectorDimensionMismatchError extends Error {
  public readonly code = 'VECTOR_DIMENSION_MISMATCH';

  constructor(expected: number, actual: number) {
    super(
      `Vector dimension mismatch: expected ${expected}, got ${actual}`,
    );
    this.name = 'VectorDimensionMismatchError';
  }
}

/** Error thrown when the index state is corrupted. */
export class VectorIndexCorruptedError extends Error {
  public readonly code = 'VECTOR_INDEX_CORRUPTED';

  constructor(reason: string) {
    super(`Vector index corrupted: ${reason}`);
    this.name = 'VectorIndexCorruptedError';
  }
}

// ── InMemoryVectorIndex ────────────────────────────────

/**
 * In-memory vector index implementation.
 *
 * Stores entries keyed by chunkId. Search uses brute-force cosine
 * similarity over all entries (acceptable for mock/small indices).
 */
export class InMemoryVectorIndex implements VectorIndex {
  private entries: Map<string, VectorIndexEntry> = new Map();
  private indexDimensions: number | null = null;

  /**
   * Add entries to the index.
   * Duplicate chunkIds overwrite existing entries (reindex behavior).
   * All entries in a batch must have the same dimensions.
   *
   * @throws VectorDimensionMismatchError if dimensions are inconsistent.
   */
  async add(entries: readonly VectorIndexEntry[]): Promise<void> {
    if (entries.length === 0) return;

    // Validate dimensions consistency
    const firstDim = entries[0].dimensions;
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].dimensions !== firstDim) {
        throw new VectorDimensionMismatchError(firstDim, entries[i].dimensions);
      }
    }

    // Validate against existing index dimensions
    if (this.indexDimensions !== null && firstDim !== this.indexDimensions) {
      throw new VectorDimensionMismatchError(this.indexDimensions, firstDim);
    }

    // Validate per-entry vector length
    for (const entry of entries) {
      if (entry.vector.length !== entry.dimensions) {
        throw new VectorDimensionMismatchError(entry.dimensions, entry.vector.length);
      }
    }

    // Set dimensions on first add
    if (this.indexDimensions === null) {
      this.indexDimensions = firstDim;
    }

    // Add entries (overwrite duplicates)
    for (const entry of entries) {
      this.entries.set(entry.chunkId, entry);
    }
  }

  /**
   * Search for topK most similar entries by cosine similarity.
   * Returns results sorted by score descending.
   * Returns empty array if index is empty.
   */
  async search(
    queryVector: readonly number[],
    topK: number,
  ): Promise<VectorSearchResult[]> {
    if (this.entries.size === 0) return [];
    if (queryVector.length === 0) return [];

    const results: VectorSearchResult[] = [];

    for (const entry of this.entries.values()) {
      // Skip entries with different dimensions
      if (entry.vector.length !== queryVector.length) continue;

      const score = cosineSimilarity(queryVector, entry.vector);
      results.push({ entry, score });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return topK
    return results.slice(0, Math.max(1, topK));
  }

  /**
   * Delete all entries for a given source file (by relativePath).
   * Returns the number of entries deleted.
   */
  async delete(relativePath: string): Promise<number> {
    let deleted = 0;
    for (const [chunkId, entry] of this.entries.entries()) {
      if (entry.relativePath === relativePath) {
        this.entries.delete(chunkId);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Get current index statistics.
   */
  stats(): VectorIndexStats {
    const uniqueFiles = new Set<string>();
    let totalTokens = 0;

    for (const entry of this.entries.values()) {
      uniqueFiles.add(entry.relativePath);
      totalTokens += entry.tokenCount;
    }

    return {
      totalEntries: this.entries.size,
      uniqueFiles: uniqueFiles.size,
      totalTokens,
      dimensions: this.indexDimensions ?? 0,
    };
  }

  /**
   * Clear all entries from the index.
   */
  async clear(): Promise<void> {
    this.entries.clear();
    this.indexDimensions = null;
  }

  /**
   * Get the current number of entries. For diagnostics.
   */
  get size(): number {
    return this.entries.size;
  }
}
