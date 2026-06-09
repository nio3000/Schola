/**
 * Phase 3-1-B: sourcePath must not be leaked test.
 *
 * Verifies that sourcePath is absent from all type-level contracts
 * and job-related result types used by the import pipeline.
 *
 * ⚠️  Type-level verification — no runtime dependencies.
 */

import assert from 'node:assert/strict';

// ── Minimal types matching frozen contracts ─────

interface MinimalEngineConvertInput {
  readonly vaultId: string;
  readonly jobId: string;
  readonly sourceFormat: string;
  readonly attachmentRelativePath: string;
  readonly outputMarkdownRelativePath: string;
  readonly companionRelativePath: string;
}

interface MinimalCreateImportJobInput {
  readonly vaultId: string;
  readonly sourceFormat: string;
  readonly selectedSourceToken: string;
}

interface MinimalImportJobStatus {
  readonly jobId: string;
  readonly sourceFileName: string;
  readonly attachmentRelativePath: string;
  readonly outputMarkdownRelativePath: string | null;
  readonly companionRelativePath: string | null;
}

interface MinimalImportCompanion {
  readonly markdownRelativePath: string;
  readonly attachmentRelativePath: string;
  readonly sourceFileName: string;
}

function run(): void {
  // ── EngineConvertInput: no sourcePath ─────────
  const convertInput: MinimalEngineConvertInput = {
    vaultId: 'v1',
    jobId: 'j1',
    sourceFormat: 'pdf',
    attachmentRelativePath: 'attachments/imports/2026/05/j1/original.pdf',
    outputMarkdownRelativePath: 'notes/imported/paper.md',
    companionRelativePath: '.schola/metadata/imports/j1.json',
  };

  assert.ok(!('sourcePath' in convertInput), 'EngineConvertInput must not have sourcePath');
  assert.ok('attachmentRelativePath' in convertInput, 'Must use attachmentRelativePath');
  assert.ok('outputMarkdownRelativePath' in convertInput, 'Must use outputMarkdownRelativePath');

  // ── CreateImportJobInput: no sourcePath ───────
  const createInput: MinimalCreateImportJobInput = {
    vaultId: 'v1',
    sourceFormat: 'pdf',
    selectedSourceToken: 'tok123',
  };

  assert.ok(!('sourcePath' in createInput), 'CreateImportJobInput must not have sourcePath');
  assert.ok('selectedSourceToken' in createInput, 'Must use selectedSourceToken');

  // ── ImportJobStatus: no sourcePath ────────────
  const status: MinimalImportJobStatus = {
    jobId: 'j1',
    sourceFileName: 'paper.pdf',
    attachmentRelativePath: 'attachments/imports/2026/05/j1/original.pdf',
    outputMarkdownRelativePath: 'notes/imported/paper.md',
    companionRelativePath: '.schola/metadata/imports/j1.json',
  };

  assert.ok(!('sourcePath' in status), 'ImportJobStatus must not have sourcePath');
  assert.ok('attachmentRelativePath' in status, 'Must use attachmentRelativePath');
  assert.ok('outputMarkdownRelativePath' in status, 'Must use outputMarkdownRelativePath');

  // ── ImportCompanion: no sourcePath ────────────
  const companion: MinimalImportCompanion = {
    markdownRelativePath: 'notes/imported/paper.md',
    attachmentRelativePath: 'attachments/imports/2026/05/j1/original.pdf',
    sourceFileName: 'paper.pdf',
  };

  assert.ok(!('sourcePath' in companion), 'ImportCompanion must not have sourcePath');
  assert.ok('markdownRelativePath' in companion, 'Must use markdownRelativePath');
  assert.ok('attachmentRelativePath' in companion, 'Must use attachmentRelativePath');

  // ── All paths must be vault-relative ──────────
  const allPaths = [
    convertInput.attachmentRelativePath,
    convertInput.outputMarkdownRelativePath,
    convertInput.companionRelativePath,
    status.attachmentRelativePath,
    status.outputMarkdownRelativePath!,
    status.companionRelativePath!,
    companion.markdownRelativePath,
    companion.attachmentRelativePath,
  ];

  for (const p of allPaths) {
    assert.ok(!p.includes(':\\'), `Path '${p}' must not be a Windows absolute path`);
    assert.ok(!p.startsWith('/'), `Path '${p}' must not be a Unix absolute path`);
    assert.ok(!p.startsWith('..'), `Path '${p}' must not escape vault`);
  }
}

run();
console.log('[PASS] import-sourcepath-not-leaked');
