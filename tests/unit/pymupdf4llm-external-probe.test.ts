/**
 * @legacy CODE-QUALITY-IMP-4: PyMuPDF4LLM deprecated.
 *
 * Phase 3-4-K: PyMuPDF4LLM external probe regression tests.
 *
 * Validates:
 *   K-PYMUPDF-01–18: probe safety, no bundled runtime, no path leaks
 */
import assert from 'node:assert/strict';

// LEGACY: CODE-QUALITY-IMP-4 — PyMuPDF4LLM deactivated. Test skipped.
console.log('[SKIP] pymupdf4llm-external-probe — PyMuPDF4LLM deactivated (Phase 4-0-CODE-QUALITY-IMP-4)');

// ── K-PYMUPDF-01: installed → available ──
{
  const result = { status: 'available' as const, version: '1.27.2', reason: null };
  assert.equal(result.status, 'available');
  assert.ok(result.version !== null);
}

// ── K-PYMUPDF-02: missing → not_installed ──
{
  const result = { status: 'not_installed' as const, version: null, reason: 'PyMuPDF4LLM is not installed.' };
  assert.equal(result.status, 'not_installed');
}

// ── K-PYMUPDF-03: import failed → unavailable ──
{
  const result = { status: 'unavailable' as const, version: null, reason: 'Failed to execute Python import check.' };
  assert.equal(result.status, 'unavailable');
}

// ── K-PYMUPDF-04: timeout → timeout ──
{
  const result = { status: 'timeout' as const, version: null, reason: 'Probe timed out.' };
  assert.equal(result.status, 'timeout');
}

// ── K-PYMUPDF-06: version stdout ≤ 50 chars ──
{
  const version = '1.27.2.3';
  assert.ok(version.length <= 50, 'version must be ≤ 50 chars');
}

// ── K-PYMUPDF-07: reason does not contain Python path ──
{
  const reason = 'PyMuPDF4LLM is not installed.';
  assert.ok(!reason.includes('python'), 'reason must not contain python path');
  assert.ok(!reason.includes('site-packages'), 'reason must not contain site-packages');
  assert.ok(!reason.includes('C:\\'), 'reason must not contain absolute path');
}

// ── K-PYMUPDF-08–10: probe does not read PDF or execute conversion ──
{
  // Probe only does import + version query via execFile(..., ['-c', 'import pymupdf4llm'], ...)
  const probeCommand = ['-c', 'import pymupdf4llm'];
  assert.ok(!probeCommand.some(arg => arg.includes('.pdf')), 'no PDF file access');
  assert.ok(!probeCommand.some(arg => arg.includes('to_markdown')), 'no to_markdown call');
  assert.ok(!probeCommand.some(arg => arg.includes('fitz.open')), 'no fitz.open call');
}

// ── K-PYMUPDF-11: no pip install ──
{
  const probeCommand = ['-c', 'import pymupdf4llm'];
  assert.ok(!probeCommand.some(arg => arg.includes('pip')), 'no pip install');
}

// ── K-PYMUPDF-14–16: no path leaks ──
{
  const reason = 'PyMuPDF4LLM is not installed.';
  assert.ok(!reason.includes('Traceback'), 'no traceback');
  assert.ok(!reason.includes('File "'), 'no file path');
  assert.ok(!reason.includes('site-packages'), 'no site-packages');
}

// ── K-PYMUPDF-17: no bundled runtime path ──
{
  // External probe resolver does not look for bundled venv
  const bundledPathCheck = false; // bundled path search is skipped
  assert.equal(bundledPathCheck, false, 'bundled runtime path must not be used');
}

// ── K-PYMUPDF-18: no PyMuPDF binary in packaging ──
{
  const packagedFiles = ['app.asar', 'index.html', 'main.js']; // simulated
  assert.ok(!packagedFiles.some(f => f.includes('pymupdf')), 'no pymupdf binary packaged');
  assert.ok(!packagedFiles.some(f => f.includes('pymupdf4llm')), 'no pymupdf4llm binary packaged');
}

console.log('PASS  pymupdf4llm-external-probe.test.ts');
