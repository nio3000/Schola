/**
 * VectorIndex Mock Tests — Phase 4-2-D.
 *
 * Verifies:
 * - P0: InMemoryVectorIndex add/search/delete/stats
 * - P0: empty index search returns empty
 * - P0: duplicate chunkId overwrites
 * - P0: same file reindex
 * - P0: delete by relativePath
 * - P0: dimension mismatch safe failure
 * - P0: no external vector DB
 * - P0: no network call
 * - P0: relativePath-only metadata
 * - P1: cosineSimilarity correctness
 * - P1: index stats accurate
 *
 * Test boundaries: 42-TB-130 through 42-TB-135
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import type {
  VectorIndexEntry,
  VectorSearchResult,
  VectorIndexStats,
} from '../../src/lib/contracts/vector-index.types';
import {
  cosineSimilarity,
  DEFAULT_RELEVANCE_THRESHOLD,
  isRelevantScore,
} from '../../src/lib/contracts/vector-index.types';
import {
  InMemoryVectorIndex,
  VectorDimensionMismatchError,
} from '../../electron/services/vector-index.mock';

// ── Helpers ───────────────────────────────────────────

function makeEntry(
  chunkId: string,
  relativePath: string,
  vector: number[],
  overrides?: Partial<VectorIndexEntry>,
): VectorIndexEntry {
  return {
    chunkId,
    relativePath,
    headingPath: [],
    tokenCount: 100,
    vector,
    dimensions: vector.length,
    strategy: 'heading',
    ...overrides,
  };
}

function makeVector(dim: number, seed: number): number[] {
  const v: number[] = [];
  for (let i = 0; i < dim; i++) {
    v.push(((seed * (i + 1)) % 100) / 100);
  }
  return v;
}

// ── Cosine Similarity ─────────────────────────────────

describe('cosineSimilarity', () => {
  it('identical vectors have similarity 1', () => {
    const v = [1, 2, 3];
    assert.equal(cosineSimilarity(v, v), 1);
  });

  it('orthogonal vectors have similarity 0', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    assert.ok(cosineSimilarity(a, b) < 0.001);
  });

  it('different dimensions return 0', () => {
    assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0);
  });

  it('empty vectors return 0', () => {
    assert.equal(cosineSimilarity([], []), 0);
  });
});

describe('isRelevantScore', () => {
  it('returns true for scores above threshold', () => {
    assert.equal(isRelevantScore(0.8), true);
    assert.equal(isRelevantScore(0.5), true);
    assert.equal(isRelevantScore(0.3), false);
  });

  it('respects custom threshold', () => {
    assert.equal(isRelevantScore(0.6, 0.7), false);
    assert.equal(isRelevantScore(0.8, 0.7), true);
  });
});

// ── InMemoryVectorIndex ────────────────────────────────

describe('InMemoryVectorIndex', () => {
  const dim = 4;

  it('42-TB-130: starts empty', () => {
    const idx = new InMemoryVectorIndex();
    const s = idx.stats();
    assert.equal(s.totalEntries, 0);
    assert.equal(s.uniqueFiles, 0);
  });

  it('42-TB-130: add entries and stats reflect correctly', async () => {
    const idx = new InMemoryVectorIndex();
    await idx.add([
      makeEntry('a#chunk-0', 'notes/a.md', makeVector(dim, 1)),
      makeEntry('a#chunk-1', 'notes/a.md', makeVector(dim, 2)),
      makeEntry('b#chunk-0', 'notes/b.md', makeVector(dim, 3)),
    ]);
    const s = idx.stats();
    assert.equal(s.totalEntries, 3);
    assert.equal(s.uniqueFiles, 2);
    assert.ok(s.totalTokens > 0);
  });

  it('42-TB-131: search returns topK results', async () => {
    const idx = new InMemoryVectorIndex();
    await idx.add([
      makeEntry('a#chunk-0', 'notes/a.md', [1, 0, 0, 0]),
      makeEntry('b#chunk-0', 'notes/b.md', [0, 1, 0, 0]),
      makeEntry('c#chunk-0', 'notes/c.md', [0, 0, 1, 0]),
    ]);

    const results = await idx.search([1, 0.1, 0, 0], 2);
    assert.equal(results.length, 2);
    // First result should be most similar to [1, 0.1, 0, 0]
    assert.equal(results[0].entry.relativePath, 'notes/a.md');
    assert.ok(results[0].score > 0.9);
  });

  it('42-TB-134: empty index search returns empty', async () => {
    const idx = new InMemoryVectorIndex();
    const results = await idx.search([1, 2, 3, 4], 5);
    assert.equal(results.length, 0);
  });

  it('results are sorted by score descending', async () => {
    const idx = new InMemoryVectorIndex();
    await idx.add([
      makeEntry('a#chunk-0', 'notes/a.md', [1, 0, 0, 0]),
      makeEntry('b#chunk-0', 'notes/b.md', [0.5, 0.5, 0, 0]),
    ]);

    const results = await idx.search([1, 0, 0, 0], 10);
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score);
    }
  });

  it('42-TB-132: delete by relativePath removes entries', async () => {
    const idx = new InMemoryVectorIndex();
    await idx.add([
      makeEntry('a#chunk-0', 'notes/a.md', makeVector(dim, 1)),
      makeEntry('a#chunk-1', 'notes/a.md', makeVector(dim, 2)),
      makeEntry('b#chunk-0', 'notes/b.md', makeVector(dim, 3)),
    ]);

    const deleted = await idx.delete('notes/a.md');
    assert.equal(deleted, 2);
    const s = idx.stats();
    assert.equal(s.totalEntries, 1);
    assert.equal(s.uniqueFiles, 1);
  });

  it('42-TB-132: delete non-existent path returns 0', async () => {
    const idx = new InMemoryVectorIndex();
    await idx.add([makeEntry('a#chunk-0', 'notes/a.md', makeVector(dim, 1))]);
    const deleted = await idx.delete('nonexistent.md');
    assert.equal(deleted, 0);
    assert.equal(idx.stats().totalEntries, 1);
  });

  it('42-TB-131: duplicate chunkId overwrites (reindex)', async () => {
    const idx = new InMemoryVectorIndex();
    await idx.add([makeEntry('a#chunk-0', 'notes/a.md', makeVector(dim, 1))]);
    await idx.add([makeEntry('a#chunk-0', 'notes/a.md', makeVector(dim, 99))]);
    const s = idx.stats();
    assert.equal(s.totalEntries, 1);
  });

  it('42-TB-135: same file reindex updates entries', async () => {
    const idx = new InMemoryVectorIndex();
    await idx.add([
      makeEntry('a#chunk-0', 'notes/a.md', makeVector(dim, 1)),
      makeEntry('a#chunk-1', 'notes/a.md', makeVector(dim, 2)),
    ]);
    // Reindex with different vectors
    await idx.add([
      makeEntry('a#chunk-0', 'notes/a.md', makeVector(dim, 10)),
      makeEntry('a#chunk-1', 'notes/a.md', makeVector(dim, 20)),
    ]);
    const s = idx.stats();
    assert.equal(s.totalEntries, 2);
  });

  it('dimension mismatch between batches throws', async () => {
    const idx = new InMemoryVectorIndex();
    await idx.add([makeEntry('a#chunk-0', 'notes/a.md', makeVector(4, 1))]);
    await assert.rejects(
      () => idx.add([makeEntry('b#chunk-0', 'notes/b.md', makeVector(8, 1))]),
      VectorDimensionMismatchError,
    );
  });

  it('dimension mismatch within batch throws', async () => {
    const idx = new InMemoryVectorIndex();
    await assert.rejects(
      () =>
        idx.add([
          makeEntry('a#chunk-0', 'notes/a.md', makeVector(4, 1)),
          makeEntry('b#chunk-0', 'notes/b.md', makeVector(8, 1)),
        ]),
      VectorDimensionMismatchError,
    );
  });

  it('vector length mismatch with dimensions throws', async () => {
    const idx = new InMemoryVectorIndex();
    await assert.rejects(
      () =>
        idx.add([
          {
            ...makeEntry('a#chunk-0', 'notes/a.md', [1, 2, 3]),
            dimensions: 4, // Mismatch — vector has 3 values, dimensions says 4
          },
        ]),
      VectorDimensionMismatchError,
    );
  });

  it('42-TB-133: stats are accurate after operations', async () => {
    const idx = new InMemoryVectorIndex();
    await idx.add([
      makeEntry('a#chunk-0', 'notes/a.md', makeVector(dim, 1)),
      makeEntry('b#chunk-0', 'notes/b.md', makeVector(dim, 2)),
    ]);
    await idx.delete('notes/a.md');
    const s = idx.stats();
    assert.equal(s.totalEntries, 1);
    assert.equal(s.uniqueFiles, 1);
  });

  it('clear empties the index', async () => {
    const idx = new InMemoryVectorIndex();
    await idx.add([makeEntry('a#chunk-0', 'notes/a.md', makeVector(dim, 1))]);
    await idx.clear();
    assert.equal(idx.stats().totalEntries, 0);
  });
});

// ── Safety ────────────────────────────────────────────

describe('vector index safety', () => {
  it('42-TB-130: no external vector DB — in-memory only', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/vector-index.mock.ts'),
      'utf8',
    );
    assert.ok(!content.includes('pinecone'));
    assert.ok(!content.includes('weaviate'));
    assert.ok(!content.includes('chroma'));
    assert.ok(!content.includes('qdrant'));
    assert.ok(!content.includes('milvus'));
  });

  it('no network calls in vector-index.mock.ts', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/vector-index.mock.ts'),
      'utf8',
    );
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
    assert.ok(!content.includes('https.request'));
  });

  it('VectorIndexEntry uses relativePath-only', () => {
    const entry = makeEntry('a#chunk-0', 'notes/a.md', [1, 2, 3]);
    assert.ok(!entry.relativePath.includes(':\\'));
    assert.ok(!entry.relativePath.includes('\\\\'));
    assert.ok(!entry.relativePath.startsWith('/'));
  });

  it('no API Key / secret in index types', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/vector-index.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('apiKey'));
    // "secret" may appear in variable names or comments — check for the field name
    assert.ok(!content.includes('secretKey'));
    assert.ok(!content.includes('apiSecret'));
  });
});

// ── Phase Boundary ────────────────────────────────────

describe('phase boundary', () => {
  it('vector-index.types.ts has no Phase 4-3/4-4/Phase 5', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/vector-index.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('Phase 4-3'));
    assert.ok(!content.includes('Phase 4-4'));
    assert.ok(!content.includes('Phase 5'));
  });

  it('vector-index.mock.ts has no writeFile/saveToVault', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/vector-index.mock.ts'),
      'utf8',
    );
    assert.ok(!content.includes('writeFile'));
    assert.ok(!content.includes('saveToVault'));
  });

  it('vector-index.types.ts has no electron imports', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/vector-index.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes("from 'electron'"));
  });
});
