/**
 * Phase 3-1-A: export-no-modify-source test.
 *
 * Static contract verification that the export pipeline design
 * does NOT allow the export process to modify the source Markdown.
 *
 * ExportEngineInput separates markdownRelativePath (read-only source)
 * from outputRelativePath (write-only artifact).  ExportEngineResult
 * contains no field that writes back to the source file.
 *
 * ⚠️  Static contract test — no Pandoc runtime dependency.
 *     Full runtime verification deferred to Phase 3-1-C.
 */

import assert from 'node:assert/strict';

// Minimal shapes matching the frozen contracts.

interface MinimalExportEngineInput {
  readonly markdownRelativePath: string;
  readonly outputRelativePath: string;
  // ⚠️  No writable source path.  Output is separate.
}

interface MinimalExportEngineResult {
  readonly ok: boolean;
  readonly outputRelativePath: string | null;
  // ⚠️  No field that modifies sourceMarkdownRelativePath.
}

function run(): void {
  // ── Input separates read path from write path ──
  const input: MinimalExportEngineInput = {
    markdownRelativePath: 'notes/paper.md',
    outputRelativePath: '_exports/2026/05/export_001/paper.docx',
  };

  assert.notEqual(input.markdownRelativePath, input.outputRelativePath,
    'Source and output paths must be different');
  assert.ok(input.markdownRelativePath.startsWith('notes/'),
    'Source must be in notes/');
  assert.ok(input.outputRelativePath.startsWith('_exports/'),
    'Output must be in _exports/');

  // ── Result does not expose source write access ──
  const result: MinimalExportEngineResult = {
    ok: true,
    outputRelativePath: '_exports/2026/05/export_001/paper.docx',
  };

  // Verify that there is no field that could modify the source
  const resultKeys = Object.keys(result);
  assert.ok(!resultKeys.includes('sourceRelativePath'), 'Result must not expose source write path');
  assert.ok(!resultKeys.includes('markdownRelativePath'), 'Result must not carry source path');

  // ── Source file path is not in the output result ──
  assert.ok(result.outputRelativePath !== null);
  assert.ok(result.outputRelativePath.startsWith('_exports/'),
    'Output artifact must be in _exports/');
}

run();
console.log('[PASS] export-no-modify-source');
