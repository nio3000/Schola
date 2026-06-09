/**
 * Runtime Setup Service — Phase 4-0-E-IMP (skeleton).
 *
 * Manages official enhanced runtime (Python, venv, pip, models).
 * SKELETON ONLY — returns safe-unavailable diagnostics.
 * No real install, no pip, no venv, no model download.
 *
 * Python is NOT a Core dependency. Enhanced Runtime is optional.
 */
import type {
  RuntimeSetupState,
  RuntimeDiagnostics,
  RuntimeSetupInput,
  DiskCheckResult,
} from '../../src/lib/contracts/enhanced-runtime.types';
import { MODULE_RUNTIME_MANIFESTS } from '../../src/lib/contracts/enhanced-runtime.types';

// ── Phase 4-0-E-IMP: Skeleton (dry-run only) ────────

function buildSkeletonState(moduleId: string): RuntimeSetupState {
  return {
    moduleId,
    phase: 'not-installed',
    progress: 0,
    error: null,
    checkedAt: new Date().toISOString(),
  };
}

function buildSkeletonDiagnostics(moduleId: string): RuntimeDiagnostics {
  const manifest = MODULE_RUNTIME_MANIFESTS[moduleId];
  return {
    moduleId,
    python: { found: false, version: null },
    venv: { exists: false },
    packages: { installed: 0, missing: manifest?.pipPackages.length ?? 0, missingList: manifest?.pipPackages.map(p => p.name) ?? [] },
    models: { downloaded: 0, totalMb: null, missing: manifest?.models.length ?? 0, missingList: manifest?.models.map(m => m.name) ?? [] },
    disk: { freeMb: null, requiredMb: manifest?.estimatedDiskMb ?? 0, sufficient: false },
    status: 'unknown',
  };
}

// ── Public API (skeleton) ──────────────────────────

export function getSetupState(moduleId: string): RuntimeSetupState {
  return buildSkeletonState(moduleId);
}

export function diagnoseModule(moduleId: string): RuntimeDiagnostics {
  return buildSkeletonDiagnostics(moduleId);
}

export function checkDiskSpace(_moduleId: string): DiskCheckResult {
  // Skeleton: always return insufficient
  return { sufficient: false, freeMb: null, requiredMb: 0 };
}

export function startInstall(_input: RuntimeSetupInput): RuntimeSetupState {
  // Skeleton: no-op, return not-installed
  return buildSkeletonState(_input.moduleId);
}

export function startUninstall(moduleId: string): void {
  // Skeleton: no-op
}

export function startRepair(moduleId: string): RuntimeSetupState {
  return buildSkeletonState(moduleId);
}

export function getManifest(moduleId: string) {
  return MODULE_RUNTIME_MANIFESTS[moduleId] ?? null;
}
