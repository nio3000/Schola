/**
 * Import job types — Phase 3-1-A.
 *
 * Defines the import job lifecycle, status, and IPC input/output types.
 *
 * ⚠️  CreateImportJobInput MUST NOT contain sourcePath (E-1 C1 frozen).
 */

import type { ImportEngine, ImportSourceFormat, ImportMode } from './import.types';

// ── Available Modes (Phase 3-4-D) ────────────────

/** Whitelist of formats renderer may pass to selectSource filter. */
export type ImportSourceFormatFilter = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'html';

/** Optional input for import:select-source (Phase 3-4-D). */
export interface SelectImportSourceInput {
  readonly formatFilter?: readonly ImportSourceFormatFilter[];
}

/** Modes available for the current runtime environment. */
export interface AvailableImportModes {
  readonly quick: boolean;
  readonly paperQuality: boolean;
  /** Phase 3-4-K: high-fidelity paper import via Marker external runtime. */
  readonly paperEnhanced: boolean;
  readonly precision: boolean;
  readonly ocr: boolean;
}

export interface GetAvailableModesResult {
  readonly ok: true;
  readonly modes: AvailableImportModes;
  /** Phase 4-0-B: product-level modes for UI consumption. */
  readonly productModes?: AvailableProductImportModes;
  /**
   * Phase 4-0-C: enhanced import diagnostics.
   * Present when enhanced is unavailable — explains why and how to enable.
   * Absent (undefined) when enhanced is fully available and no diagnostics needed.
   */
  readonly enhancedDiagnostics?: EnhancedImportDiagnostics;
}

/**
 * Product-level available import modes — Phase 4-0-B.
 * UI consumes this instead of the legacy AvailableImportModes directly.
 */
export interface AvailableProductImportModes {
  /** Quick import is always available. */
  readonly quick: boolean;
  /** Enhanced import depends on Marker/MinerU availability. Currently false. */
  readonly enhanced: boolean;
}

/**
 * Enhanced import diagnostics — Phase 4-0-C.
 *
 * Provides user-friendly information about why enhanced import is unavailable
 * and what the user can do to enable it.
 *
 * ⚠️  MUST NOT leak absolute paths (pythonPath, modelPath, runtimePath).
 *     All paths are sanitized or omitted. Reason/installHint are safe strings.
 *     No engine technical names (Marker/MinerU/PyTorch) leak to regular UI.
 */
export interface EnhancedImportDiagnostics {
  /** Whether any enhanced import engine is available. */
  readonly available: boolean;

  /**
   * Human-readable reason for unavailability.
   * Example: "Enhanced import requires Python 3.10+ and marker-pdf package."
   * Safe for UI display. No paths, no engine internal names.
   */
  readonly reason: string | null;

  /**
   * User-friendly installation hint.
   * Example: "Install Python 3.10+, then run: pip install marker-pdf"
   * Safe for UI display. No absolute paths.
   */
  readonly installHint: string | null;

  /**
   * Detected Python version, if any.
   * Example: "3.11.5". Null if Python not found.
   * Safe: version string only, no path.
   */
  readonly pythonVersion: string | null;

  /**
   * Phase 4-0-C-IMP-3: detected enhanced engine version.
   * Example: "1.2.3" for marker-pdf. Null if engine not installed.
   * Safe: version string only, no path.
   */
  readonly engineVersion: string | null;

  /**
   * Whether the required pip package is installed.
   * True: at least one enhanced engine package detected.
   * False: no enhanced engine found.
   */
  readonly enginePackageInstalled: boolean;

  /**
   * Whether required ML models are downloaded.
   * True: models found in cache directory.
   * False: models need to be downloaded before first use.
   * Null: cannot determine (Python not available).
   */
  readonly modelsDownloaded: boolean | null;

  /**
   * Phase 4-0-D-2: estimated size of required ML models in MB.
   * Null if cannot determine (Python not available or engine not installed).
   * Example: 2500 for ~2.5 GB.
   */
  readonly modelSizeMb: number | null;

  /**
   * Phase 4-0-D-2: available disk space on the model cache drive, in MB.
   * Null if cannot determine.
   * Helps users decide if they have enough space before downloading models.
   */
  readonly diskFreeMb: number | null;
}

// ── IPC Channels (also defined in import-export-ipc.types.ts) ──

export const IMPORT_CREATE_JOB_CHANNEL = 'import:create-job';
export const IMPORT_GET_JOB_STATUS_CHANNEL = 'import:get-job-status';
export const IMPORT_LIST_JOBS_CHANNEL = 'import:list-jobs';
export const IMPORT_CANCEL_JOB_CHANNEL = 'import:cancel-job';
export const IMPORT_SELECT_SOURCE_CHANNEL = 'import:select-source';

// ── Create Job ──────────────────────────────────

export interface CreateImportJobInput {
  readonly vaultId: string;
  readonly sourceFormat: ImportSourceFormat;
  /**
   * Opaque token returned by import:select-source.
   * The renderer never sees the raw sourcePath.
   */
  readonly selectedSourceToken: string;

