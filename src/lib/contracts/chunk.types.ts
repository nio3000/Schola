/**
 * Chunk Contract — Phase 4-2-C.
 *
 * Defines the type system for Vault text chunking:
 * - Chunk, ChunkSource, ChunkMetadata
 * - ChunkingStrategy (heading, paragraph, fixed-window)
 * - ChunkingOptions, ChunkingResult
 *
 * All invariants:
 * - relativePath-only (no absolute system paths in metadata)
 * - No API Key / secret in chunk metadata
 * - Deterministic chunking for same input
 * - ChunkId stable across re-chunks of unchanged content
 *
 * This is the chunking PRECURSOR layer — no indexing, no retrieval, no embedding yet.
 * BYOK only. No whole-Vault scan. No real provider calls at contract layer.
 */

// ── Chunk Source ───────────────────────────────────────

/** Reference to the source file for a chunk. */
export interface ChunkSource {
  /** Relative path from Vault root. NEVER an absolute system path. */
  readonly relativePath: string;
  /** Display name (filename only). */
  readonly displayName: string;
}

// ── Chunk ──────────────────────────────────────────────

/** A single text chunk extracted from a Vault file. */
export interface Chunk {
  /** Stable identifier for this chunk. Deterministic from source + position. */
  readonly chunkId: string;
  /** Zero-based index within the source file. */
  readonly chunkIndex: number;
  /** The source file reference (relativePath-only). */
  readonly source: ChunkSource;
  /** The chunk text content. */
  readonly content: string;
  /** Approximate token count of the content. */
  readonly tokenCount: number;
  /** Byte length of the chunk content. */
  readonly byteLength: number;
  /** The heading path leading to this chunk (e.g., ["## Methods", "### Synthesis"]). */
  readonly headingPath: readonly string[];
  /** The chunking strategy used. */
  readonly strategy: ChunkingStrategy;
  /** Overlap with previous chunk (in characters), if any. */
  readonly overlapPrev: number;
  /** Overlap with next chunk (in characters), if any. */
  readonly overlapNext: number;
  /** Whether this chunk was truncated to fit token budget. */
  readonly truncated: boolean;
}

// ── Chunk Metadata (renderer-safe summary) ─────────────

/** Lightweight chunk metadata for renderer display — no content, no secrets. */
export interface ChunkMetadata {
  /** Stable identifier matching Chunk.chunkId. */
  readonly chunkId: string;
  /** Zero-based index within source file. */
  readonly chunkIndex: number;
  /** Source relativePath (Vault-relative only). */
  readonly relativePath: string;
  /** Heading path. */
  readonly headingPath: readonly string[];
  /** Token count of the chunk. */
  readonly tokenCount: number;
  /** Byte length. */
  readonly byteLength: number;
  /** Chunking strategy used. */
  readonly strategy: ChunkingStrategy;
  /** Whether truncated. */
  readonly truncated: boolean;
}

// ── Chunking Strategy ──────────────────────────────────

/** Available chunking strategies. */
export type ChunkingStrategy = 'heading' | 'paragraph' | 'fixed';

/** All known chunking strategies. */
export const CHUNKING_STRATEGIES: readonly ChunkingStrategy[] = [
  'heading',
  'paragraph',
  'fixed',
];

/**
 * Validate that a string is a known chunking strategy.
 */
export function isValidChunkingStrategy(value: string): value is ChunkingStrategy {
  return (CHUNKING_STRATEGIES as readonly string[]).includes(value);
}

// ── Chunking Options ───────────────────────────────────

/** Options controlling chunking behavior. */
export interface ChunkingOptions {
  /** Strategy to use. Default: 'heading'. */
  readonly strategy: ChunkingStrategy;
  /** Maximum tokens per chunk. Default: 512. */
  readonly maxTokensPerChunk: number;
  /** Overlap between adjacent chunks in characters. Default: 0. */
  readonly overlap: number;
  /** Whether to include YAML frontmatter as context in every chunk. */
  readonly includeFrontmatter: boolean;
  /** Whether to preserve code blocks as atomic units (no splitting inside fences). */
  readonly preserveCodeBlocks: boolean;
}

/** Default chunking options. */
export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  strategy: 'heading',
  maxTokensPerChunk: 512,
  overlap: 0,
  includeFrontmatter: true,
  preserveCodeBlocks: true,
};

// ── Chunking Result ────────────────────────────────────

/** Result of chunking a single file. */
export interface ChunkingResult {
  /** Source file reference. */
  readonly source: ChunkSource;
  /** Strategy used. */
  readonly strategy: ChunkingStrategy;
  /** Produced chunks. */
  readonly chunks: readonly Chunk[];
  /** Number of chunks that were truncated. */
  readonly truncatedChunkCount: number;
  /** Total token count across all chunks. */
  readonly totalTokens: number;
  /** Frontmatter extracted from the file (if any). */
  readonly frontmatter: Record<string, unknown> | null;
}

// ── Token Estimation ───────────────────────────────────

/**
 * Approximate token count for a text string.
 * Uses character-based heuristics:
 * - Latin/ASCII: ~4 chars per token
 * - CJK: ~1.5 chars per token
 * Returns at least 1.
 */
export function estimateChunkTokens(text: string): number {
  let latinChars = 0;
  let cjkChars = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (
      cp !== undefined &&
      ((cp >= 0x4e00 && cp <= 0x9fff) ||
        (cp >= 0x3400 && cp <= 0x4dbf) ||
        (cp >= 0x20000 && cp <= 0x2a6df) ||
        (cp >= 0xf900 && cp <= 0xfaff))
    ) {
      cjkChars++;
    } else {
      latinChars++;
    }
  }

  const tokens = latinChars / 4 + cjkChars / 1.5;
  return Math.max(1, Math.ceil(tokens));
}

// ── ChunkId Generation ─────────────────────────────────

/**
 * Generate a stable, deterministic chunkId from source path and chunk index.
 * Format: "{relativePath}#chunk-{chunkIndex}"
 */
export function generateChunkId(relativePath: string, chunkIndex: number): string {
  return `${relativePath}#chunk-${chunkIndex}`;
}
