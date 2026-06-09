/**
 * MockEmbeddingProvider — Phase 4-2-C.
 *
 * Provides deterministic fake embeddings for testing and development.
 * Each text input produces a vector where values are derived from the
 * text hash — same text always produces the same vector.
 *
 * This is the ONLY embedding provider available in Phase 4-2-C.
 * Real provider calls (OpenAI, Ollama) are deferred to Phase 4-2-D+.
 *
 * Key invariants:
 * - Deterministic: same text → same vector
 * - No network calls: pure computation
 * - No API Key required
 * - No Vault writes
 * - No logs of chunk content or embedding vectors
 */
import type {
  EmbeddingProvider,
  EmbeddingInput,
  EmbeddingResult,
  EmbeddingVector,
} from '../../src/lib/contracts/embedding-provider.types';
import {
  EmbeddingKeyMissingError,
  EmbeddingProviderUnavailableError,
} from '../../src/lib/contracts/embedding-provider.types';

// ── Mock Provider ──────────────────────────────────────

/**
 * Mock embedding provider for Phase 4-2-C.
 *
 * Generates deterministic pseudo-embeddings:
 * - Each text is hashed to produce a seed
 * - A vector of `dimensions` floats is derived from the hash
 * - Same input always produces the same output
 * - No network, no API key, no logs
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  public readonly providerId = 'mock';
  public readonly model: string;
  public readonly dimensions: number;

  /**
   * @param model - Model name (defaults to 'mock-embedding-256').
   * @param dimensions - Vector dimensions (defaults to 256).
   */
  constructor(model = 'mock-embedding-256', dimensions = 256) {
    this.model = model;
    this.dimensions = dimensions;
  }

  /**
   * Embed multiple texts.
   * Returns deterministic vectors. Never throws for valid input.
   */
  async embed(input: EmbeddingInput): Promise<EmbeddingResult> {
    const vectors: EmbeddingVector[] = input.texts.map((text) =>
      this.createVector(text),
    );

    // Estimate tokens (mock: 4 chars ≈ 1 token)
    const totalTokens = input.texts.reduce(
      (sum, t) => sum + Math.max(1, Math.ceil(t.length / 4)),
      0,
    );

    return {
      vectors,
      totalTokens,
      providerId: this.providerId,
      model: this.model,
    };
  }

  /**
   * Embed a single query text.
   * Same deterministic behavior as embed().
   */
  async embedQuery(text: string): Promise<EmbeddingVector> {
    return this.createVector(text);
  }

  // ── Private ─────────────────────────────────────

  /**
   * Create a deterministic embedding vector from text.
   * Uses a simple hash function — NOT cryptographically secure,
   * but sufficient for deterministic testing.
   */
  private createVector(text: string): EmbeddingVector {
    const values: number[] = new Array(this.dimensions);
    const normalized = text.trim().toLowerCase();

    // Seed from DJB2-like hash
    let hash = 5381;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
    }

    // Generate deterministic values using linear congruential generator
    let seed = Math.abs(hash);
    for (let i = 0; i < this.dimensions; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      // Normalize to [-1, 1]
      values[i] = (seed / 0x7fffffff) * 2 - 1;
    }

    return {
      values,
      dimensions: this.dimensions,
    };
  }
}

// ── Safe Failure Helpers ───────────────────────────────

/**
 * Create a mock embedding provider in "unavailable" state.
 * All calls throw EmbeddingProviderUnavailableError.
 * Useful for testing error handling paths.
 */
export class UnavailableEmbeddingProvider implements EmbeddingProvider {
  public readonly providerId: string;
  public readonly model: string;
  public readonly dimensions: number;

  constructor(
    providerId = 'mock-unavailable',
    model = 'mock-unavailable',
    dimensions = 256,
  ) {
    this.providerId = providerId;
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(_input: EmbeddingInput): Promise<EmbeddingResult> {
    throw new EmbeddingProviderUnavailableError(
      this.providerId,
      'Mock unavailable provider (Phase 4-2-C)',
    );
  }

  async embedQuery(_text: string): Promise<EmbeddingVector> {
    throw new EmbeddingProviderUnavailableError(
      this.providerId,
      'Mock unavailable provider (Phase 4-2-C)',
    );
  }
}

/**
 * Create a mock embedding provider in "key missing" state.
 * All calls throw EmbeddingKeyMissingError.
 * Useful for testing BYOK enforcement.
 */
export class KeyMissingEmbeddingProvider implements EmbeddingProvider {
  public readonly providerId: string;
  public readonly model: string;
  public readonly dimensions: number;

  constructor(
    providerId = 'mock-nokey',
    model = 'mock-nokey',
    dimensions = 256,
  ) {
    this.providerId = providerId;
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(_input: EmbeddingInput): Promise<EmbeddingResult> {
    throw new EmbeddingKeyMissingError(this.providerId);
  }

  async embedQuery(_text: string): Promise<EmbeddingVector> {
    throw new EmbeddingKeyMissingError(this.providerId);
  }
}
