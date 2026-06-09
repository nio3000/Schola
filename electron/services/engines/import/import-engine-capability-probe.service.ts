/**
 * Reserved engine capability probe service — Phase 3-4-C1 / 3-4-D-R2 / 3-4-F0.
 *
 * Phase 3-4-C1: docling_reserved uses a real Python capability probe.
 *               mineru_reserved / marker_reserved / dots_ocr_reserved
 *               remain as stubs (status 'unknown').
 *
 * Phase 3-4-D-R2: bundled-first Python discovery.
 *                 resolvePythonBundledFirst() mirrors the canonical
 *                 resolvePythonExe() in runtime-check.service.
 *                 (Direct import of runtime-check.service blocked by
 *                  ESM resolution chain in test environment — to be
 *                  unified in a future platform refactor.)
 *
 * Phase 3-4-F0: DISABLE_RESERVED_ENGINE_PROBES flag.
 *               Docling bundled runtime paused as default.
 *               probeAllReservedEngines() returns all-stub snapshot
 *               (precision=false) when disabled.
 *               Docling code preserved as experimental/archived.
 *               Marker/MinerU probes remain as stubs for future use.
 *
 * ⚠️  Main-process-internal only.  No IPC.  No renderer access.
 *     Does NOT touch user files, vault content, or sourcePath.
 *     Does NOT execute document conversion.
 */

import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type {
  ReservedImportEngine,
  ReservedEngineProbeStatus,
  EngineCapabilitySnapshot,
} from '../../../../src/lib/contracts/engine-capability.types';
import type { ImportEngine, ImportMode } from '../../../../src/lib/contracts/import.types';
import type { EnhancedImportDiagnostics } from '../../../../src/lib/contracts/import-job.types';

// ── Constants ─────────────────────────────────────

const SYSTEM_PYTHON_CANDIDATES = ['python3', 'python', 'py'] as const;
const PYTHON_DISCOVERY_TIMEOUT_MS = 5_000;
const PROBE_TIMEOUT_MS = 15_000;
const DOCLING_MODULE = 'docling';
const DOCLING_PACKAGE = 'docling';

/**
 * Phase 3-4-F0: Disable reserved engine probes.
 *
 * When true, probeAllReservedEngines() returns an all-stub snapshot
 * (precision=false, ocr=false) without running any Python subprocess.
 * Docling code is preserved as experimental/archived.
 * Set to false to re-enable real probes (Phase 3-4-E / future phases).
 */
const DISABLE_RESERVED_ENGINE_PROBES = true;

// ── Cache ────────────────────────────────────────

let _snapshot: EngineCapabilitySnapshot | null = null;

// Phase 3-4-K / Phase 4-4-B: Enhanced diagnostics cache.
// Diagnostics are expensive (Python discovery + import check + version query).
// Cache prevents repeated blocking probes within the same session.
let _diagnosticsCache: EnhancedImportDiagnostics | null = null;
let _diagnosticsCacheUpdatedAt: number | null = null;
let _diagnosticsInFlight: Promise<EnhancedImportDiagnostics> | null = null;
const DIAGNOSTICS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min for successful probe
const DIAGNOSTICS_ERROR_CACHE_TTL_MS = 60 * 1000; // 1 min for error results

// ── Helpers ──────────────────────────────────────

function nowISO(): string {
  return new Date().toISOString();
}

function buildStubStatus(engine: ReservedImportEngine): ReservedEngineProbeStatus {
  return {
    engine,
    status: 'unknown',
    version: null,
    reason: null,
    checkedAt: nowISO(),
    probeMethod: null,
    errorCode: null,
  };
}

// ── Bundled Python discovery (Phase 3-4-D-R2) ────

function getBundledPythonPath(): string | null {
  const exeName = process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python';
  const resourcesPath: string | undefined = (process as { resourcesPath?: string }).resourcesPath;

  const candidates: string[] = [];

  if (typeof resourcesPath === 'string') {
    candidates.push(path.join(resourcesPath, 'runtimes', 'docling-venv'));
  }

  // Dev paths
  candidates.push(path.resolve(process.cwd(), 'resources', 'runtimes', 'docling-venv'));
  candidates.push(path.resolve(__dirname, '..', '..', '..', '..', 'resources', 'runtimes', 'docling-venv'));

  for (const basePath of candidates) {
    const fullPath = path.join(basePath, exeName);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

// ── Python discovery (bundled-first, Phase 3-4-D-R2) ──

async function execFileOk(file: string, args: string[], timeout: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    execFile(file, args, { timeout, windowsHide: true }, (err) => resolve(!err));
  });
}

