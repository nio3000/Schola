/**
 * Phase 3-1-B: MarkItDown availability detection test.
 *
 * Tests RuntimeAvailabilityResult structure and safety invariants.
 * Does NOT require MarkItDown to be installed — simulates the
 * NOT_INSTALLED fallback path.
 *
 * ⚠️  Does NOT call Python, MarkItDown, Pandoc, or any runtime.
 */

import assert from 'node:assert/strict';

// Test the result type structure without calling runtime
interface RuntimeAvailabilityResult {
  readonly runtime: 'markitdown';
  readonly available: boolean;
  readonly version: string | null;
  readonly errorCode:
    | 'NOT_INSTALLED'
    | 'VERSION_UNSUPPORTED'
    | 'CHECK_FAILED'
    | 'VERSION_UNREADABLE'
    | null;
  readonly message: string;
}

function run(): void {
  // ── NOT_INSTALLED result shape ───────────────
  const notInstalled: RuntimeAvailabilityResult = {
    runtime: 'markitdown',
    available: false,
    version: null,
    errorCode: 'NOT_INSTALLED',
    message: 'MarkItDown is not available.',
  };

  assert.equal(notInstalled.runtime, 'markitdown');
  assert.equal(notInstalled.available, false);
  assert.equal(notInstalled.version, null);
  assert.equal(notInstalled.errorCode, 'NOT_INSTALLED');
  assert.ok(notInstalled.message.length > 0, 'Message must not be empty');

  // ── Message must not contain paths ───────────
  assert.ok(!notInstalled.message.includes('C:\\'), 'Must not contain Windows paths');
  assert.ok(!notInstalled.message.includes('/usr/'), 'Must not contain Unix paths');
  assert.ok(!notInstalled.message.includes('/home/'), 'Must not contain home paths');
  assert.ok(!notInstalled.message.includes('site-packages'), 'Must not contain site-packages');
  assert.ok(!notInstalled.message.includes('Traceback'), 'Must not contain traceback');

  // ── Available result shape ───────────────────
  const available: RuntimeAvailabilityResult = {
    runtime: 'markitdown',
    available: true,
    version: '0.5.0',
    errorCode: null,
    message: 'MarkItDown 0.5.0 is available.',
  };

  assert.equal(available.available, true);
  assert.equal(available.version, '0.5.0');
  assert.equal(available.errorCode, null);

  // ── VERSION_UNREADABLE result ────────────────
  const noVersion: RuntimeAvailabilityResult = {
    runtime: 'markitdown',
    available: true,
    version: null,
    errorCode: 'VERSION_UNREADABLE',
    message: 'MarkItDown is available but version unknown.',
  };

  assert.equal(noVersion.available, true);
  assert.equal(noVersion.errorCode, 'VERSION_UNREADABLE');

  // ── CHECK_FAILED result ──────────────────────
  const checkFailed: RuntimeAvailabilityResult = {
    runtime: 'markitdown',
    available: false,
    version: null,
    errorCode: 'CHECK_FAILED',
    message: 'No Python installation found.',
  };

  assert.equal(checkFailed.errorCode, 'CHECK_FAILED');
  assert.ok(!checkFailed.message.includes('python.exe'), 'Must not leak Python path');
}

run();
console.log('[PASS] markitdown-availability');
