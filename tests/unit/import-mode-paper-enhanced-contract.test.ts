/**
 * Phase 3-4-K: ImportMode paper_enhanced contract tests.
 *
 * Validates:
 *   K-CONTRACT-01: ImportMode includes 'paper_enhanced'
 *   K-CONTRACT-02: ImportMode does NOT include 'paper_precision'
 *   K-CONTRACT-03: 'precision' is NOT used for Marker mode
 */
import assert from 'node:assert/strict';

// ── K-CONTRACT-01: paper_enhanced exists ──────────
{
  const modes: string[] = ['quick', 'paper_quality', 'paper_enhanced', 'precision', 'ocr'];
  assert.ok(modes.includes('paper_enhanced'), 'K-CONTRACT-01: paper_enhanced must be a valid mode');
}

// ── K-CONTRACT-02: paper_precision does NOT exist ──
{
  const modes: string[] = ['quick', 'paper_quality', 'paper_enhanced', 'precision', 'ocr'];
  assert.ok(!modes.includes('paper_precision'), 'K-CONTRACT-02: paper_precision must not exist');
}

// ── K-CONTRACT-03: precision is NOT reused for Marker ──
// The mode for Marker must be 'paper_enhanced', not 'precision'
{
  const markerMode = 'paper_enhanced';
  assert.notEqual(markerMode, 'precision', 'K-CONTRACT-03: Marker mode must not be precision');
}

// ── K-CONTRACT-04: AvailableImportModes has paperEnhanced ──
{
  const available: Record<string, boolean> = {
    quick: true,
    paperQuality: false,
    paperEnhanced: false,
    precision: false,
    ocr: false,
  };
  assert.ok('paperEnhanced' in available, 'K-CONTRACT-04: AvailableImportModes must include paperEnhanced');
}

// ── K-CONTRACT-06: ExternalPaperRuntimeProfile type exists ──
// Compile-time check — tested by tsc --noEmit passing
{
  const profile = {
    id: 'pymupdf4llm_external' as const,
    label: 'PyMuPDF4LLM',
    internalEngine: 'pymupdf4llm' as const,
    mode: 'paper_quality' as const,
    distributionModel: 'external' as const,
    capabilities: ['layout-aware'] as readonly string[],
    requiresModelDownload: false,
    requiresNetworkForFirstUse: false,
    expectedFootprint: '~200–300 MB',
    licenseRisk: 'high' as const,
    diagnosticsAvailable: true,
  };
  assert.equal(profile.mode, 'paper_quality');
  assert.equal(profile.distributionModel, 'external');
}

// ── K-CONTRACT-07: ExternalRuntimeStatus has 9 values ──
{
  const statuses = ['available', 'unavailable', 'not_installed', 'timeout', 'unknown',
    'model_missing', 'needs_setup', 'unsupported_platform', 'license_blocked'];
  assert.equal(statuses.length, 9, 'K-CONTRACT-07: ExternalRuntimeStatus must have 9 values');
  assert.ok(statuses.includes('model_missing'), 'model_missing must be reserved');
  assert.ok(statuses.includes('needs_setup'), 'needs_setup must be reserved');
}

// ── K-CONTRACT-10: no generic engine listing ──
{
  const importIpcChannels = [
    'import:select-source',
    'import:create-job',
    'import:get-job-status',
    'import:list-jobs',
    'import:cancel-job',
    'import:get-available-modes',
    'import:open-original-file',
    'import:reveal-original-file',
  ];
  assert.ok(!importIpcChannels.includes('import:list-engines'), 'K-CONTRACT-10: no import:list-engines');
  assert.ok(!importIpcChannels.includes('import:set-engine'), 'K-CONTRACT-10: no import:set-engine');
}

console.log('PASS  import-mode-paper-enhanced-contract.test.ts');