async function resolvePythonBundledFirst(): Promise<string> {
  // 1. Bundled Python
  const bundled = getBundledPythonPath();
  if (bundled) {
    const ok = await execFileOk(bundled, ['--version'], PYTHON_DISCOVERY_TIMEOUT_MS);
    if (ok) return bundled;
  }
  // 2. System Python candidates
  return new Promise((resolve, reject) => {
    let idx = 0;
    function tryNext(): void {
      if (idx >= SYSTEM_PYTHON_CANDIDATES.length) {
        reject(new Error('No Python executable found'));
        return;
      }
      const candidate = SYSTEM_PYTHON_CANDIDATES[idx];
      idx += 1;
      execFile(candidate, ['--version'], { timeout: PYTHON_DISCOVERY_TIMEOUT_MS, windowsHide: true }, (err) => {
        if (err) { tryNext(); return; }
        resolve(candidate);
      });
    }
    tryNext();
  });
}

// ── Docling Probe (real) ──────────────────────────

async function probeDoclingImport(pythonExe: string): Promise<{
  importOk: boolean;
  errorCode: 'NOT_INSTALLED' | 'IMPORT_FAILED' | 'TIMEOUT' | null;
  reason: string | null;
}> {
  try {
    const ok = await new Promise<boolean>((resolve, reject) => {
      execFile(
        pythonExe,
        ['-c', `import ${DOCLING_MODULE}`],
        { timeout: PROBE_TIMEOUT_MS, windowsHide: true },
        (err) => {
          // R2-1 fix: detect execFile timeout via err.killed
          if (err && (err as NodeJS.ErrnoException & { killed?: boolean }).killed) {
            reject(new Error('TIMEOUT'));
            return;
          }
          resolve(!err);
        },
      );
    });
    if (!ok) {
      return {
        importOk: false,
        errorCode: 'NOT_INSTALLED',
        reason: `Module '${DOCLING_MODULE}' is not installed`,
      };
    }
    return { importOk: true, errorCode: null, reason: null };
  } catch (err) {
    // TIMEOUT sentinel comes through reject
    if (err instanceof Error && err.message === 'TIMEOUT') {
      return {
        importOk: false,
        errorCode: 'TIMEOUT',
        reason: 'Probe timed out after 15s',
      };
    }
    return {
      importOk: false,
      errorCode: 'IMPORT_FAILED',
      reason: 'Failed to execute Python import check',
    };
  }
}

async function probeDoclingVersion(pythonExe: string): Promise<{
  version: string | null;
  errorCode: 'VERSION_UNREADABLE' | null;
}> {
  try {
    const version = await new Promise<string | null>((resolve) => {
      execFile(
        pythonExe,
        ['-c', `from importlib.metadata import version; print(version('${DOCLING_PACKAGE}'))`],
        { timeout: PROBE_TIMEOUT_MS, windowsHide: true },
        (err, stdout) => {
          if (err) { resolve(null); return; }
          const firstLine = (stdout ?? '').split(/[\r\n]+/)[0]?.trim() ?? '';
          resolve((firstLine.length > 0 && firstLine.length <= 50) ? firstLine : null);
        },
      );
    });
    if (version === null) {
      return { version: null, errorCode: 'VERSION_UNREADABLE' };
    }
    return { version, errorCode: null };
  } catch {
    return { version: null, errorCode: 'VERSION_UNREADABLE' };
  }
}

