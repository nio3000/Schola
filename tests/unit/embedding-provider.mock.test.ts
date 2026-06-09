/**
 * EmbeddingProvider Mock Tests — Phase 4-2-C.
 *
 * Verifies:
 * - P0: MockEmbeddingProvider produces deterministic vectors
 * - P0: embed() returns correct shape (one vector per text)
 * - P0: embedQuery() returns single vector
 * - P0: dimensions match provider config
 * - P0: providerId and model are set correctly
 * - P0: missing key safe failure (KeyMissingEmbeddingProvider)
 * - P0: unavailable provider safe failure (UnavailableEmbeddingProvider)
 * - P0: no real provider call (all mock)
 * - P0: no API Key in renderer payload
 * - P0: no chunk/vector logs
 * - P1: validateEmbeddingDimensions works
 * - P1: validateEmbeddingResult works
 * - P1: EMBEDDING_MODEL_CONFIGS has correct dimensions
 *
 * Test boundaries: 42-TB-120 through 42-TB-125
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import type {
  EmbeddingProvider,
  EmbeddingInput,
  EmbeddingResult,
  EmbeddingVector,
} from '../../src/lib/contracts/embedding-provider.types';
import {
  EmbeddingKeyMissingError,
  EmbeddingProviderUnavailableError,
  validateEmbeddingDimensions,
  validateEmbeddingResult,
  EMBEDDING_MODEL_CONFIGS,
  isKnownEmbeddingModel,
  getEmbeddingDimensions,
} from '../../src/lib/contracts/embedding-provider.types';
import {
  MockEmbeddingProvider,
  UnavailableEmbeddingProvider,
  KeyMissingEmbeddingProvider,
} from '../../electron/services/embedding-provider.mock';

// ── Contract Tests ────────────────────────────────────

describe('EmbeddingProvider contract', () => {
  it('42-TB-120: EMBEDDING_MODEL_CONFIGS has known models', () => {
    assert.ok(isKnownEmbeddingModel('text-embedding-3-small'));
    assert.ok(isKnownEmbeddingModel('text-embedding-3-large'));
    assert.ok(isKnownEmbeddingModel('nomic-embed-text'));
    assert.equal(isKnownEmbeddingModel('nonexistent'), false);
  });

  it('getEmbeddingDimensions returns correct values', () => {
    assert.equal(getEmbeddingDimensions('text-embedding-3-small'), 1536);
    assert.equal(getEmbeddingDimensions('text-embedding-3-large'), 3072);
    assert.equal(getEmbeddingDimensions('nomic-embed-text'), 768);
    assert.equal(getEmbeddingDimensions('nonexistent'), undefined);
  });

  it('validateEmbeddingDimensions checks dimension match', () => {
    const valid: EmbeddingVector = { values: [1, 2, 3], dimensions: 3 };
    const invalid: EmbeddingVector = { values: [1, 2, 3], dimensions: 5 };
    assert.equal(validateEmbeddingDimensions(valid, 3), true);
    assert.equal(validateEmbeddingDimensions(valid, 2), false);
    assert.equal(validateEmbeddingDimensions(invalid, 3), false);
  });

  it('validateEmbeddingResult checks all vectors', () => {
    const validResult: EmbeddingResult = {
      vectors: [
        { values: [1, 2], dimensions: 2 },
        { values: [3, 4], dimensions: 2 },
      ],
      totalTokens: 10,
      providerId: 'mock',
      model: 'mock-256',
    };
    const out = validateEmbeddingResult(validResult, 2);
    assert.equal(out.valid, true);
    assert.equal(out.issues.length, 0);
  });

  it('validateEmbeddingResult flags dimension mismatch', () => {
    const badResult: EmbeddingResult = {
      vectors: [
        { values: [1, 2], dimensions: 2 },
        { values: [3, 4, 5], dimensions: 3 },
      ],
      totalTokens: 10,
      providerId: 'mock',
      model: 'mock-256',
    };
    const out = validateEmbeddingResult(badResult, 2);
    assert.equal(out.valid, false);
    assert.ok(out.issues.length > 0);
  });

  it('validateEmbeddingResult flags empty vectors', () => {
    const emptyResult: EmbeddingResult = {
      vectors: [],
      totalTokens: 0,
      providerId: 'mock',
      model: 'mock-256',
    };
    const out = validateEmbeddingResult(emptyResult, 2);
    assert.equal(out.valid, false);
    assert.ok(out.issues.some((i) => i.includes('no vectors')));
  });
});

// ── MockEmbeddingProvider ───────────────────────────────

describe('MockEmbeddingProvider', () => {
  const mock = new MockEmbeddingProvider();

  it('42-TB-121: embed() returns one vector per text', async () => {
    const input: EmbeddingInput = { texts: ['hello', 'world', 'test'] };
    const result = await mock.embed(input);
    assert.equal(result.vectors.length, 3);
    assert.equal(result.providerId, 'mock');
    assert.equal(result.model, 'mock-embedding-256');
    assert.ok(result.totalTokens > 0);
  });

  it('42-TB-122: dimensions match provider config', async () => {
    const dim256 = new MockEmbeddingProvider('mock-256', 256);
    const r1 = await dim256.embed({ texts: ['a'] });
    assert.equal(r1.vectors[0].dimensions, 256);
    assert.equal(r1.vectors[0].values.length, 256);

    const dim128 = new MockEmbeddingProvider('mock-128', 128);
    const r2 = await dim128.embed({ texts: ['a'] });
    assert.equal(r2.vectors[0].dimensions, 128);
    assert.equal(r2.vectors[0].values.length, 128);
  });

  it('42-TB-122: embedQuery() returns single vector', async () => {
    const vector = await mock.embedQuery('query text');
    assert.ok(Array.isArray(vector.values));
    assert.equal(vector.dimensions, mock.dimensions);
    assert.equal(vector.values.length, mock.dimensions);
  });

  it('deterministic: same text → same vector', async () => {
    const r1 = await mock.embed({ texts: ['deterministic test'] });
    const r2 = await mock.embed({ texts: ['deterministic test'] });
    for (let i = 0; i < r1.vectors[0].values.length; i++) {
      assert.equal(r1.vectors[0].values[i], r2.vectors[0].values[i]);
    }
  });

  it('different texts → different vectors', async () => {
    const result = await mock.embed({ texts: ['text A', 'text B'] });
    // Vectors should differ for different texts
    const vecA = result.vectors[0].values;
    const vecB = result.vectors[1].values;
    let differs = false;
    for (let i = 0; i < vecA.length; i++) {
      if (vecA[i] !== vecB[i]) {
        differs = true;
        break;
      }
    }
    assert.ok(differs, 'Different texts should produce different vectors');
  });

  it('42-TB-124: handles empty text gracefully', async () => {
    const result = await mock.embed({ texts: [''] });
    assert.equal(result.vectors.length, 1);
    assert.ok(result.vectors[0].values.length === mock.dimensions);
    // Vector should still have values (all zeros/near-zero)
    const hasValues = result.vectors[0].values.some((v) => v !== 0);
    // Empty text may or may not produce non-zero values — both OK
  });

  it('returns correct totalTokens estimate', async () => {
    const input: EmbeddingInput = { texts: ['a'.repeat(40), 'b'.repeat(80)] };
    const result = await mock.embed(input);
    // 40/4 + 80/4 = 10 + 20 = 30
    assert.ok(result.totalTokens >= 20, `Expected ~30 tokens, got ${result.totalTokens}`);
  });

  it('vectors contain values in range [-1, 1]', async () => {
    const result = await mock.embed({ texts: ['range test'] });
    for (const v of result.vectors[0].values) {
      assert.ok(v >= -1 && v <= 1, `Value ${v} out of [-1,1] range`);
    }
  });
});

// ── Safe Failure ───────────────────────────────────────

describe('safe failure providers', () => {
  it('42-TB-123: KeyMissingEmbeddingProvider throws EmbeddingKeyMissingError', async () => {
    const provider = new KeyMissingEmbeddingProvider();
    await assert.rejects(
      () => provider.embed({ texts: ['test'] }),
      EmbeddingKeyMissingError,
    );
    await assert.rejects(
      () => provider.embedQuery('test'),
      EmbeddingKeyMissingError,
    );
  });

  it('42-TB-125: UnavailableEmbeddingProvider throws EmbeddingProviderUnavailableError', async () => {
    const provider = new UnavailableEmbeddingProvider();
    await assert.rejects(
      () => provider.embed({ texts: ['test'] }),
      EmbeddingProviderUnavailableError,
    );
    await assert.rejects(
      () => provider.embedQuery('test'),
      EmbeddingProviderUnavailableError,
    );
  });

  it('EmbeddingKeyMissingError has correct code', () => {
    const err = new EmbeddingKeyMissingError('test-provider');
    assert.equal(err.code, 'EMBEDDING_KEY_MISSING');
    assert.ok(err.message.includes('test-provider'));
  });

  it('EmbeddingProviderUnavailableError has correct code', () => {
    const err = new EmbeddingProviderUnavailableError('test-provider', 'timeout');
    assert.equal(err.code, 'EMBEDDING_PROVIDER_UNAVAILABLE');
    assert.ok(err.message.includes('test-provider'));
    assert.ok(err.message.includes('timeout'));
  });
});

// ── Safety ────────────────────────────────────────────

describe('no API Key / secret leak', () => {
  it('MockEmbeddingProvider has no apiKey field', () => {
    const mock = new MockEmbeddingProvider();
    const any = mock as unknown as Record<string, unknown>;
    assert.equal(any.apiKey, undefined);
    assert.equal(any.secret, undefined);
    assert.equal(any.token, undefined);
  });

  it('EmbeddingResult has no apiKey field', async () => {
    const mock = new MockEmbeddingProvider();
    const result = await mock.embed({ texts: ['test'] });
    const json = JSON.stringify(result);
    assert.ok(!json.toLowerCase().includes('api_key'));
    assert.ok(!json.toLowerCase().includes('secret'));
    assert.ok(!json.includes('sk-'));
  });

  it('EmbeddingVector has no apiKey field', async () => {
    const mock = new MockEmbeddingProvider();
    const vector = await mock.embedQuery('test');
    const any = vector as unknown as Record<string, unknown>;
    assert.equal(any.apiKey, undefined);
    assert.equal(any.secret, undefined);
  });
});

// ── No IPC / Vault write ───────────────────────────────

describe('no generic IPC / no Vault write', () => {
  it('chunk.types.ts has no electron imports', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/chunk.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('ipcRenderer'));
    assert.ok(!content.includes('ipcMain'));
    assert.ok(!content.includes("from 'electron'"));
  });

  it('embedding-provider.types.ts has no electron imports', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/embedding-provider.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('ipcRenderer'));
    assert.ok(!content.includes('ipcMain'));
    assert.ok(!content.includes("from 'electron'"));
  });

  it('chunking-strategy.service.ts has no writeFile/saveToVault', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/chunking-strategy.service.ts'),
      'utf8',
    );
    assert.ok(!content.includes('writeFile'));
    assert.ok(!content.includes('saveToVault'));
    assert.ok(!content.includes('fs.writeFile'));
  });

  it('embedding-provider.mock.ts has no writeFile/saveToVault', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/embedding-provider.mock.ts'),
      'utf8',
    );
    assert.ok(!content.includes('writeFile'));
    assert.ok(!content.includes('saveToVault'));
    assert.ok(!content.includes('fs.writeFile'));
  });
});

// ── Phase Boundary ────────────────────────────────────

describe('phase boundary', () => {
  it('chunk.types.ts has no RAG / vector / knowledge_compiler references', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/chunk.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('RAG'));
    assert.ok(!content.includes('vector index'));
    assert.ok(!content.includes('knowledge_compiler'));
  });

  it('embedding-provider.types.ts has no Phase 4-3/4-4/Phase 5', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/embedding-provider.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('Phase 4-3'));
    assert.ok(!content.includes('Phase 4-4'));
    assert.ok(!content.includes('Phase 5'));
  });

  it('no real provider call in mock (no fetch/axios/https)', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/embedding-provider.mock.ts'),
      'utf8',
    );
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
    assert.ok(!content.includes('https.request'));
  });
});

// ── No chunk/vector logs ──────────────────────────────

describe('no chunk/vector logs', () => {
  it('chunking-strategy.service.ts has no console.log', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/chunking-strategy.service.ts'),
      'utf8',
    );
    assert.ok(!content.includes('console.log'));
  });

  it('embedding-provider.mock.ts has no vector serialization/logging', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/embedding-provider.mock.ts'),
      'utf8',
    );
    assert.ok(!content.includes('console.log'));
  });
});
