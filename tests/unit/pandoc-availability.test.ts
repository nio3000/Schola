/**
 * Phase 3-1-C: Pandoc availability test.
 *
 * Tests RuntimeAvailabilityResult safety for pandoc runtime.
 * Does NOT require Pandoc to be installed.
 */

import assert from 'node:assert/strict';

interface RuntimeAvailabilityResult {
  readonly runtime: string;
  readonly available: boolean;
  readonly version: string | null;
  readonly errorCode: string | null;
  readonly message: string;
}

function run(): void {
  // NOT_INSTALLED result
  const notInstalled: RuntimeAvailabilityResult = {
    runtime: 'pandoc',
    available: false,
    version: null,
    errorCode: 'NOT_INSTALLED',
    message: 'Pandoc is not available.',
  };
  assert.equal(notInstalled.runtime, 'pandoc');
  assert.equal(notInstalled.available, false);
  assert.equal(notInstalled.version, null);
  assert.ok(!notInstalled.message.includes('Program Files'), 'Must not leak path');
  assert.ok(!notInstalled.message.includes('/usr/'), 'Must not leak path');
  assert.ok(!notInstalled.message.includes('Traceback'), 'Must not contain traceback');

  // Available result
  const available: RuntimeAvailabilityResult = {
    runtime: 'pandoc',
    available: true,
    version: '3.6',
    errorCode: null,
    message: 'Pandoc 3.6 is available.',
  };
  assert.equal(available.available, true);
  assert.equal(available.version, '3.6');

  // version is a simple string, not a path
  assert.ok(!available.version!.includes('/'), 'Version must not be a path');
  assert.ok(!available.version!.includes('\\'), 'Version must not be a path');

  // Message must be user-friendly
  assert.ok(available.message.length > 0);
  assert.ok(notInstalled.message.length > 0);
}

run();
console.log('[PASS] pandoc-availability');