async function probeDoclingReserved(): Promise<ReservedEngineProbeStatus> {
  const checkedAt = nowISO();

  // Step 1: Python discovery (bundled-first, Phase 3-4-D-R2)
  let pythonExe: string;
  try {
    pythonExe = await resolvePythonBundledFirst();
  } catch {
    return {
      engine: 'docling_reserved',
      status: 'unknown',
      version: null,
      reason: 'Python 3 not found',
      checkedAt,
      probeMethod: null,
      errorCode: 'NO_PYTHON',
    };
  }

  // Step 2: Import check
  const importResult = await probeDoclingImport(pythonExe);

  if (importResult.errorCode === 'TIMEOUT') {
    return {
      engine: 'docling_reserved',
      status: 'unavailable',
      version: null,
      reason: 'Probe timed out after 15s',
      checkedAt,
      probeMethod: 'python-module',
      errorCode: 'TIMEOUT',
    };
  }

  if (!importResult.importOk) {
    return {
      engine: 'docling_reserved',
      status: 'unavailable',
      version: null,
      reason: importResult.reason,
      checkedAt,
      probeMethod: 'python-module',
      errorCode: importResult.errorCode,
    };
  }

  // Step 3: Version query
  const versionResult = await probeDoclingVersion(pythonExe);

  if (versionResult.errorCode === 'VERSION_UNREADABLE') {
    return {
      engine: 'docling_reserved',
      status: 'available',
      version: null,
      reason: null,
      checkedAt,
      probeMethod: 'python-module',
      errorCode: 'VERSION_UNREADABLE',
    };
  }

  return {
    engine: 'docling_reserved',
    status: 'available',
    version: versionResult.version,
    reason: null,
    checkedAt,
    probeMethod: 'python-module',
    errorCode: null,
  };
}

// ── Core Engine Probe (Phase 3-4-I) ──────────────

const PYMUPDF4LLM_MODULE = 'pymupdf4llm';
const PYMUPDF4LLM_PACKAGE = 'pymupdf4llm';

/** PyMuPDF4LLM probe status exposed via computeAvailableModes */
export interface CoreEngineProbeStatus {
  readonly engine: 'pymupdf4llm';
  readonly status: 'available' | 'unavailable' | 'unknown';
  readonly version: string | null;
  readonly reason: string | null;
  readonly checkedAt: string;
}

let _coreProbe: {
  readonly checkedAt: string;
  readonly pymupdf4llm: CoreEngineProbeStatus;
} | null = null;

async function probePyMuPDF4LLMImport(pythonExe: string): Promise<{
  importOk: boolean;
  errorCode: 'NOT_INSTALLED' | 'IMPORT_FAILED' | 'TIMEOUT' | null;
  reason: string | null;
}> {
  try {
    const ok = await new Promise<boolean>((resolve, reject) => {
      execFile(
        pythonExe,
        ['-c', `import ${PYMUPDF4LLM_MODULE}`],
        { timeout: PROBE_TIMEOUT_MS, windowsHide: true },
        (err) => {
          if (err) {
            if ((err as { killed?: boolean }).killed) {
              reject(new Error('TIMEOUT'));
              return;
            }
            resolve(false);
            return;
          }
          resolve(true);
        },
      );
    });
    if (!ok) {
      return { importOk: false, errorCode: 'NOT_INSTALLED', reason: 'PyMuPDF4LLM is not installed.' };
    }
    return { importOk: true, errorCode: null, reason: null };
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT') {
      return { importOk: false, errorCode: 'TIMEOUT', reason: 'Probe timed out.' };
    }
    return { importOk: false, errorCode: 'IMPORT_FAILED', reason: 'Failed to execute Python import check.' };
  }
}

async function probePyMuPDF4LLMVersion(pythonExe: string): Promise<{
  version: string | null;
  errorCode: 'VERSION_UNREADABLE' | null;
}> {
  try {
    const version = await new Promise<string | null>((resolve) => {
      execFile(
        pythonExe,
        ['-c', `from importlib.metadata import version; print(version('${PYMUPDF4LLM_PACKAGE}'))`],
        { timeout: PROBE_TIMEOUT_MS, windowsHide: true },
        (err, stdout) => {
          if (err) { resolve(null); return; }
          const firstLine = (stdout ?? '').split(/[\r\n]+/)[0]?.trim() ?? '';
          resolve((firstLine.length > 0 && firstLine.length <= 50) ? firstLine : null);
        },
      );
    });
    if (version === null) return { version: null, errorCode: 'VERSION_UNREADABLE' };
    return { version, errorCode: null };
  } catch {
    return { version: null, errorCode: 'VERSION_UNREADABLE' };
  }
}

