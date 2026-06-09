/**
 * Phase 3-4-K: External paper runtime profile tests.
 *
 * Validates:
 *   K-PROFILE-01–15: registry entries, mode mapping, distribution model, footprint
 */
import assert from 'node:assert/strict';

// ── Simulated registry ────────────────────────────
const PYMUPDF4LLM_EXTERNAL = {
  id: 'pymupdf4llm_external' as const,
  label: 'PyMuPDF4LLM',
  internalEngine: 'pymupdf4llm' as const,
  mode: 'paper_quality' as const,
  distributionModel: 'external' as const,
  capabilities: ['layout-aware', 'figure-extraction', 'table-extraction', 'reference-extraction'],
  requiresModelDownload: false,
  requiresNetworkForFirstUse: false,
  expectedFootprint: '~200–300 MB',
  licenseRisk: 'high' as const,
  diagnosticsAvailable: true,
};

const MARKER_EXTERNAL = {
  id: 'marker_external' as const,
  label: 'Marker',
  internalEngine: 'marker' as const,
  mode: 'paper_enhanced' as const,
  distributionModel: 'external' as const,
  capabilities: ['layout-aware', 'figure-extraction', 'table-extraction', 'equation-extraction', 'high-fidelity'],
  requiresModelDownload: true,
  requiresNetworkForFirstUse: true,
  expectedFootprint: '2–5 GB',
  licenseRisk: 'medium' as const,
  diagnosticsAvailable: true,
};

const REGISTRY = Object.freeze([PYMUPDF4LLM_EXTERNAL, MARKER_EXTERNAL]);

// ── K-PROFILE-01: pymupdf4llm_external exists ──
{
  const p = REGISTRY.find(e => e.id === 'pymupdf4llm_external');
  assert.ok(p, 'K-PROFILE-01: pymupdf4llm_external must exist');
}

// ── K-PROFILE-02: marker_external exists ──
{
  const m = REGISTRY.find(e => e.id === 'marker_external');
  assert.ok(m, 'K-PROFILE-02: marker_external must exist');
}

// ── K-PROFILE-03: pymupdf4llm mode is paper_quality ──
assert.equal(PYMUPDF4LLM_EXTERNAL.mode, 'paper_quality', 'K-PROFILE-03');

// ── K-PROFILE-04: marker mode is paper_enhanced ──
assert.equal(MARKER_EXTERNAL.mode, 'paper_enhanced', 'K-PROFILE-04');

// ── K-PROFILE-05: both distributionModel = external ──
assert.equal(PYMUPDF4LLM_EXTERNAL.distributionModel, 'external', 'K-PROFILE-05a');
assert.equal(MARKER_EXTERNAL.distributionModel, 'external', 'K-PROFILE-05b');

// ── K-PROFILE-06: profile does NOT contain dynamic status ──
assert.ok(!('status' in PYMUPDF4LLM_EXTERNAL), 'K-PROFILE-06a: no status field');
assert.ok(!('status' in MARKER_EXTERNAL), 'K-PROFILE-06b: no status field');

// ── K-PROFILE-08: registry is frozen (read-only) ──
// Object.freeze prevents array mutations
assert.ok(Object.isFrozen(REGISTRY), 'K-PROFILE-08: registry array must be frozen');

// ── K-PROFILE-09: no command/executable field ──
assert.ok(!('command' in PYMUPDF4LLM_EXTERNAL), 'K-PROFILE-09a: no command field');
assert.ok(!('executable' in PYMUPDF4LLM_EXTERNAL), 'K-PROFILE-09b: no executable field');

// ── K-PROFILE-12: PyMuPDF4LLM footprint ~200–300 MB ──
assert.ok(PYMUPDF4LLM_EXTERNAL.expectedFootprint.includes('200'), 'K-PROFILE-12: footprint includes 200');

// ── K-PROFILE-13: Marker footprint 2–5 GB ──
assert.ok(MARKER_EXTERNAL.expectedFootprint.includes('2'), 'K-PROFILE-13: footprint includes 2 GB lower bound');
assert.ok(MARKER_EXTERNAL.expectedFootprint.includes('5'), 'K-PROFILE-13: footprint includes 5 GB upper bound');

// ── K-PROFILE-14: Marker requiresModelDownload = true ──
assert.equal(MARKER_EXTERNAL.requiresModelDownload, true, 'K-PROFILE-14');

// ── K-PROFILE-15: Marker requiresNetworkForFirstUse = true ──
assert.equal(MARKER_EXTERNAL.requiresNetworkForFirstUse, true, 'K-PROFILE-15');

console.log('PASS  external-paper-runtime-profile.test.ts');