  /** Optional display title for the imported Markdown file. */
  readonly title?: string;

  /**
   * Engine override.  Phase 3-1 only accepts 'markitdown' (or omits it).
   * Any reserved engine value → ENGINE_NOT_AVAILABLE.
   *
   * Phase 3-4-B: prefer `mode` over `engine`.  If both are specified,
   * `engine` takes precedence for backward compatibility.
   */
  readonly engine?: ImportEngine;

  /**
   * Import mode — Phase 3-4-B / Phase 3-4-K.
   *
   * 'quick' (default):      MarkItDown fast import.
   * 'paper_quality':        Standard paper import (PyMuPDF4LLM external).
   * 'paper_enhanced':       High-fidelity paper import (Marker external).
   * 'precision':            Layout-aware academic PDF import.
   * 'ocr':                  OCR import for scanned PDFs.
   *
   * Omitted → defaults to 'quick'.  renderer selects mode only;
   * main process resolves the actual engine based on capability probe.
   *
   * ⚠️  Do NOT set `engine` to a reserved value from the renderer.
   */
  readonly mode?: ImportMode;

  // ⚠️  sourcePath intentionally absent (E-1 C1 frozen).
}

export interface CreateImportJobResult {
  readonly ok: true;
  readonly jobId: string;
}

export type CreateImportJobErrorCode =
  | 'VAULT_NOT_OPEN'
  | 'NO_SOURCE_SELECTED'
  | 'SOURCE_FILE_NOT_FOUND'
  | 'COPY_FAILED'
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'MIME_MISMATCH'
  | 'ENGINE_NOT_AVAILABLE'
  | 'DUPLICATE_JOB'
  | 'INTERNAL_ERROR';

export interface CreateImportJobFailure {
  readonly ok: false;
  readonly code: CreateImportJobErrorCode;
  readonly message: string;
}

export type CreateImportJobOutcome = CreateImportJobResult | CreateImportJobFailure;

// ── Job Phase ───────────────────────────────────

/** Contract-level import job phases (E-1 frozen). */
export type ImportJobPhase =
  | 'pending'
  | 'copying'
  | 'converting'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ── Job Status ──────────────────────────────────

export interface ImportJobStatus {
  readonly jobId: string;
  readonly vaultId: string;
  readonly phase: ImportJobPhase;
  readonly engine: ImportEngine;
  readonly sourceFormat: ImportSourceFormat;

  /** Original file name (safe — no path). */
  readonly sourceFileName: string;

  /** Vault-relative path to the attachment copy. */
  readonly attachmentRelativePath: string;

  /** Vault-relative path to the generated Markdown (null until completed). */
  readonly outputMarkdownRelativePath: string | null;

  /** Vault-relative path to the companion JSON (null until completed). */
  readonly companionRelativePath: string | null;

  readonly progress: number; // 0–1
  readonly warnings: readonly ImportJobWarning[];
  readonly error: ImportJobError | null;
  readonly createdAt: string;      // ISO 8601
  readonly completedAt: string | null;

  /** Import mode (Phase 3-4-D). Omitted for Phase 3-1 quick imports. */
  readonly importMode?: ImportMode;

  /**
   * Paper quality companion summary (Phase 3-4-H3).
   * Only populated for paper_quality jobs that reach 'completed' phase.
   * Contains safe UI-facing quality and asset summaries.
   * Undefined for quick / precision / ocr jobs.
   *
   * ⚠️  MUST NOT contain system paths, sourcePath, engine names, or tracebacks.
   */
  readonly companionSummary?: ImportCompanionSummary;

  // ⚠️  sourcePath intentionally absent.
}

// ── Companion Summary (Phase 3-4-H3) ───────────

export type ImportCompanionSourceType = 'paper_pdf';

export type ImportPreservationStatus =
  | 'yes' | 'partial' | 'no' | 'unknown';

export type ImportFormulaPreservationStatus =
  | 'image' | 'text' | 'partial' | 'no' | 'unknown' | 'placeholder';

export interface ImportAssetSummary {
  readonly figures: number;
  readonly tables: number;
  readonly formulaImages: number;
  readonly pageSnapshots: number;
}

export interface ImportQualityReportSummary {
  readonly textExtracted: boolean;
  readonly figuresPreserved: ImportPreservationStatus;
  readonly tablesPreserved: ImportPreservationStatus;
  readonly formulasPreserved: ImportFormulaPreservationStatus;
  /** Sanitized user-facing warnings. No paths, engine names, or tracebacks. */
  readonly warnings: readonly string[];
}

export interface ImportPreviewSummary {
  readonly available: boolean;
}

export interface ImportCompanionSummary {
  readonly sourceType: ImportCompanionSourceType;
  readonly assetSummary: ImportAssetSummary;
  readonly qualityReport: ImportQualityReportSummary;
  readonly preview: ImportPreviewSummary;
}

// ── Warning / Error ─────────────────────────────

export interface ImportJobWarning {
  readonly code: string;
  readonly message: string;
  readonly format: ImportSourceFormat;
}