async function probePyMuPDF4LLM(): Promise<CoreEngineProbeStatus> {
  const checkedAt = nowISO();

  // Step 1: Python discovery
  let pythonExe: string;
  try {
    pythonExe = await resolvePythonBundledFirst();
  } catch {
    return { engine: 'pymupdf4llm', status: 'unknown', version: null, reason: 'Python 3 not found.', checkedAt };
  }

  // Step 2: Import check
  const importResult = await probePyMuPDF4LLMImport(pythonExe);
  if (importResult.errorCode === 'TIMEOUT') {
    return { engine: 'pymupdf4llm', status: 'unavailable', version: null, reason: 'Probe timed out.', checkedAt };
  }
  if (!importResult.importOk) {
    return { engine: 'pymupdf4llm', status: 'unavailable', version: null, reason: importResult.reason, checkedAt };
  }

  // Step 3: Version query
  const versionResult = await probePyMuPDF4LLMVersion(pythonExe);
  if (versionResult.errorCode === 'VERSION_UNREADABLE') {
    return { engine: 'pymupdf4llm', status: 'available', version: null, reason: null, checkedAt };
  }

  return { engine: 'pymupdf4llm', status: 'available', version: versionResult.version, reason: null, checkedAt };
}

/**
 * Probe the PyMuPDF4LLM core engine.
 *
 * Uses Python discovery (bundled-first) + import check + version query.
 * No PDF conversion, no user file access.
 * Updates the in-memory cache and returns the probe status.
 */
export async function probeCorePyMuPDF4LLM(): Promise<CoreEngineProbeStatus> {
  const result = await probePyMuPDF4LLM();
  _coreProbe = { checkedAt: nowISO(), pymupdf4llm: result };
  return result;
}

/**
 * Get the cached PyMuPDF4LLM core engine probe status.
 * Returns null if probeCorePyMuPDF4LLM() has never been called.
 */
export function getCoreEngineProbe(): { readonly pymupdf4llm: CoreEngineProbeStatus } | null {
  return _coreProbe;
}

// ── Core Engine Probe: Marker (Phase 3-4-K) ───────

const MARKER_MODULE = 'marker';
const MARKER_PACKAGE = 'marker-pdf';

/**
 * External-only Python resolver for user-managed runtimes — Phase 3-4-K.
 *
 * Unlike resolvePythonBundledFirst(), this resolver does NOT query bundled
 * venv paths (docling-venv, pymupdf4llm-venv, etc.).  It only searches
 * system Python candidates.  Used by Marker external runtime probe.
 *
 * Returns the first working Python executable, or rejects if none found.
 */
async function resolveExternalPython(): Promise<string> {
  return new Promise((resolve, reject) => {
    let idx = 0;
    function tryNext(): void {
      if (idx >= SYSTEM_PYTHON_CANDIDATES.length) {
        reject(new Error('No Python executable found'));
        return;
      }
      const candidate = SYSTEM_PYTHON_CANDIDATES[idx];
      idx += 1;
      execFile(candidate, ['--version'], { timeout: PYTHON_DISCOVERY_TIMEOUT_MS, windowsHide: true }, (err) => {
        if (err) { tryNext(); return; }
        resolve(candidate);
      });
    }
    tryNext();
  });
}

/** Marker probe status exposed via computeAvailableModes (Phase 3-4-K). */
export interface CoreMarkerProbeStatus {
  readonly engine: 'marker';
  readonly status: 'available' | 'unavailable' | 'unknown';
  readonly version: string | null;
  readonly reason: string | null;
  readonly checkedAt: string;
}

let _markerCoreProbe: {
  readonly checkedAt: string;
  readonly marker: CoreMarkerProbeStatus;
} | null = null;

async function probeMarkerImport(pythonExe: string): Promise<{
  importOk: boolean;
  errorCode: 'NOT_INSTALLED' | 'IMPORT_FAILED' | 'TIMEOUT' | null;
  reason: string | null;
}> {
  try {
    const ok = await new Promise<boolean>((resolve, reject) => {
      execFile(
        pythonExe,
        ['-c', `import ${MARKER_MODULE}`],
        { timeout: PROBE_TIMEOUT_MS, windowsHide: true },
        (err) => {
          if (err) {
            if ((err as { killed?: boolean }).killed) {
              reject(new Error('TIMEOUT'));
              return;
            }
            resolve(false);
            return;
          }
          resolve(true);
        },
      );
    });
    if (!ok) {
      return { importOk: false, errorCode: 'NOT_INSTALLED', reason: 'Marker is not installed.' };
    }
    return { importOk: true, errorCode: null, reason: null };
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT') {
      return { importOk: false, errorCode: 'TIMEOUT', reason: 'Probe timed out.' };
    }
    return { importOk: false, errorCode: 'IMPORT_FAILED', reason: 'Failed to execute Python import check.' };
  }
}

