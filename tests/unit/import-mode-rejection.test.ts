/**
 * Phase 3-4-C2-b / Phase 3-4-H2: precision/ocr/paper_quality mode rejection test.
 *
 * Verifies:
 * 1. mode omitted / quick → allowed
 * 2. mode: 'ocr' → ENGINE_NOT_AVAILABLE
 * 3. mode: 'paper_quality' + PDF → allowed
 * 4. mode: 'paper_quality' + non-PDF → UNSUPPORTED_FORMAT
 * 5. mode: 'precision' + probe unavailable → ENGINE_NOT_AVAILABLE
 * 6. mode: 'precision' + non-PDF → UNSUPPORTED_FORMAT
 * 7. mode: 'precision' + probe available + PDF → allowed
 * 8. engine override: non-markitdown → ENGINE_NOT_AVAILABLE
 * 9. paper_quality + reserved engine → ENGINE_NOT_AVAILABLE
 */
import assert from 'node:assert/strict';

function validateImportC2b(
  mode: string | undefined,
  sourceFormat: string,
  engine: string | undefined,
  probeAvailable: boolean,
): { ok: boolean; code?: string } {
  // ── Engine override: only 'markitdown' accepted ──
  if (engine !== undefined && engine !== 'markitdown') {
    return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
  }

  const importMode = mode ?? 'quick';

  // ── OCR: still unavailable ──
  if (importMode === 'ocr') {
    return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
  }

  // ── Paper quality: PDF-only, no runtime needed ──
  if (importMode === 'paper_quality') {
    if (sourceFormat !== 'pdf') {
      return { ok: false, code: 'UNSUPPORTED_FORMAT' };
    }
    return { ok: true };
  }

  // ── Precision gate ──
  if (importMode === 'precision') {
    if (sourceFormat !== 'pdf') {
      return { ok: false, code: 'UNSUPPORTED_FORMAT' };
    }
    if (!probeAvailable) {
      return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
    }
    return { ok: true };
  }

  // quick
  return { ok: true };
}

function run(): void {
  // ═══ mode omitted → allowed ═══
  assert.equal(validateImportC2b(undefined, 'pdf', undefined, false).ok, true);

  // ═══ mode: 'quick' → allowed ═══
  assert.equal(validateImportC2b('quick', 'pdf', undefined, false).ok, true);

  // ═══ H2: mode: 'paper_quality' + PDF → allowed ═══
  assert.equal(validateImportC2b('paper_quality', 'pdf', undefined, false).ok, true);

  // ═══ H2: mode: 'paper_quality' + DOCX → UNSUPPORTED_FORMAT ═══
  {
    const r = validateImportC2b('paper_quality', 'docx', undefined, false);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'UNSUPPORTED_FORMAT');
  }

  // ═══ H2: mode: 'paper_quality' + PPTX → UNSUPPORTED_FORMAT ═══
  {
    const r = validateImportC2b('paper_quality', 'pptx', undefined, false);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'UNSUPPORTED_FORMAT');
  }

  // ═══ H2: mode: 'paper_quality' + XLSX → UNSUPPORTED_FORMAT ═══
  {
    const r = validateImportC2b('paper_quality', 'xlsx', undefined, false);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'UNSUPPORTED_FORMAT');
  }

  // ═══ H2: mode: 'paper_quality' + HTML → UNSUPPORTED_FORMAT ═══
  {
    const r = validateImportC2b('paper_quality', 'html', undefined, false);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'UNSUPPORTED_FORMAT');
  }

  // ═══ H2: mode: 'paper_quality' + probe available but no precision dependency ═══
  assert.equal(validateImportC2b('paper_quality', 'pdf', undefined, true).ok, true);

  // ═══ H2: mode: 'paper_quality' does not depend on probe ═══
  assert.equal(validateImportC2b('paper_quality', 'pdf', undefined, false).ok, true);

  // ═══ mode: 'ocr' → rejected ═══
  {
    const r = validateImportC2b('ocr', 'pdf', undefined, true);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'ENGINE_NOT_AVAILABLE');
  }

  // ═══ mode: 'precision' + probe unavailable → rejected ═══
  {
    const r = validateImportC2b('precision', 'pdf', undefined, false);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'ENGINE_NOT_AVAILABLE');
  }

  // ═══ mode: 'precision' + non-PDF → rejected ═══
  {
    const r = validateImportC2b('precision', 'docx', undefined, true);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'UNSUPPORTED_FORMAT');
  }

  // ═══ mode: 'precision' + probe available + PDF → allowed ═══
  assert.equal(validateImportC2b('precision', 'pdf', undefined, true).ok, true);

  // ═══ engine: 'docling_reserved' + mode: 'quick' → rejected ═══
  {
    const r = validateImportC2b('quick', 'pdf', 'docling_reserved', true);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'ENGINE_NOT_AVAILABLE');
  }

  // ═══ engine: 'docling_reserved' + mode: 'precision' → rejected ═══
  {
    const r = validateImportC2b('precision', 'pdf', 'docling_reserved', true);
    assert.equal(r.ok, false, 'renderer must not select docling_reserved');
    assert.equal(r.code, 'ENGINE_NOT_AVAILABLE');
  }

  // ═══ engine: 'markitdown' + mode: 'quick' → allowed ═══
  assert.equal(validateImportC2b('quick', 'pdf', 'markitdown', false).ok, true);

  // ═══ engine: 'markitdown' + mode: 'precision' → allowed if probe available ═══
  // (engine='markitdown' is the only allowed override; main process resolves to docling_reserved)
  assert.equal(validateImportC2b('precision', 'pdf', 'markitdown', true).ok, true);

  // ═══ engine omitted → default markitdown ═══
  assert.equal(validateImportC2b('quick', 'pdf', undefined, false).ok, true);

  console.log('[PASS] import-mode-rejection');
}

run();
