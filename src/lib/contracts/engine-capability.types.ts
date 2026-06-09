/**
 * Engine capability probe types — Phase 3-4-B2.
 *
 * Defines the capability probe result types and snapshot structure
 * for reserved import engines.  Does NOT cover MarkItDown (tracked
 * separately by runtime-check.service.ts).
 *
 * ⚠️  All types MUST NOT contain:
 *     - System absolute paths (C:\, /usr/, /home/)
 *     - User file paths
 *     - sourcePath
 *     - Full stderr / traceback output
 *     - Environment variables
 *     - API keys / tokens
 */

import type { ImportEngine, ImportMode } from './import.types';

// ── Reserved Engine Subset ─────────────────────

/**
 * Reserved import engines — subset of ImportEngine.
 *
 * These engines are type-system placeholders. They are detected
 * by the capability probe but never directly called for conversion
 * in Phase 3-4-B2.
 *
 * 'markitdown' is intentionally ABSENT — it is the active default
 * engine, tracked separately via runtime-check.service.ts
 * (RuntimeAvailabilityResult).
 */
export type ReservedImportEngine =
  | 'docling_reserved'
  | 'mineru_reserved'
  | 'marker_reserved'
  | 'dots_ocr_reserved';

// ── Probe Strategy ─────────────────────────────

/**
 * Detection strategy for a reserved engine capability probe.
 * Selected per engine based on available entry points.
 */
export type ProbeStrategy = 'python-module' | 'cli-version';

// ── Per-Engine Probe Result ────────────────────

/**
 * Capability probe result for a single reserved engine.
 *
 * ⚠️  MUST NOT contain system paths, user file paths, sourcePath,
 *     full stderr, tracebacks, or environment variables.
 */
export interface ReservedEngineProbeStatus {
  /** Reserved engine identifier. */
  readonly engine: ReservedImportEngine;

  /**
   * Probe outcome.
   *
   * 'available'   — engine runtime is installed and functional.
   * 'unavailable' — probe succeeded but engine is not functional
   *                 (e.g. import failed, version too old).
   * 'unknown'     — probe could not be attempted (e.g. no Python,
   *                 or Phase 3-4-B2 stub before real probe).
   */
  readonly status: 'available' | 'unavailable' | 'unknown';

  /**
   * Detected version string (e.g. '2.15.0'), or null.
   * Truncated to 50 characters.
   */
  readonly version: string | null;

  /**
   * Human-readable reason for unavailability or unknown status.
   * null when status === 'available'.
   * Truncated to 200 characters.
   * MUST NOT contain: system paths, tracebacks, site-packages.
   */
  readonly reason: string | null;

  /** ISO 8601 timestamp of this probe. */
  readonly checkedAt: string;

  /**
   * Probe method used, or null if probe was not attempted.
   */
  readonly probeMethod: ProbeStrategy | null;

  /**
   * Error classification for diagnostics.
   *
   * null when:
   *   - status === 'available', OR
   *   - status === 'unknown' in Phase 3-4-B2 stub
   *     (no real probe has been attempted yet).
   *
   * Populated in Phase 3-4-C+ when real Python/CLI probes execute.
   */
  readonly errorCode:
    | 'NO_PYTHON'
    | 'NOT_INSTALLED'
    | 'IMPORT_FAILED'
    | 'VERSION_UNREADABLE'
    | 'TIMEOUT'
    | 'UNKNOWN_ERROR'
    | null;
}

// ── Capability Snapshot ────────────────────────

/**
 * Complete capability snapshot for all reserved import engines.
 *
 * Computed once per probe cycle and cached in memory.
 * Consumers compute elapsed time via:
 *   Date.now() - Date.parse(snapshot.checkedAt)
 */
export interface EngineCapabilitySnapshot {
  /** ISO 8601 timestamp when this snapshot was taken. */
  readonly checkedAt: string;

  /**
   * Per-engine probe results.
   *
   * Keys are reserved import engines ONLY.
   * 'markitdown' is intentionally ABSENT — its availability
   * comes from runtime-check.service.ts independently.
   */
  readonly engines: Record<ReservedImportEngine, ReservedEngineProbeStatus>;

  /**
   * Computed mode availability.
   *
   * - quick:     true iff MarkItDown runtime is available
   *              (checked via runtime-check.service.ts).
   * - precision: true iff ≥1 reserved precision engine is available.
   * - ocr:       true iff ≥1 reserved OCR engine is available.
   */
  readonly availableModes: Record<ImportMode, boolean>;

  /**
   * Engines backing each mode.
   *
   * - modeEngines.quick: derived from MarkItDown runtime check.
   *   May contain 'markitdown'. NOT derivable from `engines`.
   *
   * - modeEngines.precision: derived from `engines`, filtered to
   *   reserved engines where status === 'available' AND
   *   RESERVED_IMPORT_ENGINES[engine].mode === 'precision'.
   *
   * - modeEngines.ocr: derived from `engines`, filtered to
   *   reserved engines where status === 'available' AND
   *   RESERVED_IMPORT_ENGINES[engine].mode === 'ocr'.
   */
  readonly modeEngines: Record<ImportMode, ImportEngine[]>;
}
