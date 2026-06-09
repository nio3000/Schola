/**
 * EmbeddingProvider Contract — Phase 4-2-C.
 *
 * Defines the interface for text-to-vector embedding providers.
 * This phase implements ONLY the contract + MockEmbeddingProvider.
 * No real provider calls. No API Key transmission to renderer.
 *
 * BYOK only. Provider calls will go through the existing provider adapter
 * system in subsequent phases.
 */
import type { Chunk } from './chunk.types';

// ── Embedding Types ────────────────────────────────────

/** Input to an embedding operation. */
export interface EmbeddingInput {
  /** Texts to embed. */
  readonly texts: readonly string[];
  /** Optional chunks metadata for traceability (not sent to provider). */
  readonly chunks?: readonly Chunk[];
}

/** A single embedding vector. */
export interface EmbeddingVector {
  /** The floating-point vector. */
  readonly values: readonly number[];
  /** Vector dimension. */
  readonly dimensions: number;
}

/** Result of an embedding operation. */
export interface EmbeddingResult {
  /** The embedding vectors, one per input text. */
  readonly vectors: readonly EmbeddingVector[];
  /** Total tokens consumed by the embedding request. */
  readonly totalTokens: number;
  /** Provider used. */
  readonly providerId: string;
  /** Model used. */
  readonly model: string;
}

// ── EmbeddingProvider Interface ────────────────────────

/** Abstract embedding provider — contract only. */
export interface EmbeddingProvider {
  /** Unique provider identifier. */
  readonly providerId: string;
  /** Model name. */
  readonly model: string;
  /** Vector dimensions produced by this model. */
  readonly dimensions: number;

  /**
   * Embed multiple texts.
   * Returns one vector per text, in the same order.
   * Throws if the provider is unavailable or key is missing.
   */
  embed(input: EmbeddingInput): Promise<EmbeddingResult>;

  /**
   * Embed a single query text.
   * May use a different endpoint or model variant optimized for queries.
   */
  embedQuery(text: string): Promise<EmbeddingVector>;
}

// ── Error Types ────────────────────────────────────────

/** Error thrown when embedding provider key is not configured. */
export class EmbeddingKeyMissingError extends Error {
  public readonly code = 'EMBEDDING_KEY_MISSING';

  constructor(providerId: string) {
    super(`Embedding provider "${providerId}" requires a configured API Key (BYOK)`);
    this.name = 'EmbeddingKeyMissingError';
  }
}

/** Error thrown when embedding provider is unavailable. */
export class EmbeddingProviderUnavailableError extends Error {
  public readonly code = 'EMBEDDING_PROVIDER_UNAVAILABLE';

  constructor(providerId: string, reason?: string) {
    super(
      `Embedding provider "${providerId}" is unavailable` +
        (reason ? `: ${reason}` : ''),
    );
    this.name = 'EmbeddingProviderUnavailableError';
  }
}

// ── Validation ─────────────────────────────────────────

/**
 * Validate that an embedding vector has the expected dimensions.
 */
export function validateEmbeddingDimensions(
  vector: EmbeddingVector,
  expectedDimensions: number,
): boolean {
  return vector.values.length === expectedDimensions && vector.dimensions === expectedDimensions;
}

/**
 * Validate that an EmbeddingResult has consistent dimensions across all vectors.
 */
export function validateEmbeddingResult(
  result: EmbeddingResult,
  expectedDimensions: number,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (result.vectors.length === 0) {
    issues.push('EmbeddingResult contains no vectors');
  }

  for (let i = 0; i < result.vectors.length; i++) {
    if (!validateEmbeddingDimensions(result.vectors[i], expectedDimensions)) {
      issues.push(
        `Vector ${i} has ${result.vectors[i].values.length} values, expected ${expectedDimensions}`,
      );
    }
  }

  if (result.totalTokens < 0) {
    issues.push('Negative token count in EmbeddingResult');
  }

  if (!result.providerId) {
    issues.push('Provider ID is required in EmbeddingResult');
  }

  if (!result.model) {
    issues.push('Model name is required in EmbeddingResult');
  }

  return { valid: issues.length === 0, issues };
}

// ── Known Provider Configs ─────────────────────────────

/** Known embedding model configurations. */
export const EMBEDDING_MODEL_CONFIGS: Record<
  string,
  { providerId: string; model: string; dimensions: number }
> = {
  'text-embedding-3-small': {
    providerId: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
  'text-embedding-3-large': {
    providerId: 'openai',
    model: 'text-embedding-3-large',
    dimensions: 3072,
  },
  'text-embedding-ada-002': {
    providerId: 'openai',
    model: 'text-embedding-ada-002',
    dimensions: 1536,
  },
  'nomic-embed-text': {
    providerId: 'ollama',
    model: 'nomic-embed-text',
    dimensions: 768,
  },
};

/**
 * Check if an embedding model is known.
 */
export function isKnownEmbeddingModel(model: string): boolean {
  return model in EMBEDDING_MODEL_CONFIGS;
}

/**
 * Get the expected dimensions for a known embedding model.
 * Returns undefined if the model is unknown.
 */
export function getEmbeddingDimensions(model: string): number | undefined {
  return EMBEDDING_MODEL_CONFIGS[model]?.dimensions;
}
