/**
 * Export job manager — Phase 3-1-C.
 *
 * In-memory job lifecycle manager.  Jobs are NOT persisted to SQLite
 * or disk — they are ephemeral and lost on app restart.
 *
 * Manages the full export job lifecycle:
 *   pending → converting → completed
 *   pending / converting → failed
 *   pending / converting → cancelled
 */

import type { ChildProcess } from 'node:child_process';

import type {
  ExportJobPhase,
  ExportJobStatus,
  ExportJobWarning,
  ExportJobError,
} from '../../src/lib/contracts/export-job.types';
import type { ExportEngine, ExportFormat } from '../../src/lib/contracts/export.types';

// ── Types ───────────────────────────────────────

interface InternalJob {
  status: ExportJobStatus;
  childProcess: ChildProcess | null;
  createdAt: number;
}

// ── State ────────────────────────────────────────

const jobs = new Map<string, InternalJob>();
const MAX_TERMINAL_JOBS = 50;

// ── Helpers ──────────────────────────────────────

function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `export_${timestamp}_${random}`;
}

function isTerminalPhase(phase: ExportJobPhase): boolean {
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
  readonly engine: ExportEngine;
  readonly targetFormat: ExportFormat;
  readonly sourceMarkdownRelativePath: string;
}): ExportJobStatus {
  const jobId = generateJobId();
  const now = new Date().toISOString();

  const status: ExportJobStatus = {
    jobId,
    vaultId: params.vaultId,
    phase: 'pending',
    engine: params.engine,
    targetFormat: params.targetFormat,
    sourceMarkdownRelativePath: params.sourceMarkdownRelativePath,
    outputRelativePath: null,
    metadataRelativePath: null,
    progress: 0,
    warnings: [],
    error: null,
    createdAt: now,
    completedAt: null,
  };

  jobs.set(jobId, { status, childProcess: null, createdAt: Date.now() });
  return status;
}

export function getJob(jobId: string): ExportJobStatus | null {
  return jobs.get(jobId)?.status ?? null;
}

export function listJobs(vaultId: string, limit = 50): readonly ExportJobStatus[] {
  const result: ExportJobStatus[] = [];
  for (const [, job] of jobs) {
    if (job.status.vaultId !== vaultId) continue;
    result.push(job.status);
    if (result.length >= limit) break;
  }
  result.sort((a, b) => {
    const aTerm = isTerminalPhase(a.phase) ? 1 : 0;
    const bTerm = isTerminalPhase(b.phase) ? 1 : 0;
    if (aTerm !== bTerm) return aTerm - bTerm;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return result;
}

export function updatePhase(jobId: string, phase: ExportJobPhase): void {
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
  paths: { readonly outputRelativePath?: string; readonly metadataRelativePath?: string },
): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = {
    ...job.status,
    ...(paths.outputRelativePath !== undefined && { outputRelativePath: paths.outputRelativePath }),
    ...(paths.metadataRelativePath !== undefined && { metadataRelativePath: paths.metadataRelativePath }),
  };
}

export function addWarning(jobId: string, warning: ExportJobWarning): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = { ...job.status, warnings: [...job.status.warnings, warning] };
}

export function setError(jobId: string, error: ExportJobError): void {
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

export function cancelJob(jobId: string): ExportJobStatus | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (isTerminalPhase(job.status.phase)) return job.status;
  if (job.childProcess) {
    try { job.childProcess.kill(); } catch { /* best-effort */ }
    job.childProcess = null;
  }
  job.status = {
    ...job.status,
    phase: 'cancelled',
    completedAt: new Date().toISOString(),
    error: { code: 'CANCELLED', message: 'Export job was cancelled.', recoverable: false },
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
