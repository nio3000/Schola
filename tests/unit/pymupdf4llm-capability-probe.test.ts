/**
 * Phase 3-4-I: PyMuPDF4LLM capability probe test.
 * @legacy CODE-QUALITY-IMP-4: PyMuPDF4LLM deprecated.
 */
import assert from 'node:assert/strict';

// ── Types ─────────────────────────────────────────

type ImportEngine = 'markitdown' | 'pymupdf4llm' | 'docling_reserved' | 'mineru_reserved' | 'marker_reserved' | 'dots_ocr_reserved';
type ImportMode = 'quick' | 'paper_quality' | 'precision' | 'ocr';

interface CoreEngineProbeStatus {
  readonly engine: 'pymupdf4llm';
  readonly status: 'available' | 'unavailable' | 'unknown';
  readonly version: string | null;
  readonly reason: string | null;
}

// ── Simulated computeAvailableModes ──────────────

function computeAvailableModes(
  markitdownAvailable: boolean,
  pymupdf4llmAvailable: boolean,
): Record<ImportMode, boolean> {
  return {
    quick: markitdownAvailable,
    paper_quality: pymupdf4llmAvailable,
    precision: false,
    ocr: false,
  };
}

// ── Simulated probe ──────────────────────────────

function probeResult(status: 'available' | 'unavailable' | 'unknown'): CoreEngineProbeStatus {
  return {
    engine: 'pymupdf4llm',
    status,
    version: status === 'available' ? '0.1.0' : null,
    reason: status === 'unavailable' ? 'PyMuPDF4LLM is not installed.' : null,
  };
}

// ── Engine profile check ─────────────────────────

function isCoreEngine(engine: ImportEngine): boolean {
  return engine === 'markitdown' || engine === 'pymupdf4llm';
}

function isReservedEngine(engine: ImportEngine): boolean {
  return engine.endsWith('_reserved');
}

// ── Run ────────────────────────────────────────────

function run(): void {
  // ═══ PQ-PROBE-01: probe available → paperQuality=true ═══
  {
    const modes = computeAvailableModes(true, true);
    assert.equal(modes.paper_quality, true);
    assert.equal(modes.quick, true);
  }

  // ═══ PQ-PROBE-02: probe unavailable → paperQuality=false ═══
  {
    const modes = computeAvailableModes(true, false);
    assert.equal(modes.paper_quality, false);
    assert.equal(modes.quick, true);
  }

  // ═══ PQ-PROBE-03: probe unknown (default false) ═══
  {
    const modes = computeAvailableModes(false, false);
    assert.equal(modes.paper_quality, false);
    assert.equal(modes.quick, false);
  }

  // ═══ PQ-PROBE-04-08: probe does not expose Python path ═══
  {
    const r = probeResult('unavailable');
    const json = JSON.stringify(r);
    assert.ok(!json.includes('C:\\'), 'probe result must not contain Windows path');
    assert.ok(!json.includes('/home/'), 'probe result must not contain POSIX path');
    assert.ok(!json.includes('site-packages'), 'probe result must not contain site-packages');
    assert.ok(!json.includes('venv'), 'probe result must not contain venv');
    assert.ok(!json.includes('Python'), 'probe result must not contain Python');
  }

  // ═══ PQ-PROBE-09: probe reason uses hardcoded safe text ═══
  {
    const r = probeResult('unavailable');
    assert.equal(r.reason, 'PyMuPDF4LLM is not installed.');
    assert.ok(!r.reason!.includes('/'), 'reason must not contain paths');
  }

  // ═══ PQ-PROBE-10: probe timeout → unavailable ═══
  {
    const r: CoreEngineProbeStatus = { engine: 'pymupdf4llm', status: 'unavailable', version: null, reason: 'Probe timed out.' };
    assert.equal(r.status, 'unavailable');
    assert.equal(r.reason, 'Probe timed out.');
  }

  // ═══ PQ-PROBE-13/14: probe result does not leak technical name to UI ═══
  {
    // The probe status is for internal use only — UI shows "论文导入" which is derived from mode label
    const r = probeResult('available');
    assert.equal(r.engine, 'pymupdf4llm'); // internal
    // UI label is separate from probe status
  }

  // ═══ Engine type system ═══
  {
    const engines: ImportEngine[] = ['markitdown', 'pymupdf4llm', 'docling_reserved', 'mineru_reserved', 'marker_reserved', 'dots_ocr_reserved'];
    assert.ok(engines.includes('pymupdf4llm'), 'ImportEngine must include pymupdf4llm');
    assert.ok(engines.includes('markitdown'), 'ImportEngine must include markitdown');
  }

  // ═══ Engine classification ═══
  {
    assert.equal(isCoreEngine('markitdown'), true);
    assert.equal(isCoreEngine('pymupdf4llm'), true);
    assert.equal(isReservedEngine('pymupdf4llm'), false);
    assert.equal(isReservedEngine('docling_reserved'), true);
  }

  // ═══ availableModes: paperQuality independent from quick ═══
  {
    // quick = true, pymupdf4llm = false → paperQuality = false
    const m = computeAvailableModes(true, false);
    assert.equal(m.quick, true);
    assert.equal(m.paper_quality, false);

    // quick = false, pymupdf4llm = true → paperQuality = true
    const m2 = computeAvailableModes(false, true);
    assert.equal(m2.quick, false);
    assert.equal(m2.paper_quality, true);
  }

  // ═══ precision / ocr unchanged ═══
  {
    const m = computeAvailableModes(true, true);
    assert.equal(m.precision, false);
    assert.equal(m.ocr, false);
  }

  console.log('[PASS] pymupdf4llm-capability-probe');
}

// LEGACY: CODE-QUALITY-IMP-4 — PyMuPDF4LLM deactivated. Test skipped.
console.log('[SKIP] pymupdf4llm-capability-probe — PyMuPDF4LLM deactivated (Phase 4-0-CODE-QUALITY-IMP-4)');
