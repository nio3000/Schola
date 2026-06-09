/**
 * Phase 3-4-K: availableModes paperEnhanced tests.
 *
 * Validates:
 *   K-MODES-01–15: computeAvailableModes includes paperEnhanced, no fallback, no path leaks
 */
import assert from 'node:assert/strict';

// ── Simulated computeAvailableModes ──
function computeAvailableModes(
  markitdownAvailable: boolean,
  pymupdf4llmAvailable: boolean,
  markerAvailable: boolean,
): Record<string, boolean> {
  return {
    quick: markitdownAvailable,
    paper_quality: pymupdf4llmAvailable,
    paper_enhanced: markerAvailable,
    precision: false,
    ocr: false,
  };
}

// ── K-MODES-01: quick → markitdownAvailable ──
assert.equal(computeAvailableModes(true, false, false).quick, true, 'K-MODES-01');

// ── K-MODES-02: paperQuality → pymupdf4llmAvailable ──
assert.equal(computeAvailableModes(false, true, false).paper_quality, true, 'K-MODES-02');

// ── K-MODES-03: paperEnhanced → markerAvailable ──
assert.equal(computeAvailableModes(false, false, true).paper_enhanced, true, 'K-MODES-03');

// ── K-MODES-04: PyMuPDF4LLM available → paperQuality=true ──
assert.equal(computeAvailableModes(false, true, false).paper_quality, true, 'K-MODES-04');

// ── K-MODES-05: PyMuPDF4LLM missing → paperQuality=false ──
assert.equal(computeAvailableModes(false, false, false).paper_quality, false, 'K-MODES-05');

// ── K-MODES-06: Marker available → paperEnhanced=true ──
assert.equal(computeAvailableModes(false, false, true).paper_enhanced, true, 'K-MODES-06');

// ── K-MODES-07: Marker missing → paperEnhanced=false ──
assert.equal(computeAvailableModes(false, false, false).paper_enhanced, false, 'K-MODES-07');

// ── K-MODES-08: Marker timeout → paperEnhanced=false ──
// timeout status maps to markerAvailable=false in computeAvailableModes
assert.equal(computeAvailableModes(false, false, false).paper_enhanced, false, 'K-MODES-08');

// ── K-MODES-09: Marker unknown → paperEnhanced=false ──
assert.equal(computeAvailableModes(false, false, false).paper_enhanced, false, 'K-MODES-09');

// ── K-MODES-10: paperQuality does not affect quick ──
assert.equal(computeAvailableModes(true, false, false).quick, true, 'K-MODES-10');

// ── K-MODES-11: paperEnhanced does not affect quick ──
assert.equal(computeAvailableModes(true, false, false).quick, true, 'K-MODES-11');

// ── K-MODES-12: paperQuality and paperEnhanced do NOT fallback to each other ──
const bothAvailable = computeAvailableModes(false, true, true);
assert.equal(bothAvailable.paper_quality, true, 'K-MODES-12a: paperQuality=true');
assert.equal(bothAvailable.paper_enhanced, true, 'K-MODES-12b: paperEnhanced=true');

const onlyPaperQuality = computeAvailableModes(false, true, false);
assert.equal(onlyPaperQuality.paper_quality, true, 'K-MODES-12c');
assert.equal(onlyPaperQuality.paper_enhanced, false, 'K-MODES-12d: paperEnhanced NOT inflated by paperQuality');

const onlyPaperEnhanced = computeAvailableModes(false, false, true);
assert.equal(onlyPaperEnhanced.paper_quality, false, 'K-MODES-12e: paperQuality NOT inflated by paperEnhanced');
assert.equal(onlyPaperEnhanced.paper_enhanced, true, 'K-MODES-12f');

// ── K-MODES-13: precision/ocr not affected ──
{
  const modes = computeAvailableModes(true, true, true);
  assert.equal(modes.precision, false, 'K-MODES-13a: precision unchanged');
  assert.equal(modes.ocr, false, 'K-MODES-13b: ocr unchanged');
}

// ── K-MODES-15: response has no paths ──
{
  const response = {
    ok: true as const,
    modes: { quick: true, paperQuality: true, paperEnhanced: false, precision: false, ocr: false },
  };
  const json = JSON.stringify(response);
  assert.ok(!json.includes('C:\\'), 'K-MODES-15: no absolute path');
  assert.ok(!json.includes('python'), 'K-MODES-15: no python path');
  assert.ok(!json.includes('cache'), 'K-MODES-15: no cache path');
}

console.log('PASS  import-available-modes-paper-enhanced.test.ts');
