/**
 * Runtime Pack contract types — Phase 3-4-G3-A.
 *
 * Defines RuntimePackManifest, RuntimePackStatus, fixed-function IPC channel
 * constants, error codes, and all operation input/output types.
 *
 * ⚠️  This file defines TYPE CONTRACTS ONLY.  No service implementation,
 *     no IPC handler registration, no file I/O, no network access.
 *
 * ⚠️  Banned IPC channels are INTENTIONALLY ABSENT from this file:
 *     runtime:run-command, runtime:run-shell, runtime:run-python,
 *     runtime:install-from-url, runtime:install-from-local-path,
 *     runtime:install-third-party, runtime:load-plugin,
 *     runtime:set-entrypoint, runtime:set-shell-command,
 *     runtime:set-python-script, runtime:read-api-key,
 *     runtime:read-vault-raw, runtime:write-sqlite-raw.
 *
 * ⚠️  System absolute paths, Python executable paths, site-packages paths,
 *     raw tracebacks, API keys, and downloadUrl tokens MUST NOT appear
 *     in any type field exposed to the renderer.
 */

// ── Primitives ──────────────────────────────────

export type RuntimePackId = string;
export type RuntimePackSafeDirName = string;

/**
 * Adapter ID used in entrypoints and install specs.
 *
 * ⚠️  Must be a Schola built-in adapter identifier (e.g. "schola.adapter.formula.probe").
 *     MUST NOT be a file path, absolute path, shell command, or Python script path.
 */
export type RuntimePackAdapterId = string;

// ── Capabilities ────────────────────────────────

export type RuntimePackCapability =
  | 'import.pdf'
  | 'import.docx'
  | 'import.pptx'
  | 'import.xlsx'
  | 'import.html'
  | 'import.formula'
  | 'import.table'
  | 'import.figure'
  | 'import.ocr'
  | 'import.chinese-layout'
  | 'export.docx'
  | 'export.pdf'
  | 'export.latex'
  | 'export.html'
  | 'export.pptx'
  | 'ai.provider'
  | 'ai.byok'
  | 'preview.mermaid'
  | 'preview.chart'
  | 'translate.bilingual';

// ── Permissions ─────────────────────────────────

export type RuntimePackPermission =
  | 'vault.read.currentFile'
  | 'vault.read.attachments'
  | 'vault.write.generatedMarkdown'
  | 'vault.write.assets'
  | 'vault.write.metadata'
  | 'network.downloadRuntime'
  | 'network.callProvider'
  | 'settings.readOwn'
  | 'settings.writeOwn'
  | 'artifact.create'
  | 'artifact.preview'
  | 'diagnostics.writeSanitizedLog'
  | 'runtime.install.officialOnly'
  | 'runtime.uninstall.ownPack';

/**
 * ⚠️  The following permission identifiers are INTENTIONALLY ABSENT
 *     from the RuntimePackPermission union.  They represent permanently
 *     forbidden capabilities:
 *
 *     fs.read              — direct filesystem read
 *     fs.write             — direct filesystem write
 *     sqlite.read          — direct SQLite read
 *     sqlite.write         — direct SQLite write
 *     child_process.exec   — arbitrary child process
 *     shell.run            — arbitrary shell command
 *     apiKey.read          — direct API key read
 *     vault.read.raw       — raw vault read without confirmation
 *     network.any          — arbitrary network access
 *     plugin.loadThirdParty — third-party plugin loading (Phase 5-P only)
 */

// ── Platform ────────────────────────────────────

export type RuntimePackPlatform = `${'win32' | 'darwin' | 'linux'}-${'x64' | 'arm64'}`;

export interface RuntimePackPlatformRequirements {
  readonly os: readonly ('win32' | 'darwin' | 'linux')[];
  readonly arch: readonly ('x64' | 'arm64')[];
  readonly memoryMbMin: number;
  readonly diskFreeMbMin: number;
  /** true = blocking; false = GPU not required */
  readonly gpuRequired: boolean;
}

// ── Runtime Spec ────────────────────────────────

export interface RuntimePackRuntimeSpec {
  readonly kind: 'python-venv';
  readonly platforms: readonly RuntimePackPlatform[];
  readonly pythonVersion: string;
  readonly networkRequired: 'never' | 'install' | 'firstUse' | 'always';
  readonly estimatedDownloadSizeMb: number;
  readonly estimatedDiskSizeMb: number;
  readonly estimatedModelSizeMb: number;
  readonly autoUpdate: 'never' | 'prompt';
  /** Must match download allowlist.  G3-B: allowlist empty until production domain confirmed. */
  readonly downloadUrl: string;
  readonly integrity: RuntimePackIntegrity;
}

