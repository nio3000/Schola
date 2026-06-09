/**
 * External paper import runtime registry — Phase 3-4-K.
 *
 * Controlled, hard-coded registry of known external paper import runtimes.
 * NOT a plugin system.  New entries require code changes.
 *
 * ⚠️  Main-process-internal only.  Never exposed to renderer via IPC.
 */

import type { ExternalPaperRuntimeProfile } from '../../../../src/lib/contracts/external-runtime.types';

// ── Registry Entries ────────────────────────────

const PYMUPDF4LLM_EXTERNAL: ExternalPaperRuntimeProfile = {
  id: 'pymupdf4llm_external',
  label: 'PyMuPDF4LLM',
  internalEngine: 'pymupdf4llm',
  mode: 'paper_quality',
  distributionModel: 'external',
  capabilities: [
    'layout-aware',
    'figure-extraction',
    'table-extraction',
    'reference-extraction',
  ],
  requiresModelDownload: false,
  requiresNetworkForFirstUse: false,
  expectedFootprint: '~200–300 MB',
  licenseRisk: 'high',
  diagnosticsAvailable: true,
};

const MARKER_EXTERNAL: ExternalPaperRuntimeProfile = {
  id: 'marker_external',
  label: 'Marker',
  internalEngine: 'marker',
  mode: 'paper_enhanced',
  distributionModel: 'external',
  capabilities: [
    'layout-aware',
    'figure-extraction',
    'table-extraction',
    'equation-extraction',
    'high-fidelity',
  ],
  requiresModelDownload: true,
  requiresNetworkForFirstUse: true,
  expectedFootprint: '2–5 GB',
  licenseRisk: 'medium',
  diagnosticsAvailable: true,
};

// ── Registry ────────────────────────────────────

/**
 * Controlled registry of external paper import runtimes.
 *
 * Read-only.  Never user-configurable.  New runtimes require
 * adding a new entry to this array in a code change.
 */
export const EXTERNAL_PAPER_RUNTIME_REGISTRY: readonly ExternalPaperRuntimeProfile[] =
  Object.freeze([
    PYMUPDF4LLM_EXTERNAL,
    MARKER_EXTERNAL,
    // Future entries (Phase 4-0+):
    // MINERU_EXTERNAL,
    // DOCLING_EXTERNAL,
  ]);

// ── Lookup Helpers ──────────────────────────────

export function getExternalProfileById(
  id: ExternalPaperRuntimeProfile['id'],
): ExternalPaperRuntimeProfile | undefined {
  return EXTERNAL_PAPER_RUNTIME_REGISTRY.find((p) => p.id === id);
}

export function getExternalProfileByMode(
  mode: ExternalPaperRuntimeProfile['mode'],
): ExternalPaperRuntimeProfile | undefined {
  return EXTERNAL_PAPER_RUNTIME_REGISTRY.find((p) => p.mode === mode);
}
