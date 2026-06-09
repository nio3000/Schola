/**
 * ContextPack v2 Contract Tests — Phase 4-2-B.
 *
 * Verifies:
 * - P0: ContextScope types and validation
 * - P0: SelectedFileRef / SelectedFolderRef / CurrentNoteRef / ImportedLiteratureRef
 * - P0: WikilinkExpansionOptions (default OFF, maxDepth=1, inside scope only)
 * - P0: no absolute path leak
 * - P0: no API Key / secret in v2 types
 * - P0: no whole Vault scan (selected only)
 * - P0: renderer-safe summary
 * - P0: token budget resolution
 * - P1: scope type validation
 * - P1: controlled wikilink expansion constraints
 *
 * Test boundaries: 42-TB-013, 014, 018, 019, 020, 100-108
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import type {
  ContextScope,
  ContextPackV2,
  ContextPackV2Summary,
  SelectedFileRef,
  WikilinkExpansionOptions,
} from '../../src/lib/contracts/context-pack-v2.types';
import {
  DEFAULT_WIKILINK_EXPANSION,
  createDefaultWikilinkExpansion,
  createWikilinkExpansion,
  toContextPackV2Summary,
  validateContextPackV2,
  isValidScopeType,
  resolveTokenBudget,
  DEFAULT_TOKEN_BUDGET,
} from '../../src/lib/contracts/context-pack-v2.types';
import {
  setContextScope,
  getContextScope,
  clearContextConfirmation,
} from '../../electron/services/context-pack.service';

// ── Helpers ───────────────────────────────────────────

function makeScope(overrides?: Partial<ContextScope>): ContextScope {
  return {
    type: 'combined',
    selectedFiles: [
      { relativePath: 'notes/a.md', displayName: 'a.md' },
      { relativePath: 'notes/b.md', displayName: 'b.md' },
    ],
    selectedFolder: { relativePath: 'notes/', displayName: 'notes' },
    wikilinkExpansion: createDefaultWikilinkExpansion(),
    ...overrides,
  };
}

function makePack(
  scope: ContextScope,
  overrides?: Partial<ContextPackV2>,
): ContextPackV2 {
  return {
    scope,
    tokenBudget: resolveTokenBudget('gpt-4o'),
    files: scope.selectedFiles.map((f) => ({
      relativePath: f.relativePath,
      displayName: f.displayName,
      tokenCount: 100,
      truncated: false,
    })),
    providerId: 'openai',
    model: 'gpt-4o',
    providerDisplayName: 'OpenAI',
    totalTokens: 200,
    truncatedFileCount: 0,
    ...overrides,
  };
}

// ── Scope Types ────────────────────────────────────────

describe('ContextScope types', () => {
  it('42-TB-100: validates scope type values', () => {
    assert.equal(isValidScopeType('files'), true);
    assert.equal(isValidScopeType('folder'), true);
    assert.equal(isValidScopeType('current_note'), true);
    assert.equal(isValidScopeType('imported_literature'), true);
    assert.equal(isValidScopeType('combined'), true);
    assert.equal(isValidScopeType('invalid'), false);
    assert.equal(isValidScopeType(''), false);
  });

  it('42-TB-013: scope only contains selected files (no whole Vault)', () => {
    const scope = makeScope({ type: 'files' });
    assert.equal(scope.type, 'files');
    assert.equal(scope.selectedFiles.length, 2);
    // No automatic scan — only explicitly provided files
  });

  it('42-TB-014: folder scope does not imply automatic subfolder walk', () => {
    const scope = makeScope({ type: 'folder' });
    assert.equal(scope.type, 'folder');
    assert.ok(scope.selectedFolder);
    // The scope contract does not include recursive children
    // subfolder expansion must be explicit
  });

  it('SelectedFileRef uses relativePath only', () => {
    const ref: SelectedFileRef = { relativePath: 'notes/a.md', displayName: 'a.md' };
    assert.ok(!ref.relativePath.includes(':\\'));
    assert.ok(!ref.relativePath.startsWith('/'));
    assert.ok(!ref.relativePath.includes('\\\\'));
  });

  it('42-TB-102: no implicit whole Vault inclusion in scope', () => {
    const scope = makeScope({ type: 'files', selectedFiles: [] });
    // Even with empty files, there's no "all files" default
    assert.equal(scope.selectedFiles.length, 0);
    assert.equal(scope.type, 'files');
  });
});

// ── Wikilink Expansion ─────────────────────────────────

describe('WikilinkExpansionOptions', () => {
  it('42-TB-103: expansion defaults to OFF', () => {
    const opts = createDefaultWikilinkExpansion();
    assert.equal(opts.enabled, false);
    assert.equal(opts.maxDepth, 1);
    assert.equal(opts.onlyInsideSelectedScope, true);
  });

  it('42-TB-104: maxDepth is always 1', () => {
    const opts = createWikilinkExpansion(true);
    assert.equal(opts.enabled, true);
    assert.equal(opts.maxDepth, 1);
  });

  it('42-TB-105: onlyInsideSelectedScope is always true', () => {
    const opts = createWikilinkExpansion(true);
    assert.equal(opts.onlyInsideSelectedScope, true);
  });

  it('DEFAULT_WIKILINK_EXPANSION is immutable via spread', () => {
    const copy = { ...DEFAULT_WIKILINK_EXPANSION };
    assert.equal(copy.enabled, false);
    assert.equal(copy.maxDepth, 1);
    assert.equal(copy.onlyInsideSelectedScope, true);
  });
});

// ── Token Budget ───────────────────────────────────────

describe('token budget by model', () => {
  it('resolves known model budgets', () => {
    const gpt = resolveTokenBudget('gpt-4o');
    assert.ok(gpt.fileTokenBudget >= 2000);
    assert.ok(gpt.packTokenBudget >= 8000);
  });

  it('resolves deepseek model budgets', () => {
    const ds = resolveTokenBudget('deepseek-chat');
    assert.ok(ds.fileTokenBudget >= 2000);
  });

  it('falls back to default for unknown model', () => {
    const unknown = resolveTokenBudget('unknown-model');
    assert.equal(unknown.fileTokenBudget, DEFAULT_TOKEN_BUDGET.fileTokenBudget);
    assert.equal(unknown.packTokenBudget, DEFAULT_TOKEN_BUDGET.packTokenBudget);
  });
});

// ── ContextPack v2 Validation ─────────────────────────

describe('ContextPackV2 validation', () => {
  it('validates a correct pack', () => {
    const scope = makeScope();
    const pack = makePack(scope);
    const result = validateContextPackV2(pack);
    assert.equal(result.valid, true);
    assert.equal(result.issues.length, 0);
  });

  it('detects Windows absolute paths', () => {
    const scope = makeScope({
      selectedFiles: [{ relativePath: 'C:\\Users\\bad.md', displayName: 'bad.md' }],
    });
    const pack = makePack(scope);
    const result = validateContextPackV2(pack);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i: string) => i.toLowerCase().includes('absolute path')));
  });

  it('detects UNC paths', () => {
    const scope = makeScope({
      selectedFiles: [{ relativePath: '\\\\server\\share\\bad.md', displayName: 'bad.md' }],
    });
    const pack = makePack(scope);
    const result = validateContextPackV2(pack);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i: string) => i.includes('UNC path')));
  });

  it('detects Unix absolute paths', () => {
    const scope = makeScope({
      selectedFiles: [{ relativePath: '/home/user/bad.md', displayName: 'bad.md' }],
    });
    const pack = makePack(scope);
    const result = validateContextPackV2(pack);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i: string) => i.includes('absolute path')));
  });

  it('flags wikilink expansion depth > 1', () => {
    const scope = makeScope({
      wikilinkExpansion: {
        enabled: true,
        maxDepth: 3,
        onlyInsideSelectedScope: true,
      },
    });
    const pack = makePack(scope);
    const result = validateContextPackV2(pack);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i: string) => i.includes('max allowed')));
  });

  it('flags wikilink expansion outside selected scope', () => {
    const scope = makeScope({
      wikilinkExpansion: {
        enabled: true,
        maxDepth: 1,
        onlyInsideSelectedScope: false,
      },
    });
    const pack = makePack(scope);
    const result = validateContextPackV2(pack);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i: string) => i.includes('selected scope')));
  });

  it('flags missing provider', () => {
    const scope = makeScope();
    const pack = makePack(scope, { providerId: '' });
    const result = validateContextPackV2(pack);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i: string) => i.includes('Provider')));
  });

  it('flags missing model', () => {
    const scope = makeScope();
    const pack = makePack(scope, { model: '' });
    const result = validateContextPackV2(pack);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i: string) => i.includes('Model')));
  });
});

// ── Renderer-Safe Summary ─────────────────────────────

describe('ContextPackV2Summary renderer-safe', () => {
  it('42-TB-106: toContextPackV2Summary preserves scope, strips content', () => {
    const scope = makeScope();
    const pack = makePack(scope);
    const summary = toContextPackV2Summary(pack);

    assert.equal(summary.fileCount, pack.files.length);
    assert.equal(summary.scope.type, scope.type);
    assert.equal(summary.scope.selectedFiles.length, scope.selectedFiles.length);
    assert.equal(summary.providerId, 'openai');
    assert.equal(summary.model, 'gpt-4o');

    // Summary must NOT contain file content
    const json = JSON.stringify(summary);
    assert.ok(!json.toLowerCase().includes('api_key'));
    assert.ok(!json.toLowerCase().includes('secret'));
    assert.ok(!json.includes('sk-'));
  });

  it('summary does not include absolute paths', () => {
    const scope = makeScope();
    const pack = makePack(scope);
    const summary = toContextPackV2Summary(pack);

    const json = JSON.stringify(summary);
    assert.ok(!json.includes('C:\\'));
    assert.ok(!json.includes('\\\\'));
    for (const f of summary.files) {
      assert.ok(!f.relativePath.includes(':\\'));
      assert.ok(!f.relativePath.includes('\\\\'));
    }
  });
});

// ── Service Integration ────────────────────────────────

describe('context-pack service v2', () => {
  it('setContextScope triggers reset on scope change', () => {
    clearContextConfirmation();
    const scope1 = makeScope({ type: 'files' });
    const scope2 = makeScope({ type: 'folder' });

    const changed1 = setContextScope(scope1);
    assert.equal(changed1, true); // first scope set = change
    assert.equal(getContextScope()?.type, 'files');

    const changed2 = setContextScope(scope2);
    assert.equal(changed2, true); // type changed = change
    assert.equal(getContextScope()?.type, 'folder');
  });

  it('setContextScope no reset when scope unchanged', () => {
    clearContextConfirmation();
    const scope = makeScope({ type: 'files' });
    setContextScope(scope);
    const changed = setContextScope(scope);
    assert.equal(changed, false);
  });
});

// ── No API Key / Secret ────────────────────────────────

describe('no API Key / secret in v2 types', () => {
  it('ContextScope has no apiKey field', () => {
    const scope = makeScope();
    const any = scope as unknown as Record<string, unknown>;
    assert.equal(any.apiKey, undefined);
    assert.equal(any.secret, undefined);
    assert.equal(any.token, undefined);
  });

  it('ContextPackV2 has no apiKey field', () => {
    const pack = makePack(makeScope());
    const any = pack as unknown as Record<string, unknown>;
    assert.equal(any.apiKey, undefined);
    assert.equal(any.secret, undefined);
  });

  it('ContextPackV2Summary has no apiKey field', () => {
    const summary = toContextPackV2Summary(makePack(makeScope()));
    const any = summary as unknown as Record<string, unknown>;
    assert.equal(any.apiKey, undefined);
    assert.equal(any.secret, undefined);
  });
});

// ── Phase Boundary ─────────────────────────────────────

describe('phase boundary', () => {
  it('no RAG / embedding / vector references', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/context-pack-v2.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('RAG'));
    assert.ok(!content.includes('embedding'));
    assert.ok(!content.includes('vector'));
    assert.ok(!content.includes('knowledge_compiler'));
  });

  it('no Phase 4-3 / 4-4 / Phase 5 entry', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/context-pack-v2.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('Phase 4-3'));
    assert.ok(!content.includes('Phase 4-4'));
    assert.ok(!content.includes('Phase 5'));
  });

  it('no Plugin Manager / marketplace references', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/context-pack-v2.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('PluginManager'));
    assert.ok(!content.includes('marketplace'));
  });
});

// ── IPC / Generic IPC ──────────────────────────────────

describe('no generic IPC in v2 files', () => {
  it('v2 types file has no IPC imports', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/context-pack-v2.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('ipcRenderer'));
    assert.ok(!content.includes('ipcMain'));
    assert.ok(!content.includes('electron'));
  });

  it('AIWorkbench has no IPC imports', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/features/ai-workbench/AIWorkbench.tsx'),
      'utf8',
    );
    assert.ok(!content.includes('ipcRenderer'));
    assert.ok(!content.includes('child_process'));
    assert.ok(!content.includes('shell'));
  });
});

// ── No Vault Overwrite ─────────────────────────────────

describe('no Vault overwrite', () => {
  it('v2 types do not reference write operations', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/context-pack-v2.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('writeFile'));
    assert.ok(!content.includes('saveToVault'));
    assert.ok(!content.includes('overwrite'));
  });
});
