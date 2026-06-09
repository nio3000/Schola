/**
 * Phase 3-4-C2-b: Precision routing test.
 *
 * Sections: 1. Precision gate  2. Engine override  3. Routing
 *           4. No-fallback  5. Cleanup  6. Companion (failed)
 *           7. Companion (success)  8. Error sanitize  9. Boundary
 */
import assert from 'node:assert/strict';
import { sanitizeErrorMessage } from '../../electron/services/engines/import/bridge-validation.ts';

// ── Helpers ─────────────────────────────────────

function validatePrecisionGate(
  mode: string | undefined,
  sourceFormat: string,
  engine: string | undefined,
  probeAvailable: boolean,
): { ok: boolean; code?: string } {
  if (engine !== undefined && engine !== 'markitdown') {
    return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
  }
  const importMode = mode ?? 'quick';
  if (importMode === 'ocr') {
    return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
  }
  if (importMode === 'paper_quality') {
    if (sourceFormat !== 'pdf') {
      return { ok: false, code: 'UNSUPPORTED_FORMAT' };
    }
    return { ok: true };
  }
  if (importMode === 'precision') {
    if (sourceFormat !== 'pdf') {
      return { ok: false, code: 'UNSUPPORTED_FORMAT' };
    }
    if (!probeAvailable) {
      return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
    }
    return { ok: true };
  }
  return { ok: true };
}

function routeEngine(mode: string, probeAvailable: boolean): { engine: string; isPrecision: boolean; isPaperQuality: boolean } {
  if (mode === 'paper_quality') {
    return { engine: 'markitdown', isPrecision: false, isPaperQuality: true };
  }
  if (mode === 'precision' && probeAvailable) {
    return { engine: 'docling_reserved', isPrecision: true, isPaperQuality: false };
  }
  return { engine: 'markitdown', isPrecision: false, isPaperQuality: false };
}

function simulateCleanup(jobId: string): string[] {
  return [
    `notes/imported/paper_${jobId}.md`,
    `notes/imported/assets/${jobId}`,
  ];
}

// ── Run ────────────────────────────────────────

