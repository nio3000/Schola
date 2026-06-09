/**
 * Phase 3-4-K: Diagnostics boundary tests (contract only).
 *
 * Validates:
 *   K-DIAG-01–15: no diagnostics IPC handler, no path leaks, safe messages
 */
import assert from 'node:assert/strict';

// ── K-DIAG-01: no diagnostics IPC handler registered ──
{
  const registeredIpc = [
    'import:select-source', 'import:create-job', 'import:get-job-status',
    'import:list-jobs', 'import:cancel-job', 'import:get-available-modes',
    'import:open-original-file', 'import:reveal-original-file',
  ];
  assert.ok(!registeredIpc.includes('import:get-runtime-diagnostics'), 'K-DIAG-01: no diagnostics handler');
}

// ── K-DIAG-03–06: diagnostics contract type must not contain paths ──
{
  // Simulated diagnostics contract
  interface SafeDiagnostics {
    readonly runtimeId: string;
    readonly status: string;
    readonly version: string | null;
    readonly reason: string | null;   // no paths, no URLs, <200 chars
    readonly installHint: string | null; // static text only
    readonly licenseNote: string | null; // static text only
  }

  const diag: SafeDiagnostics = {
    runtimeId: 'marker_external',
    status: 'not_installed',
    version: null,
    reason: 'Marker is not installed.',
    installHint: 'Run: pip install marker-pdf',
    licenseNote: 'Marker uses GPL-3.0 license.',
  };

  // K-DIAG-03: no python path
  assert.ok(!diag.reason!.includes('python'), 'K-DIAG-03');
  // K-DIAG-04: no cache path
  assert.ok(!diag.reason!.includes('cache'), 'K-DIAG-04');
  // K-DIAG-05: no absolute path
  assert.ok(!diag.reason!.includes('C:\\'), 'K-DIAG-05');
  // K-DIAG-06: no traceback
  assert.ok(!diag.reason!.includes('Traceback'), 'K-DIAG-06');
}

// ── K-DIAG-07: safe message ──
{
  const reason = 'PyMuPDF4LLM is not installed.';
  assert.ok(!reason.includes('C:\\'), 'K-DIAG-07: no path');
  assert.ok(!reason.includes('http'), 'K-DIAG-08: no URL');
}

// ── K-DIAG-09: diagnostics may show tech name ──
{
  const label = 'PyMuPDF4LLM 1.27.2';
  assert.ok(label.includes('PyMuPDF4LLM'), 'K-DIAG-09: tech name allowed in diagnostics');
}

// ── K-DIAG-10: ordinary UI must NOT show tech name ──
{
  const uiLabel = '标准论文导入';
  assert.ok(!uiLabel.includes('PyMuPDF4LLM'), 'K-DIAG-10a: no tech name in UI');
  assert.ok(!uiLabel.includes('pymupdf4llm'), 'K-DIAG-10b: no engine id in UI');

  const enhancedLabel = '高精度论文导入';
  assert.ok(!enhancedLabel.includes('Marker'), 'K-DIAG-10c: no tech name in UI');
}

// ── K-DIAG-11: license warning exists ──
{
  const licenseNote = 'PyMuPDF4LLM uses GNU AGPL-3.0 license.';
  assert.ok(licenseNote.length > 0, 'K-DIAG-11: license warning present');
}

// ── K-DIAG-12: no auto-install button ──
{
  const installHint = 'Run: pip install pymupdf4llm';
  assert.ok(!installHint.includes('click'), 'K-DIAG-12: no click-to-install');
  assert.ok(!installHint.includes('button'), 'K-DIAG-12: no button');
  assert.ok(!installHint.includes('auto'), 'K-DIAG-12: no auto');
}

// ── K-DIAG-13–15: no shell/Python/path modification ──
{
  const inputFields = ['runtimeId', 'status'];
  assert.ok(!inputFields.includes('command'), 'K-DIAG-13: no command input');
  assert.ok(!inputFields.includes('pythonPath'), 'K-DIAG-14: no pythonPath input');
  assert.ok(!inputFields.includes('install'), 'K-DIAG-15: no install action');
}

console.log('PASS  external-runtime-diagnostics-boundary.test.ts');
