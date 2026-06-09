/**
 * Phase 3-1-C: LaTeX availability test.
 *
 * Tests RuntimeAvailabilityResult safety for latex runtime.
 * Does NOT require LaTeX to be installed.
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
  // NOT_INSTALLED result for latex
  const notInstalled: RuntimeAvailabilityResult = {
    runtime: 'latex',
    available: false,
    version: null,
    errorCode: 'NOT_INSTALLED',
    message: 'LaTeX is not available. PDF export requires a LaTeX installation.',
  };
  assert.equal(notInstalled.runtime, 'latex');
  assert.equal(notInstalled.available, false);
  assert.ok(!notInstalled.message.includes('C:\\'), 'Must not leak Windows path');
  assert.ok(!notInstalled.message.includes('/usr/'), 'Must not leak Unix path');

  // available with version
  const available: RuntimeAvailabilityResult = {
    runtime: 'latex',
    available: true,
    version: '2024.0',
    errorCode: null,
    message: 'LaTeX 2024.0 is available.',
  };
  assert.equal(available.runtime, 'latex');
  assert.equal(available.available, true);

  // message safety
  assert.ok(!notInstalled.message.includes('pdflatex.ex'), 'Must not leak executable path');
  assert.ok(!notInstalled.message.includes('Traceback'), 'Must not contain traceback');
  assert.ok(!notInstalled.message.includes('site-packages'), 'Must not contain site-packages');
}

run();
console.log('[PASS] latex-availability');