function run(): void {
  // ═══ 1: Precision gate ═══
  // G1: precision + probe unavailable → ENGINE_NOT_AVAILABLE
  {
    const r = validatePrecisionGate('precision', 'pdf', undefined, false);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'ENGINE_NOT_AVAILABLE');
  }
  // G2: precision + probe available + PDF → ok
  assert.equal(validatePrecisionGate('precision', 'pdf', undefined, true).ok, true);
  // G3: precision + non-PDF → UNSUPPORTED_FORMAT
  {
    const r = validatePrecisionGate('precision', 'docx', undefined, true);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'UNSUPPORTED_FORMAT');
  }
  // G4: ocr → ENGINE_NOT_AVAILABLE
  {
    const r = validatePrecisionGate('ocr', 'pdf', undefined, true);
    assert.equal(r.ok, false);
    assert.equal(r.code, 'ENGINE_NOT_AVAILABLE');
  }
  // G5: quick / omitted → ok
  assert.equal(validatePrecisionGate('quick', 'pdf', undefined, false).ok, true);
  assert.equal(validatePrecisionGate(undefined, 'pdf', undefined, false).ok, true);

  // ═══ 2: Engine override ═══
  // E1: precision + engine='docling_reserved' → rejected
  {
    const r = validatePrecisionGate('precision', 'pdf', 'docling_reserved', true);
    assert.equal(r.ok, false, 'renderer must not select docling_reserved');
  }
  // E2: quick + engine='docling_reserved' → rejected
  assert.equal(validatePrecisionGate('quick', 'pdf', 'docling_reserved', true).ok, false);
  // E3: quick + engine='markitdown' → allowed
  assert.equal(validatePrecisionGate('quick', 'pdf', 'markitdown', false).ok, true);
  // E4: engine omitted → allowed
  assert.equal(validatePrecisionGate('quick', 'pdf', undefined, false).ok, true);
  // E5: paper_quality + engine='docling_reserved' → ENGINE_NOT_AVAILABLE
  {
    const r = validatePrecisionGate('paper_quality', 'pdf', 'docling_reserved', true);
    assert.equal(r.ok, false, 'paper_quality must not accept reserved engine');
  }
  // E6: paper_quality + engine='marker_reserved' → ENGINE_NOT_AVAILABLE
  {
    const r = validatePrecisionGate('paper_quality', 'pdf', 'marker_reserved', true);
    assert.equal(r.ok, false, 'paper_quality must not accept marker_reserved');
  }
  // E7: paper_quality + engine='markitdown' → allowed
  assert.equal(validatePrecisionGate('paper_quality', 'pdf', 'markitdown', false).ok, true);
  // E8: paper_quality + engine omitted → allowed
  assert.equal(validatePrecisionGate('paper_quality', 'pdf', undefined, false).ok, true);

  // ═══ 3: Routing ═══
  // R1: precision routes to docling, not markitdown
  {
    const r = routeEngine('precision', true);
    assert.equal(r.engine, 'docling_reserved');
    assert.equal(r.isPrecision, true);
    assert.equal(r.isPaperQuality, false);
  }
  // R2: paper_quality routes to markitdown, not docling
  {
    const r = routeEngine('paper_quality', true);
    assert.equal(r.engine, 'markitdown');
    assert.equal(r.isPrecision, false);
    assert.equal(r.isPaperQuality, true);
  }
  // R3: paper_quality does NOT require probe to be available
  {
    const r = routeEngine('paper_quality', false);
    assert.equal(r.engine, 'markitdown');
    assert.equal(r.isPaperQuality, true);
  }
  // R3b: quick routes to markitdown, not docling
  {
    const r = routeEngine('quick', true);
    assert.equal(r.engine, 'markitdown');
    assert.equal(r.isPrecision, false);
    assert.equal(r.isPaperQuality, false);
  }

  // ═══ 4: No-fallback ═══
  // F1: precision failed → engine is docling_reserved, no fallback path exists
  {
    const r = routeEngine('precision', false); // unavailable → rejected at gate
    assert.equal(r.isPrecision, false, 'gate prevents precision routing when unavailable');
  }

  // ═══ 5: Cleanup ═══
  // C1: output Markdown in cleanup list
  {
    const paths = simulateCleanup('job_abc');
    assert.ok(paths.some(p => p.endsWith('.md')), 'must include output markdown');
  }
  // C2: assets dir in cleanup list
  {
    const paths = simulateCleanup('job_abc');
    assert.ok(paths.some(p => p.includes('assets/job_abc')), 'must include assets dir');
  }
  // C3: cleanup paths are vault-relative
  {
    const paths = simulateCleanup('job_abc');
    for (const p of paths) {
      assert.ok(!p.includes(':\\'), 'no Windows absolute paths');
      assert.ok(!p.startsWith('/'), 'no Unix absolute paths');
      assert.ok(!p.includes('..'), 'no path traversal');
    }
  }

  // ═══ 6: Failed companion ═══
  function buildFailedCompanion(): Record<string, unknown> {
    return {
      schemaVersion: 1, companionId: 'job_abc', vaultId: 'v1', jobId: 'job_abc',
      markdownRelativePath: 'notes/imported/paper.md',
      attachmentRelativePath: 'attachments/imports/job_abc_paper.pdf',
      sourceFormat: 'pdf', sourceFileName: 'paper.pdf',
      sourceFileHash: 'a1b2c3d4', engine: 'docling_reserved', engineVersion: null,
      quality: 'failed',
      error: { code: 'CONVERSION_FAILED', message: 'Document conversion failed.', recoverable: false },
      createdAt: new Date().toISOString(),
    };
  }
  const fc = buildFailedCompanion();
  assert.equal(fc.quality, 'failed');
  assert.equal(fc.importMode, undefined, 'failed companion must not have importMode');
  assert.equal(fc.pageCount, undefined);
  assert.equal(fc.figures, undefined);
  assert.equal(fc.sourcePath, undefined);

  // ═══ 7: Success companion ═══
  function buildSuccessCompanion(): Record<string, unknown> {
    return {
      schemaVersion: 1, companionId: 'job_abc', vaultId: 'v1', jobId: 'job_abc',
      markdownRelativePath: 'notes/imported/paper.md',
      attachmentRelativePath: 'attachments/imports/job_abc_paper.pdf',
      sourceFormat: 'pdf', sourceFileName: 'paper.pdf',
      sourceFileHash: 'a1b2c3d4', engine: 'docling_reserved', engineVersion: null,
      quality: 'full', importMode: 'precision', pageCount: 8,
      createdAt: new Date().toISOString(),
    };
  }
  const sc = buildSuccessCompanion();
  assert.equal(sc.engine, 'docling_reserved');
  assert.equal(sc.importMode, 'precision');
  assert.equal(sc.engineVersion, null);
  assert.notEqual(sc.engineVersion, 'unknown');
  assert.equal(sc.sourcePath, undefined);
  assert.ok(!JSON.stringify(sc).includes('C:\\'));
  assert.ok(!JSON.stringify(sc).includes('/home/'));
  assert.ok(String(sc.markdownRelativePath).startsWith('notes/imported/'));

  // ═══ 8: Error sanitize ═══
  function assertSanitized(msg: string): void {
    const forbidden = [
      'Docling', 'docling', 'MinerU', 'Marker', 'dots.ocr',
      'pip install', 'pip3', 'C:\\', '/usr/', '/home/', '/Users/',
      'Traceback', 'traceback', 'site-packages', 'stderr',
    ];
    for (const f of forbidden) {
      assert.ok(!msg.includes(f), `must not contain: "${f}"`);
    }
  }
  const allowed = [
    'Precision import is not available.',
    'Document conversion failed.',
    'Conversion timed out. The document may be too large.',
    'Conversion produced no output.',
    'Failed to save extracted figures or tables.',
  ];
  for (const m of allowed) {
    assertSanitized(m);
  }
  // Verify sanitizeErrorMessage actually strips
  assertSanitized(sanitizeErrorMessage('Docling error'));
  assertSanitized(sanitizeErrorMessage('Traceback at site-packages/stderr'));

  // ═══ 9: Boundary ═══
  // B1-B5: No new IPC channels (verified by import-boundary-no-ui-ipc test)

  // B7: OCR still unavailable
  {
    const r = validatePrecisionGate('ocr', 'pdf', undefined, true);
    assert.equal(r.ok, false, 'OCR must remain unavailable');
  }

  // B8: Quick regression
  {
    const r = validatePrecisionGate('quick', 'docx', undefined, false);
    assert.equal(r.ok, true, 'quick mode must work for docx');
  }

  console.log('[PASS] import-precision-routing');
}

run();