export interface RuntimePackIntegrity {
  /** SHA-256 of the downloaded runtime package (required) */
  readonly runtimeHash: string;
  readonly manifestHash?: string;
  readonly pipLockHash?: string;
  readonly modelHash?: string;
}

// ── Entrypoints ─────────────────────────────────

export interface RuntimePackEntrypoints {
  /** Adapter ID for capability probe */
  readonly probe: RuntimePackAdapterId;
  /** Adapter ID for conversion / main operation */
  readonly convert?: RuntimePackAdapterId;
  /** Adapter ID for diagnostics */
  readonly diagnose?: RuntimePackAdapterId;
}

// ── Install / Model / Diagnostics / Uninstall ──

export interface RuntimePackInstallSpec {
  /** pip packages (name + version constraint only, no flags / URLs) */
  readonly pip: readonly string[];
  /** Must match download allowlist if present */
  readonly extraIndexUrl: string | null;
  /** Post-install verification adapter ID, not shell command */
  readonly verify: RuntimePackAdapterId | null;
}

export interface RuntimePackModelSpec {
  readonly id: string;
  readonly description: string;
  readonly sizeMb: number;
  /** Must match download allowlist */
  readonly downloadUrl: string;
  /** SHA-256 */
  readonly hash: string;
}

export interface RuntimePackDiagnosticsSpec {
  /** pip packages to check via `pip check` */
  readonly pipPackages: readonly string[];
  /** Additional adapter-based diagnostic checks */
  readonly adapterChecks: readonly RuntimePackAdapterId[];
}

export interface RuntimePackUninstallSpec {
  /** Directories to remove relative to runtime root */
  readonly removeDirs: readonly string[];
  /** Files to remove relative to runtime root */
  readonly removeFiles: readonly string[];
  /** Cache directories (relative to runtime-cache/<safe-dir>/) offered for optional removal */
  readonly cacheDirs: readonly string[];
  readonly keepVenv: boolean;
}

// ── Manifest ────────────────────────────────────

// ── G3-D3: License / Package / Signature ─────────

export type RuntimePackLicenseDecision = 'yes' | 'no' | 'unclear';

export interface RuntimePackLicenseSpec {
  readonly primaryLicense: string;
  readonly licenseFiles: readonly string[];
  readonly noticeFiles: readonly string[];
  readonly thirdPartyNoticeFiles: readonly string[];
  readonly sourceOfferRequired: boolean;
  readonly commercialUseAllowed: RuntimePackLicenseDecision;
  readonly redistributionAllowed: RuntimePackLicenseDecision;
}

export interface RuntimePackPackageSpec {
  readonly packageFormat: 'zip';
  readonly packageVersion: string;
  readonly createdAt: string;
  readonly sourceRevision?: string;
  readonly buildToolVersion?: string;
  readonly containsRuntime: boolean;
  readonly containsModels: boolean;
  readonly containsNativeBinaries: boolean;
}

export interface RuntimePackSignatureSpec {
  readonly signatureType: 'none' | 'minisign' | 'cosign' | 'gpg';
  readonly signatureFile?: string;
  readonly publicKeyId?: string;
}

// ── Manifest ────────────────────────────────────

export interface RuntimePackManifest {
  readonly manifestVersion: '1';
  /** e.g. "schola.import.formula-pack" — must be in official allowlist */
  readonly id: RuntimePackId;
  /** Short machine name, e.g. "formula-pack" */
  readonly name: string;
  /** User-facing display name, e.g. "论文导入增强" */
  readonly displayName: string;
  /** 1-2 sentence user-facing description */
  readonly description: string;
  readonly type: 'runtime-pack';
  /** G3: enforced single value */
  readonly publisher: 'schola-official';
  /** semver */
  readonly version: string;
  /** semver range, e.g. ">=0.2.0" */
  readonly compatibleScholaVersion: string;
  readonly homepage: string | null;

  readonly capabilities: readonly RuntimePackCapability[];
  readonly supportedFormats: readonly string[];

  readonly runtime: RuntimePackRuntimeSpec;
  readonly permissions: readonly RuntimePackPermission[];
  readonly entrypoints: RuntimePackEntrypoints;

