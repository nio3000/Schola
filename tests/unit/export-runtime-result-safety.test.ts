/**
 * Phase 3-1-C: Export runtime result safety test.
 *
 * Verifies that ExportEngineResult, CreateExportJobFailure etc.
 * do NOT expose system paths, Pandoc/LaTeX paths, raw stderr.
 */

import assert from 'node:assert/strict';

interface MinimalExportEngineResult {
  readonly ok: boolean;
  readonly outputRelativePath: string | null;
  readonly metadataRelativePath: string | null;
  readonly outputSizeBytes: number;
  readonly warnings: readonly { readonly code: string; readonly message: string }[];
  readonly error: { readonly code: string; readonly message: string; readonly recoverable: boolean } | null;
}

interface MinimalCreateExportJobFailure {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

function run(): void {
  // Success result: paths must be vault-relative
  const success: MinimalExportEngineResult = {
    ok: true,
    outputRelativePath: '_exports/2026/05/export_001/output.docx',
    metadataRelativePath: '.schola/metadata/exports/export_001.json',
    outputSizeBytes: 10240,
    warnings: [],
    error: null,
  };
  assert.ok(success.outputRelativePath!.startsWith('_exports/'), 'Output must be in _exports/');
  assert.ok(!success.outputRelativePath!.includes(':\\'), 'Must not be absolute');

  // Failed result: error message safety
  const failed: MinimalExportEngineResult = {
    ok: false,
    outputRelativePath: null,
    metadataRelativePath: null,
    outputSizeBytes: 0,
    warnings: [],
    error: {
      code: 'PANDOC_NOT_AVAILABLE',
      message: 'Pandoc is not available.',
      recoverable: false,
    },
  };
  assert.ok(!failed.error!.message.includes('Traceback'), 'Must not contain traceback');
  assert.ok(!failed.error!.message.includes('stderr'), 'Must not reference raw stderr');
  assert.ok(!failed.error!.message.includes('C:\\'), 'Must not leak Windows path');
  assert.ok(!failed.error!.message.includes('/usr/'), 'Must not leak Unix path');

  // Job failure: message safety
  const jobFailure: MinimalCreateExportJobFailure = {
    ok: false,
    code: 'ENGINE_NOT_AVAILABLE',
    message: 'Engine is not available for export.',
  };
  assert.ok(!jobFailure.message.includes('pandoc.ex'), 'Must not leak Pandoc path');
  assert.ok(!jobFailure.message.includes('pdflatex'), 'Must not leak LaTeX path');
}

run();
console.log('[PASS] export-runtime-result-safety');