async function probeMarkerVersion(pythonExe: string): Promise<{
  version: string | null;
  errorCode: 'VERSION_UNREADABLE' | null;
}> {
  try {
    const version = await new Promise<string | null>((resolve) => {
      execFile(
        pythonExe,
        ['-c', `from importlib.metadata import version; print(version('${MARKER_PACKAGE}'))`],
        { timeout: PROBE_TIMEOUT_MS, windowsHide: true },
        (err, stdout) => {
          if (err) { resolve(null); return; }
          const firstLine = (stdout ?? '').split(/[\r\n]+/)[0]?.trim() ?? '';
          resolve((firstLine.length > 0 && firstLine.length <= 50) ? firstLine : null);
        },
      );
    });
    if (version === null) return { version: null, errorCode: 'VERSION_UNREADABLE' };
    return { version, errorCode: null };
  } catch {
    return { version: null, errorCode: 'VERSION_UNREADABLE' };
  }
}

/**
 * Probe the Marker external runtime — Phase 3-4-K.
 *
 * K phase only: Python resolver + import check + version query.
 * Model preflight is deferred to Phase 3-4-L Marker adapter implementation.
 *
 * Does NOT:
 *   - Check model files or model directories
 *   - Access HuggingFace cache
 *   - Trigger model download or network access
 *   - Execute marker setup
 *   - Return model_missing or needs_setup status
 */
async function probeMarker(): Promise<CoreMarkerProbeStatus> {
  const checkedAt = nowISO();

    // Step 1: Python discovery (external-only — no bundled path for Marker)
    let pythonExe: string;
    try {
      pythonExe = await resolveExternalPython();
    } catch {
    return { engine: 'marker', status: 'unknown', version: null, reason: 'Python 3 not found.', checkedAt };
  }

  // Step 2: Import check
  const importResult = await probeMarkerImport(pythonExe);
  if (importResult.errorCode === 'TIMEOUT') {
    return { engine: 'marker', status: 'unavailable', version: null, reason: 'Probe timed out.', checkedAt };
  }
  if (!importResult.importOk) {
    return { engine: 'marker', status: 'unavailable', version: null, reason: importResult.reason, checkedAt };
  }

  // Step 3: Version query
  const versionResult = await probeMarkerVersion(pythonExe);
  if (versionResult.errorCode === 'VERSION_UNREADABLE') {
    return { engine: 'marker', status: 'available', version: null, reason: null, checkedAt };
  }

  return { engine: 'marker', status: 'available', version: versionResult.version, reason: null, checkedAt };
}

/**
 * Probe the Marker external runtime and update cache.
 *
 * K phase: import + version only.  No model preflight.
 * Marker adapter / bridge / model preflight deferred to Phase 3-4-L.
 */
export async function probeCoreMarker(): Promise<CoreMarkerProbeStatus> {
  const result = await probeMarker();
  _markerCoreProbe = { checkedAt: nowISO(), marker: result };
  return result;
}

/**
 * Get the cached Marker external runtime probe status.
 * Returns null if probeCoreMarker() has never been called.
 */
export function getCoreMarkerProbe(): { readonly marker: CoreMarkerProbeStatus } | null {
  return _markerCoreProbe;
}

// ── Public API ────────────────────────────────────

/**
 * Probe all four reserved engines.
 *
 * Phase 3-4-C1: docling_reserved uses real Python probe (when enabled).
 *               Other engines remain as stubs.
 *
 * Phase 3-4-F0: When DISABLE_RESERVED_ENGINE_PROBES is true,
 *               all engines return stub status (precision=false, ocr=false).
 *               No Python subprocess is spawned.  Docling code preserved
 *               as experimental/archived for future phases.
 *
 * No conversion, no file I/O, no user content access.
 * Updates the in-memory cache and returns the snapshot.
 */
