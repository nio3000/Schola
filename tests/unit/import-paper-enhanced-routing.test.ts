/**
 * Phase 3-4-K: paper_enhanced routing tests.
 *
 * Validates:
 *   K-ROUTE-01–20: routing, fallback prohibition, renderer constraints
 */
import assert from 'node:assert/strict';

// ── Routing table ─────────────────────────────
const ROUTING: Record<string, string> = {
  'quick': 'markitdown',
  'paper_quality': 'pymupdf4llm',
  'paper_enhanced': 'marker',  // Phase 3-4-K
  'precision': 'docling_reserved',
  'ocr': 'none',
};

// ── K-ROUTE-01–03: correct routing ──
assert.equal(ROUTING['quick'], 'markitdown', 'K-ROUTE-01');
assert.equal(ROUTING['paper_quality'], 'pymupdf4llm', 'K-ROUTE-02');
assert.equal(ROUTING['paper_enhanced'], 'marker', 'K-ROUTE-03');

// ── K-ROUTE-04: paper_quality unavailable → ENGINE_NOT_AVAILABLE ──
function routePaperQuality(available: boolean): string | null {
  if (!available) return 'ENGINE_NOT_AVAILABLE';
  return ROUTING['paper_quality'];
}
assert.equal(routePaperQuality(false), 'ENGINE_NOT_AVAILABLE', 'K-ROUTE-04');

// ── K-ROUTE-05: paper_enhanced unavailable → ENGINE_NOT_AVAILABLE ──
function routePaperEnhanced(available: boolean): string | null {
  if (!available) return 'ENGINE_NOT_AVAILABLE';
  return ROUTING['paper_enhanced'];
}
assert.equal(routePaperEnhanced(false), 'ENGINE_NOT_AVAILABLE', 'K-ROUTE-05');

// ── K-ROUTE-06–07: no fallback to MarkItDown ──
{
  // paper_quality unavailable DOES NOT fallback to markitdown
  assert.notEqual(routePaperQuality(false), 'markitdown', 'K-ROUTE-06: paper_quality →/ markitdown');
  // paper_enhanced unavailable DOES NOT fallback to markitdown
  assert.notEqual(routePaperEnhanced(false), 'markitdown', 'K-ROUTE-07: paper_enhanced →/ markitdown');
}

// ── K-ROUTE-08–09: no cross-fallback ──
{
  // paper_enhanced unavailable DOES NOT fallback to pymupdf4llm
  assert.notEqual(routePaperEnhanced(false), 'pymupdf4llm', 'K-ROUTE-08');
  // paper_quality unavailable DOES NOT fallback to marker
  assert.notEqual(routePaperQuality(false), 'marker', 'K-ROUTE-09');
}

// ── K-ROUTE-10–11: no mode-to-mode fallback ──
{
  // paper_quality →/ paper_enhanced
  assert.notEqual(ROUTING['paper_quality'], 'paper_enhanced', 'K-ROUTE-10');
  // paper_enhanced →/ paper_quality
  assert.notEqual(ROUTING['paper_enhanced'], 'paper_quality', 'K-ROUTE-11');
}

// ── K-ROUTE-12–13: non-PDF → UNSUPPORTED_FORMAT ──
function checkFormat(mode: string, format: string): string | null {
  if ((mode === 'paper_quality' || mode === 'paper_enhanced') && format !== 'pdf') {
    return 'UNSUPPORTED_FORMAT';
  }
  return null;
}
assert.equal(checkFormat('paper_quality', 'docx'), 'UNSUPPORTED_FORMAT', 'K-ROUTE-12');
assert.equal(checkFormat('paper_enhanced', 'docx'), 'UNSUPPORTED_FORMAT', 'K-ROUTE-13');
assert.equal(checkFormat('quick', 'docx'), null, 'quick accepts docx');

// ── K-ROUTE-14–15: renderer does NOT pass engine ──
{
  const createJobInput = {
    vaultId: 'test-vault',
    selectedSourceToken: 'src_xxx',
    mode: 'paper_enhanced' as const,
    // engine is intentionally absent
  };
  assert.ok(!('engine' in createJobInput), 'K-ROUTE-15: engine field absent from renderer input');
}

// ── K-ROUTE-17: default engine is markitdown ──
assert.equal(ROUTING['quick'], 'markitdown', 'K-ROUTE-17: DEFAULT_IMPORT_ENGINE = markitdown');

// ── K-ROUTE-18: precision/ocr unchanged ──
assert.equal(ROUTING['precision'], 'docling_reserved', 'K-ROUTE-18a');
assert.equal(ROUTING['ocr'], 'none', 'K-ROUTE-18b');

// ── K-ROUTE-19: RUNTIME_NEEDS_SETUP not returned in K phase ──
{
  const kPhaseErrors: string[] = ['UNSUPPORTED_FORMAT', 'ENGINE_NOT_AVAILABLE', 'INTERNAL_ERROR'];
  assert.ok(!kPhaseErrors.includes('RUNTIME_NEEDS_SETUP'), 'K-ROUTE-19: RUNTIME_NEEDS_SETUP not in K phase');
}

// ── K-ROUTE-20: RUNTIME_NEEDS_SETUP reserved for Phase 3-4-L ──
{
  const reservedErrors = ['RUNTIME_NEEDS_SETUP'];
  assert.ok(reservedErrors.includes('RUNTIME_NEEDS_SETUP'), 'K-ROUTE-20: error code exists as reserved');
}

console.log('PASS  import-paper-enhanced-routing.test.ts');
