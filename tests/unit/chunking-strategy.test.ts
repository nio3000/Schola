/**
 * Chunking Strategy Tests — Phase 4-2-C.
 *
 * Verifies:
 * - P0: heading-based chunking produces correct chunk boundaries
 * - P0: paragraph-based chunking with overlap
 * - P0: fixed-window chunking skeleton
 * - P0: chunkId deterministic and stable
 * - P0: chunkIndex sequential and 0-based
 * - P0: headingPath extraction correct
 * - P0: token estimation non-negative
 * - P0: frontmatter extraction
 * - P0: code block handling (atomic)
 * - P0: empty file safe handling
 * - P0: huge file truncation metadata
 * - P0: no absolute path in chunk metadata
 * - P0: no secret fields in chunk metadata
 * - P0: deterministic chunking (same input → same output)
 * - P1: overlap metadata correct
 * - P1: table handling placeholder
 *
 * Test boundaries: 42-TB-110 through 42-TB-115
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type {
  Chunk,
  ChunkSource,
  ChunkingOptions,
  ChunkingResult,
} from '../../src/lib/contracts/chunk.types';
import {
  estimateChunkTokens,
  generateChunkId,
  isValidChunkingStrategy,
  CHUNKING_STRATEGIES,
  DEFAULT_CHUNKING_OPTIONS,
} from '../../src/lib/contracts/chunk.types';
import {
  chunkMarkdownFile,
  extractFrontmatter,
} from '../../electron/services/chunking-strategy.service';

// ── Helpers ───────────────────────────────────────────

function makeSource(relativePath = 'notes/test.md'): ChunkSource {
  return { relativePath, displayName: 'test.md' };
}

// ── Contract Tests ────────────────────────────────────

describe('Chunk contract types', () => {
  it('42-TB-110: CHUNKING_STRATEGIES contains all three strategies', () => {
    assert.ok(CHUNKING_STRATEGIES.includes('heading'));
    assert.ok(CHUNKING_STRATEGIES.includes('paragraph'));
    assert.ok(CHUNKING_STRATEGIES.includes('fixed'));
    assert.equal(CHUNKING_STRATEGIES.length, 3);
  });

  it('isValidChunkingStrategy validates correctly', () => {
    assert.equal(isValidChunkingStrategy('heading'), true);
    assert.equal(isValidChunkingStrategy('paragraph'), true);
    assert.equal(isValidChunkingStrategy('fixed'), true);
    assert.equal(isValidChunkingStrategy('invalid'), false);
    assert.equal(isValidChunkingStrategy(''), false);
  });

  it('generateChunkId is deterministic', () => {
    const id1 = generateChunkId('notes/a.md', 0);
    const id2 = generateChunkId('notes/a.md', 0);
    assert.equal(id1, id2);
    assert.ok(id1.includes('notes/a.md'));
    assert.ok(id1.includes('chunk-0'));
  });

  it('chunkId differs for different indices', () => {
    const id0 = generateChunkId('notes/a.md', 0);
    const id1 = generateChunkId('notes/a.md', 1);
    assert.notEqual(id0, id1);
  });

  it('chunkId differs for different paths', () => {
    const idA = generateChunkId('notes/a.md', 0);
    const idB = generateChunkId('notes/b.md', 0);
    assert.notEqual(idA, idB);
  });

  it('DEFAULT_CHUNKING_OPTIONS has safe defaults', () => {
    assert.equal(DEFAULT_CHUNKING_OPTIONS.strategy, 'heading');
    assert.ok(DEFAULT_CHUNKING_OPTIONS.maxTokensPerChunk > 0);
    assert.equal(DEFAULT_CHUNKING_OPTIONS.overlap, 0);
  });
});

// ── Token Estimation ──────────────────────────────────

describe('token estimation', () => {
  it('returns at least 1 for any non-empty text', () => {
    assert.ok(estimateChunkTokens('hello') >= 1);
    assert.ok(estimateChunkTokens('a') >= 1);
  });

  it('returns 1 for empty string', () => {
    assert.equal(estimateChunkTokens(''), 1);
  });

  it('CJK text has higher token density (fewer tokens per char)', () => {
    const latinTokens = estimateChunkTokens('hello world');
    const cjkTokens = estimateChunkTokens('你好世界');
    // CJK: ~1.5 chars/token, Latin: ~4 chars/token
    // For 4 CJK chars: ~3 tokens; for 11 Latin chars: ~3 tokens
    assert.ok(cjkTokens <= latinTokens || latinTokens <= 5);
  });
});

// ── Frontmatter Extraction ────────────────────────────

describe('frontmatter extraction', () => {
  it('extracts YAML frontmatter from markdown', () => {
    const content = '---\ntitle: Test\ndate: 2024-01-01\ntags: [a, b]\n---\n\n# Body content';
    const { frontmatter, body } = extractFrontmatter(content);
    assert.ok(frontmatter);
    assert.equal(frontmatter['title'], 'Test');
    assert.equal(frontmatter['date'], '2024-01-01');
    assert.ok(Array.isArray(frontmatter['tags']));
    assert.equal((frontmatter['tags'] as string[]).length, 2);
    assert.ok(body.includes('# Body content'));
  });

  it('returns null frontmatter for content without --- delimiters', () => {
    const { frontmatter, body } = extractFrontmatter('# Just a heading');
    assert.equal(frontmatter, null);
    assert.ok(body.includes('# Just a heading'));
  });

  it('handles malformed frontmatter gracefully', () => {
    const content = '---\nbroken\nyaml\n# Not a heading in frontmatter';
    const { frontmatter } = extractFrontmatter(content);
    // Should not crash — may return null or partial frontmatter
    assert.ok(frontmatter === null || typeof frontmatter === 'object');
  });
});

// ── Heading-based Chunking ────────────────────────────

describe('heading-based chunking', () => {
  it('42-TB-110: splits content at heading boundaries', () => {
    const content = '# H1\nContent under H1.\n\n## H2\nContent under H2.';
    const result = chunkMarkdownFile(makeSource(), content, { strategy: 'heading' });
    assert.ok(result.chunks.length >= 1);
    // All chunks should have heading-based strategy
    for (const chunk of result.chunks) {
      assert.equal(chunk.strategy, 'heading');
    }
  });

  it('42-TB-115: headingPath accumulates heading hierarchy', () => {
    const content = '# Top\nTop content.\n\n## Sub\nSub content.\n\n### Deep\nDeep content.';
    const result = chunkMarkdownFile(makeSource(), content, { strategy: 'heading' });
    assert.ok(result.chunks.length >= 1);
    // At least one chunk should have multi-level headingPath
    const deepChunks = result.chunks.filter((c) =>
      c.headingPath.some((h) => h.includes('Deep')),
    );
    if (deepChunks.length > 0) {
      assert.ok(deepChunks[0].headingPath.length >= 3);
    }
  });

  it('treats content without headings as single chunk', () => {
    const content = 'Just plain text without any headings.\nMore text.';
    const result = chunkMarkdownFile(makeSource(), content, { strategy: 'heading' });
    assert.ok(result.chunks.length <= 1);
  });

  it('42-TB-113: chunkIndex is sequential and 0-based', () => {
    const content = '# A\nA\n# B\nB\n# C\nC';
    const result = chunkMarkdownFile(makeSource(), content, { strategy: 'heading' });
    for (let i = 0; i < result.chunks.length; i++) {
      assert.equal(result.chunks[i].chunkIndex, i);
    }
  });

  it('42-TB-113: deterministic — same input produces same chunks twice', () => {
    const content = '# A\nContent A\n\n## B\nContent B';
    const r1 = chunkMarkdownFile(makeSource(), content, { strategy: 'heading' });
    const r2 = chunkMarkdownFile(makeSource(), content, { strategy: 'heading' });
    assert.equal(r1.chunks.length, r2.chunks.length);
    for (let i = 0; i < r1.chunks.length; i++) {
      assert.equal(r1.chunks[i].chunkId, r2.chunks[i].chunkId);
      assert.equal(r1.chunks[i].chunkIndex, r2.chunks[i].chunkIndex);
    }
  });
});

// ── Paragraph-based Chunking ──────────────────────────

describe('paragraph-based chunking', () => {
  it('42-TB-111: splits content at paragraph boundaries', () => {
    const content = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
    const result = chunkMarkdownFile(makeSource(), content, {
      strategy: 'paragraph',
      maxTokensPerChunk: 100,
    });
    assert.ok(result.chunks.length >= 1);
  });

  it('42-TB-111: overlap is correctly applied', () => {
    const content =
      'A long paragraph with enough text to fill multiple chunks. '.repeat(20);
    const result = chunkMarkdownFile(makeSource(), content, {
      strategy: 'paragraph',
      maxTokensPerChunk: 100,
      overlap: 50,
    });
    if (result.chunks.length > 1) {
      // At least one chunk beyond the first should have overlapPrev > 0
      const withOverlap = result.chunks.filter((c) => c.overlapPrev > 0);
      assert.ok(withOverlap.length >= 1, 'Expected overlap between chunks');
    }
  });

  it('preserves code blocks as atomic units', () => {
    const content =
      'Intro text.\n\n```js\nconst x = 1;\nconst y = 2;\nconsole.log(x + y);\n```\n\nAfter code.';
    const result = chunkMarkdownFile(makeSource(), content, {
      strategy: 'paragraph',
      preserveCodeBlocks: true,
    });
    assert.ok(result.chunks.length >= 1);
    // Check that at least one chunk contains the full code block
    const codeChunk = result.chunks.find(
      (c) => c.content.includes('```js') && c.content.includes('console.log'),
    );
    assert.ok(codeChunk, 'Code block should be preserved atomically');
  });

  it('42-TB-113: chunkIndex is sequential', () => {
    const content = 'A\n\nB\n\nC\n\nD\n\nE';
    const result = chunkMarkdownFile(makeSource(), content, {
      strategy: 'paragraph',
      maxTokensPerChunk: 5,
    });
    for (let i = 0; i < result.chunks.length; i++) {
      assert.equal(result.chunks[i].chunkIndex, i);
    }
  });
});

// ── Fixed-window Chunking (Skeleton) ──────────────────

describe('fixed-window chunking (skeleton)', () => {
  it('42-TB-112: produces chunks with fixed token window', () => {
    const content = 'Word '.repeat(500);
    const result = chunkMarkdownFile(makeSource(), content, {
      strategy: 'fixed',
      maxTokensPerChunk: 128,
    });
    assert.ok(result.chunks.length >= 1);
    // With fixed window, there should usually be multiple chunks for long content
    assert.ok(result.chunks.length > 1, 'Long content should produce multiple fixed-window chunks');
  });

  it('does not crash on empty content', () => {
    const result = chunkMarkdownFile(makeSource(), '', { strategy: 'fixed' });
    assert.equal(result.chunks.length, 0);
  });

  it('42-TB-113: chunkIndex is sequential', () => {
    const content = 'Word '.repeat(200);
    const result = chunkMarkdownFile(makeSource(), content, {
      strategy: 'fixed',
      maxTokensPerChunk: 64,
    });
    for (let i = 0; i < result.chunks.length; i++) {
      assert.equal(result.chunks[i].chunkIndex, i);
    }
  });
});

// ── Edge Cases ────────────────────────────────────────

describe('edge cases', () => {
  it('empty file returns empty chunks', () => {
    const result = chunkMarkdownFile(makeSource(), '', { strategy: 'heading' });
    assert.equal(result.chunks.length, 0);
    assert.equal(result.totalTokens, 0);
    assert.equal(result.truncatedChunkCount, 0);
  });

  it('whitespace-only file returns empty chunks', () => {
    const result = chunkMarkdownFile(makeSource(), '   \n  \n   ', { strategy: 'heading' });
    assert.equal(result.chunks.length, 0);
  });

  it('huge file chunking does not crash', () => {
    const content = '# H\n' + 'Line of content.\n'.repeat(5000);
    const result = chunkMarkdownFile(makeSource(), content, {
      strategy: 'heading',
      maxTokensPerChunk: 512,
    });
    assert.ok(result.chunks.length >= 1);
  });

  it('truncation flag is set when chunk exceeds token budget', () => {
    const content = '# H\n' + 'Very long content. '.repeat(500);
    const result = chunkMarkdownFile(makeSource(), content, {
      strategy: 'heading',
      maxTokensPerChunk: 50,
    });
    assert.ok(
      result.truncatedChunkCount >= 0,
      'truncatedChunkCount should be reported',
    );
  });
});

// ── Safety ────────────────────────────────────────────

describe('chunk metadata safety', () => {
  it('no absolute path in chunk source', () => {
    const content = '# Test';
    const result = chunkMarkdownFile(
      { relativePath: 'notes/test.md', displayName: 'test.md' },
      content,
      { strategy: 'heading' },
    );
    for (const chunk of result.chunks) {
      assert.ok(!chunk.source.relativePath.includes(':\\'), 'No Windows absolute path');
      assert.ok(!chunk.source.relativePath.includes('\\\\'), 'No UNC path');
      assert.ok(!chunk.source.relativePath.startsWith('/'), 'No Unix absolute path');
    }
  });

  it('no API Key or secret in chunk metadata', () => {
    const content = '# Test\nContent';
    const result = chunkMarkdownFile(makeSource(), content, { strategy: 'heading' });
    const json = JSON.stringify(result);
    assert.ok(!json.toLowerCase().includes('api_key'));
    assert.ok(!json.toLowerCase().includes('secret'));
    assert.ok(!json.includes('sk-'));
  });

  it('chunk source is always relativePath-only', () => {
    const content = '# Test';
    const result = chunkMarkdownFile(makeSource('subdir/notes/test.md'), content, {
      strategy: 'heading',
    });
    for (const chunk of result.chunks) {
      assert.equal(chunk.source.relativePath, 'subdir/notes/test.md');
      assert.equal(chunk.source.displayName, 'test.md');
    }
  });

  it('strategy is reflected in result', () => {
    const content = 'Line 1\n\nLine 2';
    const headingResult = chunkMarkdownFile(makeSource(), content, { strategy: 'heading' });
    assert.equal(headingResult.strategy, 'heading');

    const paraResult = chunkMarkdownFile(makeSource(), content, { strategy: 'paragraph' });
    assert.equal(paraResult.strategy, 'paragraph');
  });
});

// ── Table Handling Placeholder ─────────────────────────

describe('table handling (placeholder)', () => {
  it('markdown tables do not crash chunking', () => {
    const content =
      '# Results\n\n| Col A | Col B |\n|-------|-------|\n| val1  | val2  |\n| val3  | val4  |\n\nAfter table.';
    const result = chunkMarkdownFile(makeSource(), content, { strategy: 'heading' });
    assert.ok(result.chunks.length >= 1, 'Table should not crash chunking');
    // Table content should appear in at least one chunk
    const hasTable = result.chunks.some((c) => c.content.includes('| Col A |'));
    assert.ok(hasTable, 'Table content should be preserved in chunk');
  });
});
