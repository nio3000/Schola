/**
 * Official Enhanced Runtime Layer types — Phase 4-0-E.
 *
 * Defines managed Python runtime contracts for official enhanced modules.
 * No real install — skeleton only. Python is NOT a Core dependency.
 */

// ── Runtime Manifest ───────────────────────────────

/** Pip package entry in a module's runtime manifest. */
export interface RuntimePipPackage {
  readonly name: string;
  readonly version?: string;
  readonly reason: string;
}

/** Model entry in a module's runtime manifest. */
export interface RuntimeModel {
  readonly name: string;
  readonly source: string;
  readonly estimatedSizeMb: number;
  readonly license: string;
  readonly required: boolean;
}

/** Module-level runtime dependency manifest. */
export interface ModuleRuntimeManifest {
  readonly moduleId: string;
  readonly pythonVersion: string;
  readonly pipPackages: readonly RuntimePipPackage[];
  readonly models: readonly RuntimeModel[];
  readonly estimatedDiskMb: number;
  readonly licenseSummary: string;
  readonly venvName: string;
}

// ── Runtime Setup State ────────────────────────────

/** Overall module runtime setup phase. */
export type RuntimeSetupPhase =
  | 'not-installed'
  | 'installing'
  | 'ready'
  | 'failed'
  | 'repairing'
  | 'uninstalling';

/** Runtime setup state per module. */
export interface RuntimeSetupState {
  readonly moduleId: string;
  readonly phase: RuntimeSetupPhase;
  readonly progress: number; // 0-100
  readonly error: string | null; // sanitized
  readonly checkedAt: string; // ISO 8601
}

// ── Runtime Diagnostics ────────────────────────────

/** Sanitized runtime diagnostics for a module. */
export interface RuntimeDiagnostics {
  readonly moduleId: string;
  readonly python: {
    readonly found: boolean;
    readonly version: string | null; // "3.11.5" or null
  };
  readonly venv: {
    readonly exists: boolean;
  };
  readonly packages: {
    readonly installed: number;
    readonly missing: number;
    readonly missingList: readonly string[]; // only manifest-whitelisted names
  };
  readonly models: {
    readonly downloaded: number;
    readonly totalMb: number | null;
    readonly missing: number;
    readonly missingList: readonly string[];
  };
  readonly disk: {
    readonly freeMb: number | null;
    readonly requiredMb: number;
    readonly sufficient: boolean;
  };
  readonly status: 'ready' | 'python-missing' | 'venv-missing' | 'packages-missing' | 'models-missing' | 'disk-low' | 'unknown';
}

/** Disk check result. */
export interface DiskCheckResult {
  readonly sufficient: boolean;
  readonly freeMb: number | null;
  readonly requiredMb: number;
}

// ── Fixed API Input ────────────────────────────────

/** Input for runtime setup operations — renderer-safe. */
export interface RuntimeSetupInput {
  readonly moduleId: string;
  readonly userConfirmed: boolean;
}

/** Input for runtime diagnostics. */
export interface RuntimeDiagnoseInput {
  readonly moduleId: string;
}

// ── Module Manifests (whitelist) ───────────────────

export const MODULE_RUNTIME_MANIFESTS: Record<string, ModuleRuntimeManifest> = {
  'schola.import.enhanced': {
    moduleId: 'schola.import.enhanced',
    pythonVersion: '>=3.10',
    pipPackages: [
      { name: 'marker-pdf', reason: 'PDF to Markdown conversion' },
      { name: 'torch', reason: 'ML inference backend' },
    ],
    models: [
      { name: 'surya_ocr', source: 'huggingface:VikParuchuri/surya_ocr', estimatedSizeMb: 1500, license: 'CC-BY-NC-SA-4.0', required: true },
      { name: 'surya_layout', source: 'huggingface:VikParuchuri/surya_layout', estimatedSizeMb: 800, license: 'CC-BY-NC-SA-4.0', required: true },
    ],
    estimatedDiskMb: 4000,
    licenseSummary: 'marker-pdf: GPL-3.0-or-later. Models: CC-BY-NC-SA-4.0. User-managed external runtime.',
    venvName: 'schola-marker',
  },
};
