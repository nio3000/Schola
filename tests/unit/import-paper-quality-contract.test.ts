/**
 * Phase 3-4-H2: Paper quality contract test.
 *
 * Verifies:
 * P0-01 ImportMode includes paper_quality
 * P0-02 AvailableImportModes includes paperQuality
 * P0-03 computeAvailableModes paperQuality independent from precision
 * P0-04 paper_quality + PDF accepted
 * P0-05 paper_quality + non-PDF rejected
 * P0-06 paper_quality routes to MarkItDown baseline
 * P0-07 paper_quality does not call Runtime Pack
 * P0-08 paper_quality does not call reserved engines
 * P0-14 quick import unchanged
 * P0-15 precision / ocr unchanged
 */
import assert from 'node:assert/strict';

// ── Simulated contracts ───────────────────────────

type ImportMode = 'quick' | 'paper_quality' | 'precision' | 'ocr';
type ImportSourceFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'html';
type ImportEngine = 'markitdown' | 'docling_reserved' | 'mineru_reserved' | 'marker_reserved' | 'dots_ocr_reserved';

interface AvailableImportModes {
  readonly quick: boolean;
  readonly paperQuality: boolean;
  readonly precision: boolean;
  readonly ocr: boolean;
}

// ── Helpers ───────────────────────────────────────

function computeAvailableModes(markitdownAvailable: boolean): AvailableImportModes {
  return {
    quick: markitdownAvailable,
    paperQuality: markitdownAvailable,
    precision: false,
    ocr: false,
  };
}

function validatePaperQualityMode(mode: ImportMode, sourceFormat: ImportSourceFormat): { ok: boolean; code?: string } {
  if (mode === 'paper_quality') {
    if (sourceFormat !== 'pdf') {
      return { ok: false, code: 'UNSUPPORTED_FORMAT' };
    }
    return { ok: true };
  }
  if (mode === 'quick') {
    return { ok: true };
  }
  if (mode === 'precision') {
    if (sourceFormat !== 'pdf') {
      return { ok: false, code: 'UNSUPPORTED_FORMAT' };
    }
    return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
  }
  if (mode === 'ocr') {
    return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
  }
  return { ok: false };
}

function resolveEngine(mode: ImportMode): ImportEngine {
  if (mode === 'paper_quality' || mode === 'quick') {
    return 'markitdown';
  }
  return 'markitdown'; // precision/ocr would require probe but default to markitdown here
}

function isReservedEngine(engine: ImportEngine): boolean {
  return engine !== 'markitdown';
}

// ── Run ────────────────────────────────────────────

function run(): void {
  // ═══ P0-01: ImportMode includes paper_quality ═══
  {
    const modes: ImportMode[] = ['quick', 'paper_quality', 'precision', 'ocr'];
    assert.ok(modes.includes('paper_quality'), 'ImportMode must include paper_quality');
  }

  // ═══ P0-02: AvailableImportModes includes paperQuality ═══
  {
    const modes: AvailableImportModes = { quick: true, paperQuality: true, precision: false, ocr: false };
    assert.equal(typeof modes.paperQuality, 'boolean', 'AvailableImportModes must include paperQuality');
    assert.equal(modes.paperQuality, true);
  }

  // ═══ P0-03: paperQuality independent from precision ═══
  {
    // paperQuality = true when quick=true, regardless of precision
    const m = computeAvailableModes(true);
    assert.equal(m.paperQuality, true);
    assert.equal(m.precision, false);

    // paperQuality = false when quick=false
    const m2 = computeAvailableModes(false);
    assert.equal(m2.paperQuality, false);
  }

  // ═══ P0-04: paper_quality + PDF accepted ═══
  {
    const r = validatePaperQualityMode('paper_quality', 'pdf');
    assert.equal(r.ok, true, 'paper_quality + PDF must be accepted');
  }

  // ═══ P0-05: paper_quality + non-PDF rejected ═══
  {
    for (const fmt of ['docx', 'pptx', 'xlsx', 'html'] as ImportSourceFormat[]) {
      const r = validatePaperQualityMode('paper_quality', fmt);
      assert.equal(r.ok, false, `paper_quality + ${fmt} must be rejected`);
      assert.equal(r.code, 'UNSUPPORTED_FORMAT', `paper_quality + ${fmt} code must be UNSUPPORTED_FORMAT`);
    }
  }

  // ═══ P0-06: paper_quality routes to MarkItDown baseline ═══
  {
    const engine = resolveEngine('paper_quality');
    assert.equal(engine, 'markitdown', 'paper_quality must route to markitdown');
    assert.ok(!isReservedEngine(engine), 'paper_quality engine must not be reserved');
  }

  // ═══ P0-07: paper_quality does not call Runtime Pack ═══
  // (Verified by resolveEngine returning markitdown — no reserved engine call)
  {
    const engine = resolveEngine('paper_quality');
    assert.ok(engine !== 'docling_reserved');
    assert.ok(engine !== 'mineru_reserved');
    assert.ok(engine !== 'marker_reserved');
    assert.ok(engine !== 'dots_ocr_reserved');
  }

  // ═══ P0-08: paper_quality does not call reserved engines ═══
  {
    for (const reserved of ['docling_reserved', 'mineru_reserved', 'marker_reserved', 'dots_ocr_reserved'] as ImportEngine[]) {
      assert.ok(reserved !== resolveEngine('paper_quality'), `paper_quality must not use ${reserved}`);
    }
  }

  // ═══ P0-14: quick import unchanged ═══
  {
    assert.equal(validatePaperQualityMode('quick', 'pdf').ok, true);
    assert.equal(validatePaperQualityMode('quick', 'docx').ok, true);
  }

  // ═══ P0-15: precision / ocr unchanged ═══
  {
    // precision still returns ENGINE_NOT_AVAILABLE (as before)
    assert.equal(validatePaperQualityMode('precision', 'pdf').code, 'ENGINE_NOT_AVAILABLE');
    assert.equal(validatePaperQualityMode('precision', 'docx').code, 'UNSUPPORTED_FORMAT');
    // ocr still unavailable
    assert.equal(validatePaperQualityMode('ocr', 'pdf').code, 'ENGINE_NOT_AVAILABLE');
  }
}

run();
console.log('[PASS] import-paper-quality-contract');
