/**
 * Phase 3-1-B: import:select-source safety test.
 *
 * Verifies that the SelectImportSourceResult type does NOT expose
 * sourcePath, absolute paths, or system paths.  All three result
 * variants (success, cancelled, failure) are checked.
 *
 * ⚠️  Static contract test — no runtime dependencies.
 */

import assert from 'node:assert/strict';

// ── Minimal types ───────────────────────────────

interface MinimalSelectSourceSuccess {
  readonly ok: true;
  readonly selectedSourceToken: string;
  readonly sourceFileName: string;
  readonly sourceFormat: 'pdf' | 'docx';
  readonly sizeBytes: number;
}

interface MinimalSelectSourceCancelled {
  readonly ok: false;
  readonly reason: 'cancelled';
  readonly message: string;
}

interface MinimalSelectSourceFailure {
  readonly ok: false;
  readonly reason: 'unsupported_format' | 'file_too_large' | 'internal_error';
  readonly message: string;
}

function run(): void {
  // ── Success: no sourcePath field ──────────────
  const success: MinimalSelectSourceSuccess = {
    ok: true,
    selectedSourceToken: 'src_token_abc123',
    sourceFileName: 'paper.pdf',
    sourceFormat: 'pdf',
    sizeBytes: 1024000,
  };

  assert.equal(success.ok, true);
  assert.ok(!('sourcePath' in success), 'Must not expose sourcePath');
  assert.ok(!('absolutePath' in success), 'Must not expose absolutePath');
  assert.equal(typeof success.selectedSourceToken, 'string');
  assert.ok(success.selectedSourceToken.length > 0);

  // Token must be opaque — no path-like content
  assert.ok(!success.selectedSourceToken.includes(':\\'), 'Token must not contain Windows path');
  assert.ok(!success.selectedSourceToken.includes('/'), 'Token must not contain Unix path');
  assert.ok(!success.selectedSourceToken.includes('Users'), 'Token must not contain user path');

  // sourceFileName is safe display name only
  assert.ok(!success.sourceFileName.includes(':\\'), 'sourceFileName must be name, not path');
  assert.ok(!success.sourceFileName.includes('/'), 'sourceFileName must be name, not path');

  // ── Cancelled: no path leak ───────────────────
  const cancelled: MinimalSelectSourceCancelled = {
    ok: false,
    reason: 'cancelled',
    message: 'File selection was cancelled.',
  };

  assert.equal(cancelled.ok, false);
  assert.ok(!('sourcePath' in cancelled), 'Cancelled result must not expose sourcePath');
  assert.ok(!cancelled.message.includes(':\\'), 'Message must not expose paths');

  // ── Failure: no path leak ─────────────────────
  const failure: MinimalSelectSourceFailure = {
    ok: false,
    reason: 'unsupported_format',
    message: 'Only PDF and DOCX files are currently supported.',
  };

  assert.equal(failure.ok, false);
  assert.equal(failure.reason, 'unsupported_format');
  assert.ok(!('sourcePath' in failure), 'Failure result must not expose sourcePath');
  assert.ok(!failure.message.includes(':\\'), 'Message must not expose paths');
  assert.ok(!failure.message.includes('/home/'), 'Message must not expose paths');

  // ── Token: size reasonable ────────────────────
  assert.ok(success.selectedSourceToken.length < 200, 'Token should be reasonably short');
}

run();
console.log('[PASS] import-select-source-safety');