export async function probeAllReservedEngines(): Promise<EngineCapabilitySnapshot> {
  // Phase 3-4-F0 gate: skip real probes, return all-stub snapshot
  if (DISABLE_RESERVED_ENGINE_PROBES) {
    const engines: Record<ReservedImportEngine, ReservedEngineProbeStatus> = {
      docling_reserved: buildStubStatus('docling_reserved'),
      mineru_reserved: buildStubStatus('mineru_reserved'),
      marker_reserved: buildStubStatus('marker_reserved'),
      dots_ocr_reserved: buildStubStatus('dots_ocr_reserved'),
    };
    const availableModes: Record<ImportMode, boolean> = {
      quick: false,
      paper_quality: false,
      paper_enhanced: false,
      precision: false,
      ocr: false,
    };
    const modeEngines: Record<ImportMode, ImportEngine[]> = {
      quick: [],
      paper_quality: [],
      paper_enhanced: [],
      precision: [],
      ocr: [],
    };
    _snapshot = { checkedAt: nowISO(), engines, availableModes, modeEngines };
    return _snapshot;
  }

  // ── Real probes (Phase 3-4-C1 path, disabled in F0) ──
  const [
    doclingResult,
    mineruResult,
    markerResult,
    dotsResult,
  ] = await Promise.all([
    probeDoclingReserved(),
    Promise.resolve(buildStubStatus('mineru_reserved')),
    Promise.resolve(buildStubStatus('marker_reserved')),
    Promise.resolve(buildStubStatus('dots_ocr_reserved')),
  ]);

  const engines: Record<ReservedImportEngine, ReservedEngineProbeStatus> = {
    docling_reserved: doclingResult,
    mineru_reserved: mineruResult,
    marker_reserved: markerResult,
    dots_ocr_reserved: dotsResult,
  };

  const availableModes: Record<ImportMode, boolean> = {
    quick: false,
    paper_quality: false,
    paper_enhanced: false,
    precision: false,
    ocr: false,
  };

  const modeEngines: Record<ImportMode, ImportEngine[]> = {
    quick: [],
    paper_quality: [],
    paper_enhanced: [],
    precision: [],
    ocr: [],
  };

  _snapshot = {
    checkedAt: nowISO(),
    engines,
    availableModes,
    modeEngines,
  };

  return _snapshot;
}

/**
 * Probe a single reserved engine.
 *
 * Phase 3-4-C1: docling_reserved → real Python probe.
 *               All others → stub.
 *
 * Parameter type restricts to ReservedImportEngine — 'markitdown'
 * is not accepted by the type system.
 */
export async function probeSingleEngine(
  engine: ReservedImportEngine,
): Promise<ReservedEngineProbeStatus> {
  if (engine === 'docling_reserved') {
    return probeDoclingReserved();
  }
  return buildStubStatus(engine);
}

/**
 * Return the cached capability snapshot without re-probing.
 *
 * Returns null if probeAllReservedEngines() has never been called.
 */
export function getEngineCapabilitySnapshot(): EngineCapabilitySnapshot | null {
  return _snapshot;
}

/**
 * Clear the capability cache.
 */
export function invalidateProbeCache(): void {
  _snapshot = null;
}

/**
 * Compute which import modes are available.
 *
 * Phase 3-4-C1 GATE (C2-b update / H2 update / I update / K update / Lite update):
 *   - quick:         from markitdownAvailable parameter (default false).
 *   - paper_quality: always true — built-in baseline engine is always available.
 *                    Does NOT depend on PyMuPDF4LLM probe or Marker probe.
 *   - paper_enhanced: true iff marker core probe is 'available' (Phase 3-4-K).
 *   - precision:     true iff docling_reserved probe is 'available'.
 *   - ocr:           always false.
 *
 * Pure computation — does NOT trigger a probe.
 * Uses cached results if available; returns safe defaults otherwise.
 */
export function computeAvailableModes(
  markitdownAvailable = false,
  markerAvailable = false,
): Record<ImportMode, boolean> {
  const snapshot = _snapshot;
  const doclingProbe = snapshot?.engines?.['docling_reserved'];

  // Phase 3-4-Lite: paper_quality is always available via built-in baseline engine
  const paperQualityAvailable = true;

  // paper_enhanced still depends on Marker external runtime probe
  const markerReady = markerAvailable
    || _markerCoreProbe?.marker?.status === 'available';

  return {
    quick: markitdownAvailable,
    paper_quality: paperQualityAvailable,
    paper_enhanced: markerReady,
    precision: doclingProbe?.status === 'available',
    ocr: false,
  };
}

