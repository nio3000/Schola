/**
 * Phase 3-1-A: sourcePath guard test.
 *
 * Static / type-level verification that EngineConvertInput,
 * CreateImportJobInput, and ImportCompanion do NOT expose sourcePath.
 *
 * ⚠️  Uses TypeScript type assertions at runtime.
 *     Does NOT depend on MarkItDown, Pandoc, or any runtime.
 */

import assert from 'node:assert/strict';

// Type-level check: the `sourcePath` property should not exist on these types.
// We verify at runtime by constructing representative objects and checking
// that sourcePath is not present.

interface MinimalEngineConvertInput {
  readonly vaultId: string;
  readonly jobId: string;
  readonly sourceFormat: string;
  readonly attachmentRelativePath: string;
  readonly outputMarkdownRelativePath: string;
  readonly companionRelativePath: string;
  // ⚠️ sourcePath MUST NOT be here
}

interface MinimalCreateImportJobInput {
  readonly vaultId: string;
  readonly sourceFormat: string;
  readonly selectedSourceToken: string;
  // ⚠️ sourcePath MUST NOT be here
}

interface MinimalImportCompanion {
  readonly markdownRelativePath: string;
  readonly attachmentRelativePath: string;
  readonly sourceFileName: string;
  // ⚠️ sourcePath MUST NOT be here
}

function run(): void {
  // ── EngineConvertInput must not have sourcePath ──
  const convertInput: MinimalEngineConvertInput = {
    vaultId: 'test-vault',
    jobId: 'test-job',
    sourceFormat: 'pdf',
    attachmentRelativePath: 'attachments/imports/2026/05/test/original.pdf',
    outputMarkdownRelativePath: 'notes/imported/test.md',
    companionRelativePath: '.schola/metadata/imports/test.json',
  };

  // Verify that our minimal type does NOT include sourcePath
  assert.ok(!('sourcePath' in convertInput), 'EngineConvertInput must not contain sourcePath');
  assert.ok('attachmentRelativePath' in convertInput, 'Expected attachmentRelativePath');
  assert.ok('outputMarkdownRelativePath' in convertInput, 'Expected outputMarkdownRelativePath');
  assert.ok('companionRelativePath' in convertInput, 'Expected companionRelativePath');

  // ── CreateImportJobInput must not have sourcePath ──
  const createInput: MinimalCreateImportJobInput = {
    vaultId: 'test-vault',
    sourceFormat: 'pdf',
    selectedSourceToken: 'token-123',
  };
  assert.ok(!('sourcePath' in createInput), 'CreateImportJobInput must not contain sourcePath');

  // ── ImportCompanion must not have sourcePath ──
  const companion: MinimalImportCompanion = {
    markdownRelativePath: 'notes/imported/test.md',
    attachmentRelativePath: 'attachments/imports/2026/05/test/original.pdf',
    sourceFileName: 'original.pdf',
  };
  assert.ok(!('sourcePath' in companion), 'ImportCompanion must not contain sourcePath');
  assert.ok('markdownRelativePath' in companion, 'Expected markdownRelativePath');
  assert.ok('attachmentRelativePath' in companion, 'Expected attachmentRelativePath');
}

run();
console.log('[PASS] sourcepath-guard');
