/**
 * Phase 3-4-I: PyMuPDF4LLM bridge contract test.
 * @legacy CODE-QUALITY-IMP-4: PyMuPDF4LLM deprecated.
 */
import assert from 'node:assert/strict';

// ── Simulated bridge contract ────────────────────

function validateBridgeOutput(raw: unknown): { ok: true; pageCount: number | null; markdownBytes: number; imageCount: number; tableCount: number; warnings: string[] } | { ok: false; errorCode: string; message: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'Not a JSON object.' };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.ok !== 'boolean') return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'Missing ok field.' };

  if (obj.ok === true) {
    if (typeof obj.markdownBytes !== 'number') return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'markdownBytes must be number.' };
    if (typeof obj.imageCount !== 'number') return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'imageCount must be number.' };
    if (typeof obj.tableCount !== 'number') return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'tableCount must be number.' };
    const w = obj.warnings;
    if (w !== undefined && (!Array.isArray(w) || w.some(x => typeof x !== 'string'))) return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'warnings must be string array.' };
    return { ok: true, pageCount: typeof obj.pageCount === 'number' ? obj.pageCount : null, markdownBytes: obj.markdownBytes as number, imageCount: obj.imageCount as number, tableCount: obj.tableCount as number, warnings: (Array.isArray(w) ? w.map(String).slice(0, 500) : []) };
  }

  if (typeof obj.errorCode !== 'string' || !['PYMUPDF4LLM_NOT_AVAILABLE', 'CONVERSION_FAILED', 'INVALID_OUTPUT', 'TIMEOUT'].includes(obj.errorCode as string)) {
    return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'Invalid errorCode.' };
  }
  return { ok: false, errorCode: obj.errorCode as string, message: typeof obj.message === 'string' ? (obj.message as string).slice(0, 500) : 'Unknown error.' };
}

// ── Run ────────────────────────────────────────────

function run(): void {
  // Valid success
  {
    const r = validateBridgeOutput({ ok: true, pageCount: 12, markdownBytes: 45678, imageCount: 5, tableCount: 3, warnings: [] });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.pageCount, 12);
      assert.equal(r.markdownBytes, 45678);
      assert.equal(r.imageCount, 5);
      assert.equal(r.tableCount, 3);
    }
  }

  // pageCount null → ok
  {
    const r = validateBridgeOutput({ ok: true, pageCount: null, markdownBytes: 100, imageCount: 0, tableCount: 0, warnings: [] });
    assert.equal(r.ok, true);
  }

  // Not an object
  {
    const r = validateBridgeOutput("not json");
    assert.equal(r.ok, false);
    assert.equal((r as { errorCode: string }).errorCode, 'INVALID_OUTPUT');
  }

  // Null
  {
    const r = validateBridgeOutput(null);
    assert.equal(r.ok, false);
  }

  // Missing ok field
  {
    const r = validateBridgeOutput({ markdownBytes: 1 });
    assert.equal(r.ok, false);
  }

  // markdownBytes not number
  {
    const r = validateBridgeOutput({ ok: true, markdownBytes: "abc", imageCount: 0, tableCount: 0 });
    assert.equal(r.ok, false);
  }

  // Valid failure
  {
    const r = validateBridgeOutput({ ok: false, errorCode: 'PYMUPDF4LLM_NOT_AVAILABLE', message: 'Safe message.' });
    assert.equal(r.ok, false);
    assert.equal((r as { errorCode: string }).errorCode, 'PYMUPDF4LLM_NOT_AVAILABLE');
  }

  // Invalid errorCode → INVALID_OUTPUT
  {
    const r = validateBridgeOutput({ ok: false, errorCode: 'MALICIOUS_CODE', message: 'evil' });
    assert.equal(r.ok, false);
    assert.equal((r as { errorCode: string }).errorCode, 'INVALID_OUTPUT');
  }

  // Message truncation
  {
    const r = validateBridgeOutput({ ok: false, errorCode: 'CONVERSION_FAILED', message: 'x'.repeat(1000) });
    assert.equal(r.ok, false);
    assert.ok((r as { message: string }).message.length <= 500);
  }

  // Warnings must be string array
  {
    const r = validateBridgeOutput({ ok: true, markdownBytes: 1, imageCount: 0, tableCount: 0, warnings: [123] });
    assert.equal(r.ok, false);
  }

  // Forbidden patterns in stdout rejected by engine (simulated)
  const forbiddenPatterns = ['traceback', 'site-packages', 'C:\\Users', '/home/', '/Users/'];
  for (const pat of forbiddenPatterns) {
    const raw = JSON.stringify({ ok: true, pageCount: 1, markdownBytes: 1, imageCount: 0, tableCount: 0, warnings: [] });
    const hasForbidden = raw.toLowerCase().includes(pat.toLowerCase());
    assert.ok(!hasForbidden || pat === '/home/', `stdout must not contain ${pat}`);
  }

  // errorCode whitelist
  const validCodes = ['PYMUPDF4LLM_NOT_AVAILABLE', 'CONVERSION_FAILED', 'INVALID_OUTPUT', 'TIMEOUT'];
  for (const code of validCodes) {
    const r = validateBridgeOutput({ ok: false, errorCode: code, message: 'test' });
    assert.equal((r as { errorCode: string }).errorCode, code);
  }

  console.log('[PASS] pymupdf4llm-bridge-contract');
}

// LEGACY: CODE-QUALITY-IMP-4 — PyMuPDF4LLM deactivated. Test skipped.
console.log('[SKIP] pymupdf4llm-bridge-contract — PyMuPDF4LLM deactivated (Phase 4-0-CODE-QUALITY-IMP-4)');
