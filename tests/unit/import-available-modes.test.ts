/**
 * Phase 3-4-D / Phase 3-4-F0 / Phase 3-4-H2 / Phase 3-4-I: Available modes IPC test.
 *
 * Sections: 1. Handler response shape  2. Snapshot null behavior
 *           3. No engine leak  4. ComputeAvailableModes purity
 *           5. Channel constants  6. F0: precision=false is default safe
 *           7. H2: paperQuality is included
 *           8. I: paperQuality depends on pymupdf4llm probe, not markitdown
 */
import assert from 'node:assert/strict';

// ── Helpers ─────────────────────────────────────

function handleGetAvailableModes(snapshot: { precision: boolean; pymupdf4llm?: boolean } | null) {
  return {
    ok: true as const,
    modes: {
      quick: true,
      paperQuality: snapshot?.pymupdf4llm ?? false,
      precision: snapshot?.precision ?? false,
      ocr: false,
    },
  };
}

// Simulate computeAvailableModes (pure function, reads _snapshot)
let _snapshot: { precision: boolean; pymupdf4llm: boolean } | null = null;
let probeCalled = false;

function getEngineCapabilitySnapshot(): { precision: boolean; pymupdf4llm: boolean } | null {
  return _snapshot;
}

function computeAvailableModes(): { quick: boolean; paper_quality: boolean; precision: boolean; ocr: boolean } {
  const s = getEngineCapabilitySnapshot();
  return {
    quick: true,
    paper_quality: s?.pymupdf4llm ?? false,
    precision: s?.precision ?? false,
    ocr: false,
  };
}

async function probeAllReservedEngines(): Promise<void> {
  probeCalled = true;
  await new Promise(resolve => setTimeout(resolve, 1));
  _snapshot = { precision: true, pymupdf4llm: true };
}

// ── Run ────────────────────────────────────────

async function run(): Promise<void> {
  // ═══ 1: Handler response shape ═══
  {
    const res = handleGetAvailableModes({ precision: true, pymupdf4llm: true });
    assert.equal(res.ok, true);
    assert.equal(typeof res.modes.quick, 'boolean');
    assert.equal(typeof res.modes.paperQuality, 'boolean');
    assert.equal(typeof res.modes.precision, 'boolean');
    assert.equal(typeof res.modes.ocr, 'boolean');
    assert.equal(res.modes.precision, true);
    assert.equal(res.modes.paperQuality, true);
  }

  // ═══ 2: Snapshot null → paperQuality=false, precision=false ═══
  {
    const res = handleGetAvailableModes(null);
    assert.equal(res.modes.precision, false);
    assert.equal(res.modes.quick, true);
    assert.equal(res.modes.paperQuality, false);
    assert.equal(res.modes.ocr, false);
  }

  // precision available, pymupdf4llm not
  {
    const res = handleGetAvailableModes({ precision: true, pymupdf4llm: false });
    assert.equal(res.modes.precision, true);
    assert.equal(res.modes.paperQuality, false);
    assert.equal(res.modes.quick, true);
  }

  // ═══ 3: Response does not leak engine/version/reason ═══
  for (const snap of [null, { precision: true, pymupdf4llm: true }, { precision: false, pymupdf4llm: false }]) {
    const json = JSON.stringify(handleGetAvailableModes(snap));
    assert.ok(!json.includes('engine'), 'must not leak engine');
    assert.ok(!json.includes('version'), 'must not leak version');
    assert.ok(!json.includes('reason'), 'must not leak reason');
    assert.ok(!json.includes('docling_reserved'), 'must not leak docling_reserved');
    assert.ok(!json.includes('pymupdf4llm'), 'must not leak pymupdf4llm');
    assert.ok(!json.includes('provider'), 'must not leak provider');
    assert.ok(!json.includes('Python'), 'must not leak Python');
    assert.ok(!json.includes('path'), 'must not leak path');
    assert.ok(!json.includes('probe'), 'must not leak probe status');
    assert.ok(!json.includes('snapshot'), 'must not leak snapshot');
  }

  // ═══ 4: computeAvailableModes is pure ═══
  {
    _snapshot = null;
    const a = computeAvailableModes().precision;
    const b = computeAvailableModes().precision;
    assert.equal(a, b, 'pure: same result for same snapshot');

    _snapshot = { precision: true, pymupdf4llm: true };
    assert.equal(computeAvailableModes().precision, true);
    assert.equal(computeAvailableModes().paper_quality, true);
  }

  // ═══ 5: Fire-and-forget probe — snapshot still null before probe resolves ═══
  {
    _snapshot = null;
    probeCalled = false;

    const probePromise = probeAllReservedEngines();
    assert.equal(computeAvailableModes().precision, false);
    assert.equal(computeAvailableModes().paper_quality, false);
    assert.equal(probeCalled, true);
    await probePromise;
    assert.equal(computeAvailableModes().precision, true);
    assert.equal(computeAvailableModes().paper_quality, true);
  }

  // ═══ 6: Channel name correctness ═══
  {
    const IMPORT_GET_AVAILABLE_MODES_CHANNEL = 'import:get-available-modes';
    assert.equal(typeof IMPORT_GET_AVAILABLE_MODES_CHANNEL, 'string');
    assert.equal(IMPORT_GET_AVAILABLE_MODES_CHANNEL, 'import:get-available-modes');
  }

  // ═══ 6: F0 — precision=false is the default safe behavior ═══
  {
    _snapshot = null;
    assert.equal(computeAvailableModes().precision, false, 'F0: precision must be false when no snapshot');
    assert.equal(computeAvailableModes().quick, true, 'F0: quick must remain true');
    assert.equal(computeAvailableModes().ocr, false, 'F0: ocr must remain false');
    assert.equal(computeAvailableModes().paper_quality, false, 'F0: paperQuality must be false when no probe');

    _snapshot = { precision: false, pymupdf4llm: false };
    assert.equal(computeAvailableModes().precision, false);
  }

  // ═══ 7: I — paperQuality depends on pymupdf4llm probe ═══
  {
    _snapshot = null;
    assert.equal(computeAvailableModes().paper_quality, false, 'I: paperQuality false when no probe');

    _snapshot = { precision: false, pymupdf4llm: false };
    assert.equal(computeAvailableModes().paper_quality, false, 'I: paperQuality false when pymupdf4llm unavailable');

    _snapshot = { precision: false, pymupdf4llm: true };
    assert.equal(computeAvailableModes().paper_quality, true, 'I: paperQuality true when pymupdf4llm available');

    // paperQuality independent from precision
    _snapshot = { precision: true, pymupdf4llm: false };
    assert.equal(computeAvailableModes().paper_quality, false, 'I: paperQuality false when pymupdf4llm unavailable (precision true)');
  }

  console.log('[PASS] import-available-modes');
}

await run();
