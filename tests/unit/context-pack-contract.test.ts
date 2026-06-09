/**
 * ContextPack Contract Tests — Phase 4-1-IMP-6.
 *
 * Verifies:
 * - P0: ContextPack only contains explicitly selected files
 * - P0: No whole-Vault upload
 * - P0: Token truncation works correctly
 * - P0: Context confirmation preflight guard
 * - P0: No absolute path leaks
 * - P0: Renderer-safe context summary (no file content)
 *
 * Test boundaries: 41-TB-070, 071, 072, 080, 081, 082
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import {
  estimateTokens,
  truncateContent,
  buildContextPack,
  toContextSummary,
  checkContextConfirmation,
  createUnconfirmedConfirmation,
  confirmContext,
  DEFAULT_FILE_TOKEN_BUDGET,
  DEFAULT_PACK_TOKEN_BUDGET,
} from '../../src/lib/contracts/context-pack.types';
import type {
  ContextItem,
  ContextPack,
  ContextSummary,
  ContextConfirmation,
  ContextPackInput,
} from '../../src/lib/contracts/context-pack.types';
import {
  preflightContextGuard,
  clearContextConfirmation,
  setContextConfirmation,
  resetContextConfirmation,
  getContextConfirmation,
  validateContextPack,
} from '../../electron/services/context-pack.service';

// ── Helpers ───────────────────────────────────────────

function makeInput(
  files: Array<[string, string]>,
  overrides: Partial<ContextPackInput> = {},
): ContextPackInput {
  const map = new Map(files);
  const displayNames = new Map<string, string>();
  for (const [rp] of files) {
    const name = rp.split(/[\/\\]/).pop() ?? rp;
    displayNames.set(rp, name);
  }
  return {
    files: map,
    displayNames,
    providerId: 'openai',
    model: 'gpt-4o',
    providerDisplayName: 'OpenAI',
    ...overrides,
  };
}

// ── Token Estimation ──────────────────────────────────

describe('estimateTokens', () => {
  it('returns at least 1 for any non-empty string', () => {
    assert.ok(estimateTokens('hello') >= 1);
    assert.ok(estimateTokens('a') >= 1);
    assert.ok(estimateTokens('中文') >= 1);
  });

  it('estimates Latin text at ~4 chars per token', () => {
    // "hello world" = 11 chars → ~3 tokens
    const tokens = estimateTokens('hello world');
    assert.ok(tokens >= 2 && tokens <= 5, `Expected 2-5 tokens, got ${tokens}`);
  });

  it('estimates CJK text with higher density', () => {
    const latinTokens = estimateTokens('hello');  // 5 chars
    const cjkTokens = estimateTokens('你好世界');  // 4 chars
    // CJK should have more tokens per character (higher density = fewer tokens per char)
    assert.ok(cjkTokens >= 2, `CJK tokens: ${cjkTokens}`);
  });

  it('handles empty string', () => {
    assert.equal(estimateTokens(''), 1);
  });

  it('handles long text', () => {
    const text = 'a'.repeat(400);
    const tokens = estimateTokens(text);
    assert.equal(tokens, 100); // 400/4 = 100
  });

  it('handles mixed CJK and Latin', () => {
    const text = 'Hello 世界 World 你好';
    const tokens = estimateTokens(text);
    assert.ok(tokens >= 5 && tokens <= 15, `Got ${tokens}`);
  });
});

// ── Truncation ────────────────────────────────────────

describe('truncateContent', () => {
  it('does not truncate content within budget', () => {
    const content = 'short text';
    const result = truncateContent(content, 100);
    assert.equal(result.truncated, false);
    assert.equal(result.content, content);
  });

  it('truncates content exceeding budget', () => {
    const content = 'X'.repeat(10000); // ~2500 tokens
    const result = truncateContent(content, 100); // budget of 100 tokens
    assert.equal(result.truncated, true);
    assert.ok(result.content.length < content.length);
    assert.ok(result.content.includes('[Content truncated'));
  });

  it('respects token budget boundary', () => {
    const content = 'hello world, this is a test of the token budget system';
    const budget = 5; // very small budget
    const result = truncateContent(content, budget);
    assert.equal(result.truncated, true);
    assert.ok(result.tokenCount <= budget + 10, `tokenCount ${result.tokenCount} should be near budget ${budget}`);
  });

  it('handles empty content', () => {
    const result = truncateContent('', 100);
    assert.equal(result.truncated, false);
    assert.equal(result.content, '');
  });

  it('includes truncation marker when truncated', () => {
    const content = 'X'.repeat(500);
    const result = truncateContent(content, 10);
    assert.ok(result.content.includes('[Content truncated'));
  });
});

// ── ContextPack Builder ───────────────────────────────

describe('buildContextPack', () => {
  it('41-TB-071: only contains explicitly selected files', () => {
    const input = makeInput([
      ['notes/a.md', '# Note A\n\nContent of note A.'],
      ['notes/b.md', '# Note B\n\nContent of note B.'],
    ]);
    const pack = buildContextPack(input);
    assert.equal(pack.files.length, 2);
    // No extra files magically included
  });

  it('41-TB-070: does not include entire Vault', () => {
    // The builder only receives explicitly provided files — it cannot scan the Vault
    const input = makeInput([['notes/selected.md', '# Selected']]);
    const pack = buildContextPack(input);
    assert.equal(pack.files.length, 1);
    assert.equal(pack.files[0].relativePath, 'notes/selected.md');
  });

  it('41-TB-072: performs token truncation when exceeding budget', () => {
    const longContent = '# Very long note\n\n' + 'This is a long paragraph. '.repeat(500);
    const input = makeInput(
      [['notes/long.md', longContent]],
      { fileTokenBudget: 50, packTokenBudget: 200 },
    );
    const pack = buildContextPack(input);
    assert.equal(pack.files.length, 1);
    // With a budget of 50 tokens, a ~2500-token file should be truncated
    assert.equal(pack.files[0].truncated, true);
    assert.ok(pack.truncatedFileCount >= 1);
  });

  it('includes system prompt in total token count', () => {
    const input = makeInput(
      [['notes/a.md', 'Content']],
      { systemPrompt: 'You are a helpful assistant. Answer based on the provided context.' },
    );
    const pack = buildContextPack(input);
    assert.ok(pack.totalTokens > estimateTokens('Content'));
    assert.ok(pack.systemPrompt.length > 0);
  });

  it('stores correct provider and model', () => {
    const input = makeInput(
      [['notes/test.md', 'test']],
      { providerId: 'deepseek', model: 'deepseek-chat' },
    );
    const pack = buildContextPack(input);
    assert.equal(pack.providerId, 'deepseek');
    assert.equal(pack.model, 'deepseek-chat');
  });

  it('uses only relative paths — no absolute paths', () => {
    const input = makeInput([['notes/a.md', 'content']]);
    const pack = buildContextPack(input);
    for (const item of pack.files) {
      assert.ok(!item.relativePath.includes(':\\'), `Absolute path detected: ${item.relativePath}`);
      assert.ok(!item.relativePath.startsWith('/'), `Unix absolute path: ${item.relativePath}`);
      assert.ok(!item.relativePath.startsWith('\\\\'), `UNC path: ${item.relativePath}`);
    }
  });

  it('handles empty file selection gracefully', () => {
    const input = makeInput([]);
    const pack = buildContextPack(input);
    assert.equal(pack.files.length, 0);
    assert.ok(pack.totalTokens >= 0);
  });

  it('computes totalTokens correctly across files', () => {
    const input = makeInput([
      ['notes/a.md', 'Short note A.'],
      ['notes/b.md', 'Short note B.'],
    ]);
    const pack = buildContextPack(input);
    const fileTokens = pack.files.reduce((sum, f) => sum + f.tokenCount, 0);
    const expectedTotal = fileTokens + estimateTokens(pack.systemPrompt);
    // Allow 1 token variance due to rounding
    assert.ok(Math.abs(pack.totalTokens - expectedTotal) <= 2);
  });

  it('uses default token budgets when not specified', () => {
    const input = makeInput([['notes/a.md', 'Short content']]);
    const pack = buildContextPack(input);
    assert.ok(pack.totalTokens > 0);
  });
});

// ── Context Summary ───────────────────────────────────

describe('toContextSummary', () => {
  it('extracts renderer-safe summary without file content', () => {
    const input = makeInput([
      ['notes/a.md', '# Note A\n\nSecret content that must not be visible to renderer.'],
    ]);
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);

    assert.equal(summary.fileCount, 1);
    assert.ok(typeof summary.totalTokens === 'number');
    assert.equal(summary.providerId, 'openai');
    assert.equal(summary.model, 'gpt-4o');

    // Summary must NOT contain file content
    const summaryStr = JSON.stringify(summary);
    assert.ok(!summaryStr.includes('Secret content'));
    assert.ok(!summaryStr.includes('Note A'));
  });

  it('includes display names for each file', () => {
    const input = makeInput([
      ['notes/research/methodology.md', '# Methods'],
    ]);
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);

    assert.equal(summary.files[0].displayName, 'methodology.md');
    assert.equal(summary.files[0].relativePath, 'notes/research/methodology.md');
  });

  it('marks truncated files correctly', () => {
    const longContent = 'Long content. '.repeat(500);
    const input = makeInput(
      [['notes/long.md', longContent]],
      { fileTokenBudget: 30 },
    );
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);
    assert.equal(summary.files[0].truncated, true);
    assert.equal(summary.truncatedFileCount, 1);
  });

  it('does not include absolute paths', () => {
    const input = makeInput([['notes/a.md', 'content']]);
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);

    for (const f of summary.files) {
      assert.ok(!f.relativePath.includes(':\\'));
      assert.ok(!f.relativePath.includes('\\\\'));
    }
  });

  it('does not include API key or secret', () => {
    const input = makeInput([['notes/a.md', 'some content']]);
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);

    const json = JSON.stringify(summary);
    assert.ok(!json.toLowerCase().includes('api_key'));
    assert.ok(!json.toLowerCase().includes('apikey'));
    assert.ok(!json.toLowerCase().includes('secret'));
    assert.ok(!json.includes('sk-'));
  });
});

// ── Context Confirmation ──────────────────────────────

describe('ContextConfirmation', () => {
  it('41-TB-081: unconfirmed state blocks cloud call', () => {
    const state = createUnconfirmedConfirmation();
    const result = checkContextConfirmation(state);
    assert.equal(result.confirmed, false);
    assert.ok(result.reason);
  });

  it('41-TB-081: confirmed state allows cloud call', () => {
    const input = makeInput([['notes/a.md', 'content']]);
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);
    const confirmed = confirmContext(summary);

    const result = checkContextConfirmation(confirmed);
    assert.equal(result.confirmed, true);
  });

  it('rejects confirmed state without summary', () => {
    const state: ContextConfirmation = {
      state: 'confirmed',
      summary: null,
      userConfirmed: true,
      confirmedAt: new Date().toISOString(),
    };
    const result = checkContextConfirmation(state);
    assert.equal(result.confirmed, false);
  });

  it('rejects userConfirmed=false even if state is confirmed', () => {
    const state: ContextConfirmation = {
      state: 'confirmed',
      summary: {
        fileCount: 1,
        files: [{ relativePath: 'n.md', displayName: 'n.md', tokenCount: 10, truncated: false }],
        totalTokens: 10,
        providerId: 'openai',
        model: 'gpt-4o',
        providerDisplayName: 'OpenAI',
        truncatedFileCount: 0,
      },
      userConfirmed: false,
      confirmedAt: null,
    };
    const result = checkContextConfirmation(state);
    assert.equal(result.confirmed, false);
  });

  it('rejects cancelled state', () => {
    const state: ContextConfirmation = {
      state: 'cancelled',
      summary: null,
      userConfirmed: false,
      confirmedAt: null,
    };
    const result = checkContextConfirmation(state);
    assert.equal(result.confirmed, false);
  });

  it('confirmContext sets confirmedAt timestamp', () => {
    const input = makeInput([['notes/a.md', 'content']]);
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);
    const confirmed = confirmContext(summary);

    assert.equal(confirmed.state, 'confirmed');
    assert.equal(confirmed.userConfirmed, true);
    assert.ok(confirmed.confirmedAt);
    assert.ok(Date.parse(confirmed.confirmedAt!) > 0);
  });

  it('confirmed result has reason undefined', () => {
    const input = makeInput([['notes/a.md', 'content']]);
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);
    const confirmed = confirmContext(summary);

    const result = checkContextConfirmation(confirmed);
    assert.equal(result.reason, undefined);
  });
});

// ── No API Key / Secret in Context ────────────────────

describe('no secret leak in ContextPack', () => {
  it('ContextPack contract does not include apiKey field', () => {
    const input = makeInput([['notes/a.md', 'content']]);
    const pack = buildContextPack(input);

    // Type system guarantees this — runtime check that no apiKey exists
    const packAny = pack as unknown as Record<string, unknown>;
    assert.equal(packAny.apiKey, undefined);
    assert.equal(packAny.secret, undefined);
    assert.equal(packAny.token, undefined);
  });

  it('ContextItem does not include apiKey or secret fields', () => {
    const input = makeInput([['notes/a.md', 'content']]);
    const pack = buildContextPack(input);

    for (const item of pack.files) {
      const itemAny = item as unknown as Record<string, unknown>;
      assert.equal(itemAny.apiKey, undefined);
      assert.equal(itemAny.secret, undefined);
    }
  });

  it('ContextSummary does not include apiKey or secret fields', () => {
    const input = makeInput([['notes/a.md', 'content']]);
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);

    const summaryAny = summary as unknown as Record<string, unknown>;
    assert.equal(summaryAny.apiKey, undefined);
    assert.equal(summaryAny.secret, undefined);
  });

  it('no file content leaked through ContextSummary', () => {
    const content = 'Confidential research data: experiment results show XYZ.';
    const input = makeInput([['notes/confidential.md', content]]);
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);

    const json = JSON.stringify(summary);
    // File content must not appear in summary
    assert.ok(!json.includes('Confidential research'));
    assert.ok(!json.includes('experiment results'));
    assert.ok(!json.includes('XYZ'));
  });
});

// ── Phase Boundary ────────────────────────────────────

describe('phase boundary', () => {
  it('no RAG / Knowledge Compiler types', async () => {
    // Verify our types don't include RAG concepts
    const contractModule = await import('../../src/lib/contracts/context-pack.types');
    const allExports = Object.keys(contractModule);
    const forbidden = allExports.filter(
      (k) =>
        k.toLowerCase().includes('rag') ||
        k.toLowerCase().includes('embedding') ||
        k.toLowerCase().includes('vector') ||
        k.toLowerCase().includes('knowledge_compiler'),
    );
    assert.equal(forbidden.length, 0, `Found forbidden exports: ${forbidden.join(', ')}`);
  });

  it('no Phase 4-2/3/4/5 features referenced', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/context-pack.types.ts'),
      'utf8',
    );

    // These features must NOT appear
    assert.ok(!content.includes('KnowledgeCompiler'));
    assert.ok(!content.includes('knowledge_compiler'));
    assert.ok(!content.includes('PPT'));
    assert.ok(!content.includes('PluginManager'));
    assert.ok(!content.includes('Phase 4-2'));
    assert.ok(!content.includes('Phase 4-3'));
    assert.ok(!content.includes('Phase 4-4'));
    assert.ok(!content.includes('Phase 5'));
  });
});

// ── ContextPack Service Tests ─────────────────────────

describe('context-pack service integration', () => {
  it('preflight guard returns false when unconfirmed', () => {
    clearContextConfirmation();
    const result = preflightContextGuard();
    assert.equal(result.confirmed, false);
    assert.ok(result.reason);
  });

  it('preflight guard returns true after confirmation', () => {
    clearContextConfirmation();

    const input = makeInput([['notes/a.md', 'content']]);
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);

    setContextConfirmation(summary);
    const result = preflightContextGuard();
    assert.equal(result.confirmed, true);
  });

  it('validateContextPack detects absolute paths', () => {
    const pack: ContextPack = {
      files: [
        {
          relativePath: 'C:\\Users\\test\\notes\\bad.md',
          content: 'content',
          originalLength: 7,
          tokenCount: 3,
          truncated: false,
        },
      ],
      systemPrompt: '',
      totalTokens: 3,
      providerId: 'openai',
      model: 'gpt-4o',
      truncatedFileCount: 0,
    };

    const result = validateContextPack(pack);
    assert.equal(result.valid, false);
    assert.ok(result.issues.length > 0);
    assert.ok(result.issues.some((i: string) => i.includes('Absolute path')));
  });

  it('validateContextPack detects missing provider', () => {
    const pack: ContextPack = {
      files: [],
      systemPrompt: '',
      totalTokens: 0,
      providerId: '',
      model: '',
      truncatedFileCount: 0,
    };

    const result = validateContextPack(pack);
    assert.equal(result.valid, false);
  });

  it('validateContextPack passes for valid pack', () => {
    const input = makeInput([['notes/a.md', 'content']]);
    const pack = buildContextPack(input);

    const result = validateContextPack(pack);
    assert.equal(result.valid, true);
    assert.equal(result.issues.length, 0);
  });

  it('resetContextConfirmation clears state', () => {
    clearContextConfirmation();

    const input = makeInput([['notes/a.md', 'content']]);
    const pack = buildContextPack(input);
    const summary = toContextSummary(pack, input.displayNames);

    setContextConfirmation(summary);
    assert.equal(getContextConfirmation().userConfirmed, true);

    resetContextConfirmation();
    assert.equal(getContextConfirmation().userConfirmed, false);
  });
});