  /** Pack IDs this pack depends on */
  readonly requires: readonly RuntimePackId[];
  /** Pack IDs this pack conflicts with */
  readonly conflicts: readonly RuntimePackId[];

  readonly install: RuntimePackInstallSpec;
  readonly models: readonly RuntimePackModelSpec[];
  readonly diagnostics: RuntimePackDiagnosticsSpec;
  readonly uninstall: RuntimePackUninstallSpec;

  readonly platformRequirements: RuntimePackPlatformRequirements;

  /** G3-D3: license information */
  readonly license: RuntimePackLicenseSpec;
  /** G3-D3: package metadata */
  readonly package: RuntimePackPackageSpec;
  /** G3-D3: signature specification */
  readonly signature: RuntimePackSignatureSpec;
}

// ── Phases ──────────────────────────────────────

export type RuntimePackPhase =
  | 'undiscovered'
  | 'discovered'
  | 'available-to-install'
  | 'unavailable'
  | 'probe-failed'
  | 'installing'
  | 'installed'
  | 'enabled'
  | 'running'
  | 'error'
  | 'disabled'
  | 'uninstalling'
  | 'uninstalled'
  | 'failed';

export type RuntimePackProgressPhase =
  | 'checking-platform'
  | 'downloading'
  | 'verifying'
  | 'installing'
  | 'probing'
  | 'cleaning'
  | 'uninstalling';

// ── Status ──────────────────────────────────────

/** Summary for list views.  Does NOT contain phase (see RuntimePackStatus). */
export interface RuntimePackSummary {
  readonly packId: RuntimePackId;
  readonly displayName: string;
  readonly description: string;
  readonly version: string | null;
  readonly capabilities: readonly RuntimePackCapability[];
  readonly networkRequired: 'never' | 'install' | 'firstUse' | 'always';
  readonly diskSizeMb: number | null;
}

/** Full status including lifecycle phase. */
export interface RuntimePackStatus {
  readonly packId: RuntimePackId;
  readonly phase: RuntimePackPhase;
  readonly installedVersion: string | null;
  readonly enabled: boolean;
  readonly installedAt: number | null;
  readonly updatedAt: number;
  readonly lastProbeAt: number | null;
  readonly lastProbeOk: boolean | null;
  readonly lastErrorCode: RuntimePackErrorCode | null;
  readonly lastErrorMessage: string | null;
  readonly consecutiveFailures: number;
  readonly progress: RuntimePackProgress | null;
}

export interface RuntimePackProgress {
  readonly phase: RuntimePackProgressPhase;
  /** 0-100 */
  readonly percent: number;
  readonly bytesDownloaded: number | null;
  readonly bytesTotal: number | null;
}

// ── Error Codes ─────────────────────────────────

export type RuntimePackErrorCode =
  // Manifest
  | 'MANIFEST_NOT_FOUND'
  | 'MANIFEST_PARSE_ERROR'
  | 'MANIFEST_VALIDATION_ERROR'
  | 'PUBLISHER_NOT_OFFICIAL'
  | 'PACK_NOT_IN_ALLOWLIST'
  | 'PACK_ID_INVALID'
  | 'PACK_ID_UNSAFE'
  // Platform
  | 'OS_MISMATCH'
  | 'ARCH_MISMATCH'
  | 'DISK_SPACE_INSUFFICIENT'
  | 'MEMORY_BELOW_MINIMUM'
  | 'GPU_REQUIRED_BUT_UNAVAILABLE'
  | 'SCHOLA_VERSION_INCOMPATIBLE'
  // Download
  | 'DOWNLOAD_URL_NOT_ALLOWED'
  | 'DOWNLOAD_FAILED'
  | 'DOWNLOAD_CANCELLED'
  // Integrity
  | 'INTEGRITY_CHECK_FAILED'
  // Install
  | 'INSTALL_FAILED'
  | 'INSTALL_TIMEOUT'
  // Probe
  | 'PROBE_FAILED'
  | 'PROBE_UNAVAILABLE'
  // General
  | 'PACK_NOT_FOUND'
  | 'PACK_NOT_INSTALLED'
  | 'PACK_ALREADY_INSTALLED'
  | 'OPERATION_NOT_ALLOWED_IN_CURRENT_PHASE'
  | 'DIAGNOSTICS_EXPORT_CANCELLED'
  | 'INTERNAL_ERROR';

// ── Validation / Check Results ──────────────────

