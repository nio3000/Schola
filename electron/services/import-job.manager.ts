/**
 * Import job manager — Phase 3-1-B.
 *
 * In-memory job lifecycle manager.  Jobs are NOT persisted to SQLite
 * or disk — they are ephemeral and lost on app restart.
 *
 * Manages the full import job lifecycle:
 *   pending → copying → converting → completed
 *   copying / converting → failed
 *   pending / copying / converting → cancelled
 */

import type { ChildProcess } from 'node:child_process';

import type {
  ImportJobPhase,
  ImportJobStatus,
  ImportJobWarning,
  ImportJobError,
} from '../../src/lib/contracts/import-job.types';
import type { ImportEngine, ImportSourceFormat, ImportMode } from '../../src/lib/contracts/import.types';

// ── Types ───────────────────────────────────────

interface InternalJob {
  status: ImportJobStatus;
  /** Child process handle for cancellation (null if no active process). */
  childProcess: ChildProcess | null;
  /** Creation timestamp for token cleanup / expiry. */
  createdAt: number;
}

// ── State ────────────────────────────────────────

const jobs = new Map<string, InternalJob>();

/** Maximum number of completed/failed/cancelled jobs to retain in memory. */
const MAX_TERMINAL_JOBS = 50;

// ── Helpers ──────────────────────────────────────

function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `import_${timestamp}_${random}`;
}

function isTerminalPhase(phase: ImportJobPhase): boolean {
  return phase === 'completed' || phase === 'failed' || phase === 'cancelled';
}

function pruneTerminalJobs(): void {
  const terminalJobs = [...jobs.entries()].filter(([, j]) => isTerminalPhase(j.status.phase));
  if (terminalJobs.length <= MAX_TERMINAL_JOBS) return;
  const toRemove = terminalJobs
    .sort((a, b) => a[1].createdAt - b[1].createdAt)
    .slice(0, terminalJobs.length - MAX_TERMINAL_JOBS);
  for (const [id] of toRemove) jobs.delete(id);
}

// ── Public API ───────────────────────────────────

export function createJob(params: {
  readonly vaultId: string;
  readonly engine: ImportEngine;
  readonly sourceFormat: ImportSourceFormat;
  readonly sourceFileName: string;
  readonly mode?: ImportMode;
}): ImportJobStatus {
  const jobId = generateJobId();
  const now = new Date().toISOString();

  const status: ImportJobStatus = {
    jobId,
    vaultId: params.vaultId,
    phase: 'pending',
    engine: params.engine,
    sourceFormat: params.sourceFormat,
    sourceFileName: params.sourceFileName,
    attachmentRelativePath: '',
    outputMarkdownRelativePath: null,
    companionRelativePath: null,
    progress: 0,
    warnings: [],
    error: null,
    createdAt: now,
    completedAt: null,
    ...(params.mode !== undefined ? { importMode: params.mode } : {}),
  };

  jobs.set(jobId, {
    status,
    childProcess: null,
    createdAt: Date.now(),
  });

  return status;
}

export function getJob(jobId: string): ImportJobStatus | null {
  return jobs.get(jobId)?.status ?? null;
}

export function listJobs(vaultId: string, limit = 50): readonly ImportJobStatus[] {
  const result: ImportJobStatus[] = [];
  for (const [, job] of jobs) {
    if (job.status.vaultId !== vaultId) continue;
    result.push(job.status);
    if (result.length >= limit) break;
  }
  // Sort: active first, then most recent
  result.sort((a, b) => {
    const aTerm = isTerminalPhase(a.phase) ? 1 : 0;
    const bTerm = isTerminalPhase(b.phase) ? 1 : 0;
    if (aTerm !== bTerm) return aTerm - bTerm;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return result;
}

export function updatePhase(jobId: string, phase: ImportJobPhase): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = { ...job.status, phase };
  if (isTerminalPhase(phase) && !job.status.completedAt) {
    job.status = { ...job.status, completedAt: new Date().toISOString() };
  }
  if (isTerminalPhase(phase)) pruneTerminalJobs();
}

export function updateProgress(jobId: string, progress: number): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = { ...job.status, progress: Math.max(0, Math.min(1, progress)) };
}

export function updatePaths(
  jobId: string,
  paths: { readonly attachmentRelativePath?: string; readonly outputMarkdownRelativePath?: string; readonly companionRelativePath?: string },
): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = {
    ...job.status,
    ...(paths.attachmentRelativePath !== undefined && { attachmentRelativePath: paths.attachmentRelativePath }),
    ...(paths.outputMarkdownRelativePath !== undefined && { outputMarkdownRelativePath: paths.outputMarkdownRelativePath }),
    ...(paths.companionRelativePath !== undefined && { companionRelativePath: paths.companionRelativePath }),
  };
}

export function addWarning(jobId: string, warning: ImportJobWarning): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = { ...job.status, warnings: [...job.status.warnings, warning] };
}

export function setError(jobId: string, error: ImportJobError): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = { ...job.status, error };
}

export function setChildProcess(jobId: string, cp: ChildProcess | null): void {
  const job = jobs.get(jobId);
  if (!job) return;
  if (job.childProcess && cp !== job.childProcess) {
    try { job.childProcess.kill(); } catch { /* best-effort */ }
  }
  job.childProcess = cp;
}

export function cancelJob(jobId: string): ImportJobStatus | null {
  const job = jobs.get(jobId);
  if (!job) return null;

  if (isTerminalPhase(job.status.phase)) return job.status;

  // Kill any active child process
  if (job.childProcess) {
    try { job.childProcess.kill(); } catch { /* best-effort */ }
    job.childProcess = null;
  }

  job.status = {
    ...job.status,
    phase: 'cancelled',
    completedAt: new Date().toISOString(),
    error: {
      code: 'CANCELLED',
      message: 'Import job was cancelled.',
      recoverable: false,
    },
  };

  pruneTerminalJobs();
  return job.status;
}

export function clearAll(): void {
  for (const [, job] of jobs) {
    if (job.childProcess) {
      try { job.childProcess.kill(); } catch { /* ignore */ }
    }
  }
  jobs.clear();
}