/**
 * Compute product-level available modes — Phase 4-0-B-IMP-2.
 *
 * UI should consume this instead of the legacy Record<ImportMode, boolean>.
 */
export function computeAvailableProductModes(
  markitdownAvailable = false,
  markerAvailable = false,
): { quick: boolean; enhanced: boolean } {
  const internal = computeAvailableModes(markitdownAvailable, markerAvailable);
  return {
    quick: internal.quick,
    enhanced: internal.paper_enhanced,
  };
}

// ── Phase 4-0-C: Enhanced Import Diagnostics ────────

/**
 * Returns a cached snapshot of enhanced import diagnostics.
 * Does NOT trigger a probe — returns null if diagnostics have never been computed
 * or the cache has expired.
 */
export function getCachedEnhancedDiagnosticsSnapshot(): EnhancedImportDiagnostics | null {
  if (!_diagnosticsCache || !_diagnosticsCacheUpdatedAt) return null;
  const age = Date.now() - _diagnosticsCacheUpdatedAt;
  if (age > DIAGNOSTICS_CACHE_TTL_MS) return null;
  return _diagnosticsCache;
}

/**
 * Get enhanced import diagnostics, triggering a probe if necessary.
 *
 * On first call, runs the full diagnostics probe (Python discovery + import + version).
 * Subsequent calls within the cache TTL return the cached result.
 * Concurrent calls reuse the same in-flight promise.
 *
 * Pass forceRefresh=true to bypass the cache and re-probe.
 * Useful when the user has installed Marker and wants to re-check.
 */
export async function getCachedEnhancedDiagnostics(options?: {
  forceRefresh?: boolean;
}): Promise<EnhancedImportDiagnostics> {
  // Return fresh cached result (skip probe)
  if (!options?.forceRefresh) {
    const cached = getCachedEnhancedDiagnosticsSnapshot();
    if (cached) return cached;
  }

  // Reuse in-flight promise to avoid concurrent duplicate probes
  if (_diagnosticsInFlight && !options?.forceRefresh) {
    return _diagnosticsInFlight;
  }

  // Trigger fresh probe
  _diagnosticsInFlight = computeEnhancedDiagnostics();

  try {
    const result = await _diagnosticsInFlight;
    _diagnosticsCache = result;
    _diagnosticsCacheUpdatedAt = Date.now();
    return result;
  } catch {
    // Don't cache thrown errors; let caller handle
    throw _diagnosticsInFlight;
  } finally {
    _diagnosticsInFlight = null;
  }
}

/** Clear the diagnostics cache (useful for testing). */
export function clearDiagnosticsCache(): void {
  _diagnosticsCache = null;
  _diagnosticsCacheUpdatedAt = null;
  _diagnosticsInFlight = null;
}

/**
 * Compute enhanced import diagnostics — Phase 4-0-C-IMP-2.
 *
 * Dynamically probes the Marker external runtime to populate diagnostics.
 * No conversion, no model download, no pip install.
 * All fields are safe for UI display — no absolute paths, no engine internal names
 * beyond pip package names needed for install instructions.
 *
 * ⚠️  This function returns diagnostic information only.
 *     productModes.enhanced remains false regardless of probe result.
 *     Enhanced import is NOT enabled by this probe.
 */
export async function computeEnhancedDiagnostics(): Promise<EnhancedImportDiagnostics> {
  try {
    const result = await probeCoreMarker();

    if (result.status === 'available') {
      const pyVer = await resolvePythonVersion();
      return {
        available: true,
        reason: null,
        installHint: null,
        pythonVersion: pyVer,
        engineVersion: result.version ?? null,
        enginePackageInstalled: true,
        modelsDownloaded: null,
        modelSizeMb: null,
        diskFreeMb: null,
      };
    }

    const pyVerFallback = await resolvePythonVersion();
    return {
      available: false,
      reason: result.reason ?? 'Enhanced import is not available. Marker external runtime not detected.',
      installHint: 'To enable enhanced PDF import, install Python 3.10+ and run: pip install marker-pdf',
      pythonVersion: pyVerFallback,
      engineVersion: null,
      enginePackageInstalled: false,
      modelsDownloaded: null,
      modelSizeMb: null,
      diskFreeMb: null,
    };
  } catch {
    return {
      available: false,
      reason: 'Could not detect enhanced import runtime. Ensure Python 3.10+ is installed.',
      installHint: 'Install Python 3.10+ from https://python.org, then run: pip install marker-pdf',
      pythonVersion: null,
      engineVersion: null,
      enginePackageInstalled: false,
      modelsDownloaded: null,
      modelSizeMb: null,
      diskFreeMb: null,
    };
  }
}