export interface RuntimePackValidationIssue {
  readonly code: RuntimePackErrorCode;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

export interface RuntimePackValidationResult {
  readonly ok: boolean;
  readonly issues: readonly RuntimePackValidationIssue[];
}

export interface PlatformCheckResult {
  readonly ok: boolean;
  readonly issues: readonly RuntimePackValidationIssue[];
  readonly detected: {
    readonly os: 'win32' | 'darwin' | 'linux';
    readonly arch: 'x64' | 'arm64' | string;
    readonly memoryMb: number;
    readonly diskFreeMb: number | null;
    readonly gpuAvailable: boolean | null;
    readonly scholaVersion: string;
  };
}

export type IntegrityCheckAlgorithm = 'sha256';

export type IntegrityCheckTarget = 'runtime' | 'manifest' | 'pip-lock' | 'model';

export interface IntegrityCheckResult {
  readonly ok: boolean;
  readonly algorithm: IntegrityCheckAlgorithm;
  readonly checked: IntegrityCheckTarget;
  readonly message?: string;
}

// ── Operation Input / Output ────────────────────

// List

export interface ListRuntimePacksResult {
  readonly ok: boolean;
  readonly packs: readonly RuntimePackSummary[];
}

// Get Status

export interface GetRuntimePackStatusResult {
  readonly ok: boolean;
  readonly status: RuntimePackStatus | null;
}

// Install

export interface InstallRuntimePackInput {
  readonly packId: RuntimePackId;
  /** User confirmed network download is acceptable */
  readonly acceptedNetworkDownload: boolean;
  /** User acknowledged expected disk usage (MB) */
  readonly acceptedDiskUsageMb: number;
}

export interface InstallRuntimePackResult {
  readonly ok: boolean;
  readonly status: RuntimePackStatus;
  readonly message?: string;
}

// Cancel Install

export interface CancelInstallRuntimePackInput {
  readonly packId: RuntimePackId;
}

export interface CancelInstallRuntimePackResult {
  readonly ok: boolean;
  readonly status: RuntimePackStatus;
}

// Uninstall

export interface UninstallRuntimePackInput {
  readonly packId: RuntimePackId;
  readonly removeModelCache: boolean;
  readonly removeLogs: boolean;
}

export interface UninstallRuntimePackResult {
  readonly ok: boolean;
  readonly status: RuntimePackStatus;
  readonly freedDiskMb?: number;
}

// Enable / Disable

export interface EnableRuntimePackInput {
  readonly packId: RuntimePackId;
}

export interface DisableRuntimePackInput {
  readonly packId: RuntimePackId;
}

export interface ToggleRuntimePackResult {
  readonly ok: boolean;
  readonly status: RuntimePackStatus;
}

// Probe

export interface ProbeRuntimePackInput {
  readonly packId: RuntimePackId;
}

export interface ProbeRuntimePackResult {
  readonly ok: boolean;
  readonly available: boolean;
  readonly version?: string;
  /** sanitized — no system paths, no traceback */
  readonly reason?: string;
}

// Diagnose

export interface DiagnoseRuntimePackInput {
  readonly packId: RuntimePackId;
  /** If true, also writes a sanitized diagnostics log file */
  readonly includeSanitizedLogs: boolean;
}

export interface DiagnoseCheck {
  readonly id: string;
  readonly label: string;
  readonly ok: boolean;
  /** sanitized */
  readonly message: string;
}

export interface DiagnoseRuntimePackResult {
  readonly ok: boolean;
  readonly checks: readonly DiagnoseCheck[];
  readonly suggestion?: string;
}

// Clear Cache

export interface ClearRuntimePackCacheInput {
  readonly packId: RuntimePackId;
}

export interface ClearRuntimePackCacheResult {
  readonly ok: boolean;
  readonly freedDiskMb: number;
  readonly message?: string;
}

// Export Diagnostics

export interface ExportDiagnosticsInput {
  readonly packId: RuntimePackId | null;
}

/**
 * renderer receives ONLY { ok, saved, message? }.
 * Main process handles OS save dialog and file I/O.
 * renderer MUST NOT receive any file path.
 */
export interface ExportDiagnosticsResult {
  readonly ok: boolean;
  readonly saved: boolean;
  readonly message?: string;
}

// ── IPC Channel Constants ───────────────────────

/** List all discovered Runtime Packs and their status */
export const RUNTIME_LIST_PACKS_CHANNEL = 'runtime:list-packs';

/** Get detailed status for a single Runtime Pack */
export const RUNTIME_GET_STATUS_CHANNEL = 'runtime:get-status';

/** Start installing a Runtime Pack (download + pip install + probe) */
export const RUNTIME_INSTALL_CHANNEL = 'runtime:install';

/** Cancel an in-progress installation */
export const RUNTIME_CANCEL_INSTALL_CHANNEL = 'runtime:cancel-install';

/** Uninstall a Runtime Pack (optionally remove model cache and logs) */
export const RUNTIME_UNINSTALL_CHANNEL = 'runtime:uninstall';

/** Enable an installed Runtime Pack */
export const RUNTIME_ENABLE_CHANNEL = 'runtime:enable';

/** Disable an enabled Runtime Pack */
export const RUNTIME_DISABLE_CHANNEL = 'runtime:disable';

/** Probe a Runtime Pack for availability */
export const RUNTIME_PROBE_CHANNEL = 'runtime:probe';

/** Run diagnostics on a Runtime Pack */
export const RUNTIME_DIAGNOSE_CHANNEL = 'runtime:diagnose';

/** Clear model cache and temp files for a Runtime Pack */
export const RUNTIME_CLEAR_CACHE_CHANNEL = 'runtime:clear-cache';

/** Export sanitized diagnostics log to a user-chosen location */
export const RUNTIME_EXPORT_DIAGNOSTICS_CHANNEL = 'runtime:export-diagnostics';

export type RuntimeIpcChannel =
  | typeof RUNTIME_LIST_PACKS_CHANNEL
  | typeof RUNTIME_GET_STATUS_CHANNEL
  | typeof RUNTIME_INSTALL_CHANNEL
  | typeof RUNTIME_CANCEL_INSTALL_CHANNEL
  | typeof RUNTIME_UNINSTALL_CHANNEL
  | typeof RUNTIME_ENABLE_CHANNEL
  | typeof RUNTIME_DISABLE_CHANNEL
  | typeof RUNTIME_PROBE_CHANNEL
  | typeof RUNTIME_DIAGNOSE_CHANNEL
  | typeof RUNTIME_CLEAR_CACHE_CHANNEL
  | typeof RUNTIME_EXPORT_DIAGNOSTICS_CHANNEL;

/**
 * ⚠️  Banned IPC channel strings — INTENTIONALLY NOT EXPORTED:
 *
 *     'runtime:run-command'
 *     'runtime:run-shell'
 *     'runtime:run-python'
 *     'runtime:install-from-url'
 *     'runtime:install-from-local-path'
 *     'runtime:install-third-party'
 *     'runtime:load-plugin'
 *     'runtime:set-entrypoint'
 *     'runtime:set-shell-command'
 *     'runtime:set-python-script'
 *     'runtime:read-api-key'
 *     'runtime:read-vault-raw'
 *     'runtime:write-sqlite-raw'
 *
 *     These strings MUST NOT appear as IPC channel registrations,
 *     preload API calls, or renderer invocations.
 */

// ── Preload API Surface ─────────────────────────

/**
 * Renderer-visible Runtime Pack preload API.
 * Exposed as window.schola.runtime via contextBridge.
 */
export interface ScholaRuntimeApi {
  readonly listPacks: () => Promise<ListRuntimePacksResult>;
  readonly getStatus: (packId: RuntimePackId) => Promise<GetRuntimePackStatusResult>;
  readonly install: (input: InstallRuntimePackInput) => Promise<InstallRuntimePackResult>;
  readonly cancelInstall: (packId: RuntimePackId) => Promise<CancelInstallRuntimePackResult>;
  readonly uninstall: (input: UninstallRuntimePackInput) => Promise<UninstallRuntimePackResult>;
  readonly enable: (packId: RuntimePackId) => Promise<ToggleRuntimePackResult>;
  readonly disable: (packId: RuntimePackId) => Promise<ToggleRuntimePackResult>;
  readonly probe: (packId: RuntimePackId) => Promise<ProbeRuntimePackResult>;
  readonly diagnose: (input: DiagnoseRuntimePackInput) => Promise<DiagnoseRuntimePackResult>;
  readonly clearCache: (packId: RuntimePackId) => Promise<ClearRuntimePackCacheResult>;
  readonly exportDiagnostics: (input: ExportDiagnosticsInput) => Promise<ExportDiagnosticsResult>;
}
