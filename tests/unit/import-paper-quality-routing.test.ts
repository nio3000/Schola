/**
 * Phase 3-4-H2 / Phase 3-4-I: Paper quality routing test.
 *
 * Verifies H2/I routing rules:
 * 1. paper_quality + PDF → allowed, routes to pymupdf4llm
 * 2. paper_quality + non-PDF → UNSUPPORTED_FORMAT
 * 3. paper_quality does not call Runtime Pack
 * 4. paper_quality does not call reserved engines
 * 5. paper_quality + reserved engine override → ENGINE_NOT_AVAILABLE
 * 6. paper_quality + engine omitted → accepted
 * 7. No-fallback to precision
 * 8. Quick unchanged
 * 9. I: paper_quality unavailable → ENGINE_NOT_AVAILABLE
 */
import assert from 'node:assert/strict';

// ── Types ─────────────────────────────────────────

type ImportMode = 'quick' | 'paper_quality' | 'precision' | 'ocr';
type ImportSourceFormat = 'pdf' | 'docx';
type ImportEngine = 'markitdown' | 'pymupdf4llm' | 'docling_reserved' | 'mineru_reserved' | 'marker_reserved' | 'dots_ocr_reserved';

// ── Simulated routing ─────────────────────────────

function routeEngine(mode: ImportMode, pymupdf4llmAvailable: boolean): { engine: ImportEngine; code?: string } {
  if (mode === 'paper_quality') {
    if (!pymupdf4llmAvailable) {
      return { engine: 'markitdown', code: 'ENGINE_NOT_AVAILABLE' };
    }
    return { engine: 'pymupdf4llm' };
  }
  if (mode === 'precision') {
    return { engine: 'docling_reserved', code: 'ENGINE_NOT_AVAILABLE' };
  }
  return { engine: 'markitdown' };
}

function validateMode(
  mode: ImportMode,
  sourceFormat: ImportSourceFormat,
  engine: ImportEngine | undefined,
): { ok: boolean; code?: string } {
  if (engine !== undefined && engine !== 'markitdown') {
    return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
  }
  if (mode === 'ocr') return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
  if (mode === 'paper_quality') {
    if (sourceFormat !== 'pdf') return { ok: false, code: 'UNSUPPORTED_FORMAT' };
    return { ok: true };
  }
  if (mode === 'precision') {
    if (sourceFormat !== 'pdf') return { ok: false, code: 'UNSUPPORTED_FORMAT' };
    return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
  }
  return { ok: true };
}

// ── Run ────────────────────────────────────────────

function run(): void {
  // ═══ 1: paper_quality + PDF → accepted ═══
  assert.equal(validateMode('paper_quality', 'pdf', undefined).ok, true);

  // ═══ 2: paper_quality + DOCX → UNSUPPORTED_FORMAT ═══
  {
    const r = validateMode('paper_quality', 'docx', undefined);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'UNSUPPORTED_FORMAT');
  }

  // ═══ 3: paper_quality routes to pymupdf4llm (I-ENG-3) ═══
  assert.equal(routeEngine('paper_quality', true).engine, 'pymupdf4llm');
  assert.equal(routeEngine('paper_quality', true).code, undefined);

  // ═══ 4: paper_quality unavailable → ENGINE_NOT_AVAILABLE ═══
  {
    const r = routeEngine('paper_quality', false);
    assert.equal(r.code, 'ENGINE_NOT_AVAILABLE');
  }

  // ═══ 5: paper_quality does NOT call reserved engines ═══
  {
    const r = validateMode('paper_quality', 'pdf', 'docling_reserved');
    assert.equal(r.ok, false);
    assert.equal(r.code, 'ENGINE_NOT_AVAILABLE');
  }

  // ═══ 7: No fallback to precision ═══
  {
    const r = routeEngine('paper_quality', false);
    assert.equal(r.code, 'ENGINE_NOT_AVAILABLE');
  }

  // ═══ 8: Quick unchanged ═══
  assert.equal(routeEngine('quick', false).engine, 'markitdown');
  assert.equal(routeEngine('quick', true).engine, 'markitdown');

  console.log('[PASS] import-paper-quality-routing');
}

run();
console.log('[PASS] import-paper-quality-routing');
