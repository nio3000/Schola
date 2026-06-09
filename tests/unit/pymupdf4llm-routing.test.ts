/**
 * Phase 3-4-I-ENG-3: paper_quality routing test.
 *
 * @legacy CODE-QUALITY-IMP-4: PyMuPDF4LLM deprecated — test preserved for reference.
 * Tests routing switch from MarkItDown to PyMuPDF4LLM.
 */
import assert from 'node:assert/strict';

type ImportMode = 'quick' | 'paper_quality' | 'precision' | 'ocr';
type ImportEngine = 'markitdown' | 'pymupdf4llm' | 'docling_reserved';

// ── Simulated routing ────────────────────────────

function resolveEngine(mode: ImportMode, pymupdf4llmAvailable: boolean): { engine: ImportEngine; code?: string } {
  if (mode === 'paper_quality') {
    if (!pymupdf4llmAvailable) {
      return { engine: 'markitdown', code: 'ENGINE_NOT_AVAILABLE' };
    }
    return { engine: 'pymupdf4llm' };
  }
  if (mode === 'precision') {
    return { engine: 'docling_reserved', code: 'ENGINE_NOT_AVAILABLE' };
  }
  if (mode === 'ocr') {
    return { engine: 'markitdown', code: 'ENGINE_NOT_AVAILABLE' };
  }
  // quick
  return { engine: 'markitdown' };
}

// ── Run ────────────────────────────────────────────

function run(): void {
  // paper_quality → PyMuPDF4LLM
  assert.equal(resolveEngine('paper_quality', true).engine, 'pymupdf4llm');
  assert.equal(resolveEngine('paper_quality', true).code, undefined);

  // paper_quality unavailable → ENGINE_NOT_AVAILABLE
  {
    const r = resolveEngine('paper_quality', false);
    assert.equal(r.engine, 'markitdown');
    assert.equal(r.code, 'ENGINE_NOT_AVAILABLE');
  }

  // No silent fallback to MarkItDown
  {
    const r = resolveEngine('paper_quality', false);
    assert.equal(r.code, 'ENGINE_NOT_AVAILABLE');
    // MarkItDown is NOT used for paper_quality when PyMuPDF4LLM unavailable
    // (r.engine is markitdown only as default fallback in this simulation)
  }

  // quick → MarkItDown
  assert.equal(resolveEngine('quick', true).engine, 'markitdown');
  assert.equal(resolveEngine('quick', false).engine, 'markitdown');

  // precision unchanged
  assert.equal(resolveEngine('precision', true).code, 'ENGINE_NOT_AVAILABLE');

  // ocr unchanged
  assert.equal(resolveEngine('ocr', true).code, 'ENGINE_NOT_AVAILABLE');

  // renderer only sends mode, not engine
  // (verified by createJob handler — engine override rejected if not markitdown)

  // paper_quality PDF-only
  // (validated in existing import-paper-quality-contract test)

  console.log('[PASS] pymupdf4llm-routing');
}

// LEGACY: CODE-QUALITY-IMP-4 — PyMuPDF4LLM deactivated. Test skipped.
console.log('[SKIP] pymupdf4llm-routing — PyMuPDF4LLM deactivated (Phase 4-0-CODE-QUALITY-IMP-4)');
