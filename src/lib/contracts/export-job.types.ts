/**
 * Export job types — Phase 3-1-A.
 *
 * Defines the export job lifecycle, status, and IPC input/output types.
 *
 * ⚠️  ExportJobStatus uses sourceMarkdownRelativePath / outputRelativePath
 *     (E-2 C3 / E-3 C2 frozen).  System absolute paths are never stored.
 */

import type { ExportEngine, ExportFormat, PandocOptions } from './export.types';

// ── IPC Channels (also defined in import-export-ipc.types.ts) ──

export const EXPORT_CREATE_JOB_CHANNEL = 'export:create-job';
export const EXPORT_GET_JOB_STATUS_CHANNEL = 'export:get-job-status';
export const EXPORT_LIST_JOBS_CHANNEL = 'export:list-jobs';
export const EXPORT_CANCEL_JOB_CHANNEL = 'export:cancel-job';

// ── Create Job ──────────────────────────────────

export interface CreateExportJobInput {
  readonly vaultId: string;

  /** Vault-relative path to the source Markdown file. */
  readonly sourceMarkdownRelativePath: string;

  /** Target export format. */
  readonly targetFormat: ExportFormat;

  /** Optional Pandoc options (defaults used when omitted). */
  readonly pandocOptions?: Partial<PandocOptions>;

  /**
   * Engine override.  Phase 3-1 only accepts 'pandoc' (or omits it).
   * Any reserved engine value → ENGINE_NOT_AVAILABLE.
   */
  readonly engine?: ExportEngine;
}

export interface CreateExportJobResult {
  readonly ok: true;
  readonly jobId: string;
}

export type CreateExportJobErrorCode =
  | 'VAULT_NOT_OPEN'
  | 'MARKDOWN_NOT_FOUND'
  | 'UNSUPPORTED_FORMAT'
  | 'ENGINE_NOT_AVAILABLE'
  | 'LATEX_NOT_AVAILABLE'
  | 'INVALID_TEMPLATE_ID'
  | 'INVALID_BIBLIOGRAPHY_ID'
  | 'INVALID_CSL_STYLE_ID'
  | 'OUTPUT_PATH_CONFLICT'
  | 'INTERNAL_ERROR';

export interface CreateExportJobFailure {
  readonly ok: false;
  readonly code: CreateExportJobErrorCode;
  readonly message: string;
}

export type CreateExportJobOutcome = CreateExportJobResult | CreateExportJobFailure;

// ── Job Phase ───────────────────────────────────

/** Contract-level export job phases (E-2 frozen). */
export type ExportJobPhase =
  | 'pending'
  | 'converting'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ── Job Status ──────────────────────────────────

export interface ExportJobStatus {
  readonly jobId: string;
  readonly vaultId: string;
  readonly phase: ExportJobPhase;
  readonly engine: ExportEngine;
  readonly targetFormat: ExportFormat;

  /** Vault-relative path to the source Markdown (E-3 C2 frozen). */
  readonly sourceMarkdownRelativePath: string;

  /** Vault-relative path to the export artifact (null until completed). */
  readonly outputRelativePath: string | null;

  /** Vault-relative path to the export metadata JSON (null until completed). */
  readonly metadataRelativePath: string | null;

  readonly progress: number; // 0–1
  readonly warnings: readonly ExportJobWarning[];
  readonly error: ExportJobError | null;
  readonly createdAt: string;      // ISO 8601
  readonly completedAt: string | null;

  // ⚠️  sourceMarkdownPath / outputPath intentionally renamed
  //     to *RelativePath (E-2 C3 / E-3 C2 frozen).
}

// ── Warning / Error ─────────────────────────────

export interface ExportJobWarning {
  readonly code: string;
  readonly message: string;
  readonly format: ExportFormat;
}

export interface ExportJobError {
  readonly code: string;
  readonly message: string;  // safe — no system paths
  readonly recoverable: boolean;
}

// ── Get / List / Cancel ─────────────────────────

export interface GetExportJobStatusInput {
  readonly vaultId: string;
  readonly jobId: string;
}

export type GetExportJobStatusErrorCode =
  | 'VAULT_NOT_OPEN'
  | 'JOB_NOT_FOUND'
  | 'INVALID_INPUT';

export interface GetExportJobStatusSuccess {
  readonly ok: true;
  readonly status: ExportJobStatus;
}

export interface GetExportJobStatusFailure {
  readonly ok: false;
  readonly code: GetExportJobStatusErrorCode;
  readonly message: string;
}

export type GetExportJobStatusResult = GetExportJobStatusSuccess | GetExportJobStatusFailure;

export interface ListExportJobsInput {
  readonly vaultId: string;
}

export interface ListExportJobsSuccess {
  readonly ok: true;
  readonly jobs: readonly ExportJobStatus[];
}

export interface ListExportJobsFailure {
  readonly ok: false;
  readonly code: 'VAULT_NOT_OPEN';
  readonly message: string;
}

export type ListExportJobsResult = ListExportJobsSuccess | ListExportJobsFailure;

export interface CancelExportJobInput {
  readonly vaultId: string;
  readonly jobId: string;
}

export type CancelExportJobErrorCode =
  | 'VAULT_NOT_OPEN'
  | 'JOB_NOT_FOUND'
  | 'JOB_NOT_CANCELLABLE';

export interface CancelExportJobSuccess {
  readonly ok: true;
}

export interface CancelExportJobFailure {
  readonly ok: false;
  readonly code: CancelExportJobErrorCode;
  readonly message: string;
}

export type CancelExportJobResult = CancelExportJobSuccess | CancelExportJobFailure;

// ── Renderer API ─────────────────────────────────

/** Narrow export namespace exposed to the renderer. */
export interface ScholaExportApi {
  readonly createJob: (input: CreateExportJobInput) => Promise<CreateExportJobOutcome>;
  readonly getJobStatus: (vaultId: string, jobId: string) => Promise<GetExportJobStatusResult>;
  readonly listJobs: (vaultId: string) => Promise<ListExportJobsResult>;
  readonly cancelJob: (vaultId: string, jobId: string) => Promise<CancelExportJobResult>;
}
