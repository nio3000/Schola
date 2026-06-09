/**
 * External paper import runtime types — Phase 3-4-K.
 *
 * Defines the controlled ExternalPaperRuntimeProfile and ExternalRuntimeStatus
 * types for external (user-managed) paper import runtimes.
 *
 * ⚠️  NOT a plugin system.  Profiles are hard-coded in the main process,
 *     never user-configurable, never extendable by third parties.
 *
 * ⚠️  All types MUST NOT contain:
 *     - System absolute paths (C:\, /usr/, /home/)
 *     - User file paths
 *     - sourcePath
 *     - Full stderr / traceback output
 *     - Environment variables
 *     - API keys / tokens
 *     - Download URLs
 */

// ── External Runtime Profile ────────────────────

/**
 * Controlled profile entry for an external paper import runtime.
 *
 * Profiles describe static metadata.  Dynamic status (probe result)
 * is carried by CoreEngineProbeStatus, not by this type.
 */
export interface ExternalPaperRuntimeProfile {
  /** Unique profile id. Phase 4-0-B: pymupdf4llm_external is deprecated. */
  readonly id: 'pymupdf4llm_external' | 'marker_external';

  /** Internal label for diagnostics / logging. */
  readonly label: string;

  /** ImportEngine id used for internal routing. */
  readonly internalEngine: 'pymupdf4llm' | 'marker';

  /** ImportMode this runtime serves. */
  readonly mode: 'paper_quality' | 'paper_enhanced';

  /** How this runtime is distributed. */
  readonly distributionModel: 'external' | 'bundled';

  /** Key capabilities (static description). */
  readonly capabilities: readonly string[];

  /** Whether first use requires downloading model weights. */
  readonly requiresModelDownload: boolean | 'unknown';

  /** Whether first use requires network access. */
  readonly requiresNetworkForFirstUse: boolean | 'unknown';

  /** Approximate disk footprint for user awareness. */
  readonly expectedFootprint: string;

  /** License risk level for user awareness. */
  readonly licenseRisk: 'low' | 'medium' | 'high' | 'unknown';

  /** Whether diagnostics information is available. */
  readonly diagnosticsAvailable: boolean;
}

// ── External Runtime Status ─────────────────────

/**
 * Probe status for an external paper import runtime.
 *
 * K phase probes only return the first 5 values:
 *   available | unavailable | not_installed | timeout | unknown
 *
 * The remaining 4 values are reserved for future phases:
 *   model_missing  → Phase 3-4-L Marker model preflight
 *   needs_setup    → Phase 3-4-L Marker model preflight
 *   unsupported_platform → Phase 4-0+
 *   license_blocked      → Phase 4-0+
 */
export type ExternalRuntimeStatus =
  | 'available'
  | 'unavailable'
  | 'not_installed'
  | 'timeout'
  | 'unknown'
  // ── Reserved for future phases ──
  | 'model_missing'          // Phase 3-4-L
  | 'needs_setup'            // Phase 3-4-L
  | 'unsupported_platform'   // Phase 4-0+
  | 'license_blocked';       // Phase 4-0+