export interface ImportJobError {
  readonly code: string;
  readonly message: string;  // safe — no system paths
  readonly recoverable: boolean;
}

// ── Get / List / Cancel ─────────────────────────

export interface GetImportJobStatusInput {
  readonly vaultId: string;
  readonly jobId: string;
}

export type GetImportJobStatusErrorCode =
  | 'VAULT_NOT_OPEN'
  | 'JOB_NOT_FOUND'
  | 'INVALID_INPUT';

export interface GetImportJobStatusSuccess {
  readonly ok: true;
  readonly status: ImportJobStatus;
}

export interface GetImportJobStatusFailure {
  readonly ok: false;
  readonly code: GetImportJobStatusErrorCode;
  readonly message: string;
}

export type GetImportJobStatusResult = GetImportJobStatusSuccess | GetImportJobStatusFailure;

export interface ListImportJobsInput {
  readonly vaultId: string;
}

export interface ListImportJobsSuccess {
  readonly ok: true;
  readonly jobs: readonly ImportJobStatus[];
}

export interface ListImportJobsFailure {
  readonly ok: false;
  readonly code: 'VAULT_NOT_OPEN';
  readonly message: string;
}

export type ListImportJobsResult = ListImportJobsSuccess | ListImportJobsFailure;

export interface CancelImportJobInput {
  readonly vaultId: string;
  readonly jobId: string;
}

export type CancelImportJobErrorCode =
  | 'VAULT_NOT_OPEN'
  | 'JOB_NOT_FOUND'
  | 'JOB_NOT_CANCELLABLE';

export interface CancelImportJobSuccess {
  readonly ok: true;
}

export interface CancelImportJobFailure {
  readonly ok: false;
  readonly code: CancelImportJobErrorCode;
  readonly message: string;
}

export type CancelImportJobResult = CancelImportJobSuccess | CancelImportJobFailure;

// ── Select Source Result ─────────────────────────

export interface SelectImportSourceSuccess {
  readonly ok: true;
  readonly selectedSourceToken: string;
  readonly sourceFileName: string;
  readonly sourceFormat: 'pdf' | 'docx';
  readonly sizeBytes: number;
}

export interface SelectImportSourceCancelled {
  readonly ok: false;
  readonly reason: 'cancelled';
  readonly message: string;
}

export interface SelectImportSourceFailure {
  readonly ok: false;
  readonly reason: 'unsupported_format' | 'file_too_large' | 'internal_error';
  readonly message: string;
}

export type SelectImportSourceResult =
  | SelectImportSourceSuccess
  | SelectImportSourceCancelled
  | SelectImportSourceFailure;

// ── Renderer API ─────────────────────────────────

/** Narrow import namespace exposed to the renderer. */
export interface ScholaImportApi {
  readonly selectSource: (input?: SelectImportSourceInput) => Promise<SelectImportSourceResult>;
  readonly createJob: (input: CreateImportJobInput) => Promise<CreateImportJobOutcome>;
  readonly getJobStatus: (vaultId: string, jobId: string) => Promise<GetImportJobStatusResult>;
  readonly listJobs: (vaultId: string) => Promise<ListImportJobsResult>;
  readonly cancelJob: (vaultId: string, jobId: string) => Promise<CancelImportJobResult>;
  readonly getAvailableModes: () => Promise<GetAvailableModesResult>;
  /** Open the original imported PDF (Phase 3-4-H3). */
  readonly openOriginalFile: (vaultId: string, originalFileRef: string) => Promise<OpenOriginalImportFileResult>;
  /** Reveal the original imported PDF in the file manager (Phase 3-4-H3). */
  readonly revealOriginalFile: (vaultId: string, originalFileRef: string) => Promise<RevealOriginalImportFileResult>;
}

// ── H3 Original File Open/Reveal (Phase 3-4-H3) ──

/**
 * Input for opening or revealing the original imported PDF.
 *
 * ⚠️  originalFileRef MUST be vault-relative and follow the pattern:
 *     attachments/imports/{jobId}_{safeName}.pdf
 *     The renderer gets this from ImportJobStatus.attachmentRelativePath.
 *     NEVER construct from arbitrary user input or external sourcePath.
 */
export interface OpenOriginalImportFileInput {
  readonly vaultId: string;
  readonly originalFileRef: string;
}

export type RevealOriginalImportFileInput = OpenOriginalImportFileInput;

/** Successful open/reveal — no additional data returned. */
export interface OpenOriginalImportFileSuccess {
  readonly ok: true;
}

/** Failed open/reveal — error is a sanitized user-facing message. */
export interface OpenOriginalImportFileFailure {
  readonly ok: false;
  /** Sanitized message.  MUST NOT contain system paths, sourcePath, traceback, or engine names. */
  readonly error: string;
}

export type OpenOriginalImportFileResult = OpenOriginalImportFileSuccess | OpenOriginalImportFileFailure;
export type RevealOriginalImportFileResult = OpenOriginalImportFileSuccess | OpenOriginalImportFileFailure;