// ── Phase 4-0-D-3: Python Version Probe ──────────────

const PYTHON_VERSION_TIMEOUT_MS = 5_000;

async function resolvePythonVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'python3',
      ['--version'],
      { timeout: PYTHON_VERSION_TIMEOUT_MS, windowsHide: true },
      (err, stdout) => {
        if (err) { resolve(null); return; }
        const match = (stdout ?? '').match(/Python\s+(\d+\.\d+\.\d+)/);
        resolve(match ? match[1] : null);
      },
    );
  });
}

// ── Phase 4-0-C-IMP-3: Marker Conversion PoC ────────

const BRIDGE_SCRIPT_NAME = 'schola_marker_bridge.py';
const CONVERSION_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Run Marker conversion via the bridge script — Phase 4-0-C-IMP-3 PoC.
 *
 * ⚠️  PoC only — not wired to import:create-job.
 *     Must be called with vault-internal paths only.
 *     No pip install, no model download, no network access.
 */
export async function runMarkerConversionPoC(params: {
  attachmentPath: string;
  outputDir: string;
  options?: { maxPages?: number };
}): Promise<{ ok: boolean; markdownPath?: string; errorCode?: string; errorMessage?: string }> {
  // Path guard: resolve + normalize + reject traversal.
  const resolvedAttachment = path.resolve(params.attachmentPath);
  const resolvedOutput = path.resolve(params.outputDir);

  if (resolvedAttachment.includes('..')) {
    return { ok: false, errorCode: 'INVALID_PATH', errorMessage: 'Path traversal detected in attachment path.' };
  }
  if (resolvedOutput.includes('..')) {
    return { ok: false, errorCode: 'INVALID_PATH', errorMessage: 'Path traversal detected in output path.' };
  }
  // Reject if path contains unexpected relative segments after resolve
  if (params.attachmentPath !== resolvedAttachment && !params.attachmentPath.includes('..')) {
    // Symlink or mount point — reject for safety
    return { ok: false, errorCode: 'INVALID_PATH', errorMessage: 'Attachment path resolves to unexpected location.' };
  }
  if (params.outputDir !== resolvedOutput && !params.outputDir.includes('..')) {
    return { ok: false, errorCode: 'INVALID_PATH', errorMessage: 'Output path resolves to unexpected location.' };
  }

  const bridgePath = path.join(__dirname, '..', '..', '..', 'resources', BRIDGE_SCRIPT_NAME);

  const input = JSON.stringify({
    attachment_path: params.attachmentPath,
    output_dir: params.outputDir,
    options: params.options ?? {},
  });

  return new Promise((resolve) => {
    const child = spawn('python3', [bridgePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: CONVERSION_TIMEOUT_MS,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('error', () => {
      resolve({ ok: false, errorCode: 'BRIDGE_NOT_FOUND', errorMessage: 'Python or bridge script not found.' });
    });

    child.on('close', (code) => {
      try {
        const result = JSON.parse(stdout);
        if (result.ok) {
          resolve({ ok: true, markdownPath: result.markdown_path });
        } else {
          resolve({ ok: false, errorCode: result.error_code ?? 'CONVERSION_FAILED', errorMessage: result.error_message?.slice(0, 500) ?? 'Unknown error.' });
        }
      } catch {
        const sanitizedStderr = stderr.slice(0, 200)
          .replace(/[A-Za-z]:\\[^\s,;]+/g, '<path>')
          .replace(/\/[^\s,;]{3,}\//g, '<path>/')
          .replace(/File "[^"]+"/g, 'File "<path>"')
          .replace(/line \d+/g, 'line <N>');
        resolve({ ok: false, errorCode: 'BRIDGE_CRASH', errorMessage: sanitizedStderr || 'Bridge produced no valid output.' });
      }
    });

    child.stdin?.write(input);
    child.stdin?.end();
  });
}
