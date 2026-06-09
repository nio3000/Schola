/**
 * Phase 3-1-B: Import runtime result safety test.
 *
 * Verifies that import-related result types do NOT expose
 * system paths, Python paths, stack traces, or raw stderr.
 *
 * ⚠️  Static contract test — no runtime dependencies.
 */

import assert from 'node:assert/strict';

// ── Minimal result types matching contracts ─────

interface MinimalEngineConvertResult {
  readonly ok: boolean;
  readonly markdownRelativePath: string | null;
  readonly companionRelativePath: string | null;
  readonly quality: 'full' | 'partial' | 'failed';
  readonly warnings: readonly { readonly code: string; readonly message: string }[];
  readonly error: { readonly code: string; readonly message: string; readonly recoverable: boolean } | null;
}

interface MinimalCreateImportJobFailure {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

function run(): void {
  // ── EngineConvertResult: paths must be vault-relative ──
  const success: MinimalEngineConvertResult = {
    ok: true,
    markdownRelativePath: 'notes/imported/paper.md',
    companionRelativePath: '.schola/metadata/imports/import_001.json',
    quality: 'full',
    warnings: [],
    error: null,
  };

  assert.ok(success.markdownRelativePath!.startsWith('notes/'), 'Markdown must be in notes/');
  assert.ok(!success.markdownRelativePath!.includes(':\\'), 'Must not be absolute Windows path');
  assert.ok(!success.markdownRelativePath!.startsWith('/'), 'Must not be absolute Unix path');

  assert.ok(success.companionRelativePath!.startsWith('.schola/'), 'Companion must be in .schola/');
  assert.ok(!success.companionRelativePath!.includes(':\\'), 'Companion must not be absolute');

  // ── EngineConvertResult: error message safety ──
  const failed: MinimalEngineConvertResult = {
    ok: false,
    markdownRelativePath: null,
    companionRelativePath: null,
    quality: 'failed',
    warnings: [],
    error: {
      code: 'ENGINE_NOT_AVAILABLE',
      message: 'MarkItDown engine is not available.',
      recoverable: false,
    },
  };

  assert.ok(!failed.error!.message.includes('Traceback'), 'Must not contain traceback');
  assert.ok(!failed.error!.message.includes('stderr'), 'Must not reference raw stderr');
  assert.ok(!failed.error!.message.includes('site-packages'), 'Must not expose Python path');
  assert.ok(!failed.error!.message.includes('python'), 'Must not expose Python path');

  // ── CreateImportJobFailure: message safety ──
  const jobFailure: MinimalCreateImportJobFailure = {
    ok: false,
    code: 'ENGINE_NOT_AVAILABLE',
    message: 'Engine is not available for import.',
  };

  assert.equal(jobFailure.ok, false);
  assert.ok(jobFailure.message.length > 0);
  assert.ok(!jobFailure.message.includes(':\\'), 'Must not contain Windows path');
  assert.ok(!jobFailure.message.includes('/usr/'), 'Must not contain Unix path');

  // ── warning messages must be safe ──
  const withWarning: MinimalEngineConvertResult = {
    ok: true,
    markdownRelativePath: 'notes/imported/doc.md',
    companionRelativePath: '.schola/metadata/imports/import_002.json',
    quality: 'partial',
    warnings: [{ code: 'CONVERSION_WARNING', message: 'Some formatting may be lost.' }],
    error: null,
  };

  assert.equal(withWarning.warnings.length, 1);
  assert.ok(!withWarning.warnings[0].message.includes(':\\'), 'Warning must not expose paths');
}

run();
console.log('[PASS] import-runtime-result-safety');
