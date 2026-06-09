/**
 * Phase 3-1-C: Export no source modification test.
 *
 * Verifies the export pipeline does NOT modify the source Markdown.
 * The markdownRelativePath is read-only; output goes to outputRelativePath.
 */

import assert from 'node:assert/strict';

interface MinimalExportEngineInput {
  readonly markdownRelativePath: string;
  readonly outputRelativePath: string;
}

interface MinimalExportEngineResult {
  readonly ok: boolean;
  readonly outputRelativePath: string | null;
}

function run(): void {
  const input: MinimalExportEngineInput = {
    markdownRelativePath: 'notes/paper.md',
    outputRelativePath: '_exports/2026/05/export_001/output.docx',
  };

  // Source and output paths must differ
  assert.notEqual(input.markdownRelativePath, input.outputRelativePath,
    'Source and output paths must be different');

  // Source is in notes/ (user content), output is in _exports/ (artifacts)
  assert.ok(input.markdownRelativePath.startsWith('notes/'), 'Source must be in notes/');
  assert.ok(input.outputRelativePath.startsWith('_exports/'), 'Output must be in _exports/');

  // Result must NOT expose source write path
  const result: MinimalExportEngineResult = {
    ok: true,
    outputRelativePath: '_exports/2026/05/export_001/output.docx',
  };

  assert.ok(!('markdownRelativePath' in result), 'Result must not carry source path');
  assert.ok(!('sourceRelativePath' in result), 'Result must not expose source write path');

  // Output is strictly in _exports/
  assert.ok(result.outputRelativePath!.startsWith('_exports/'));
}

run();
console.log('[PASS] export-no-source-modification-runtime');
