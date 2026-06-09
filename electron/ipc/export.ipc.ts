/**
 * Export IPC handlers — Phase 3-1-C.
 *
 * Registers 4 fixed-function export IPC channels:
 *   export:create-job
 *   export:get-job-status
 *   export:list-jobs
 *   export:cancel-job
 *
 * ⚠️  System absolute paths are never returned to the renderer.
 *     All renderer-visible paths are vault-relative.
 */

import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import {
  EXPORT_CREATE_JOB_CHANNEL,
  EXPORT_GET_JOB_STATUS_CHANNEL,
  EXPORT_LIST_JOBS_CHANNEL,
  EXPORT_CANCEL_JOB_CHANNEL,
} from '../../src/lib/contracts/import-export-ipc.types';
import type {
  CreateExportJobInput,
  CreateExportJobOutcome,
  GetExportJobStatusResult,
  ListExportJobsResult,
  CancelExportJobResult,
} from '../../src/lib/contracts/export-job.types';
import type {
  ExportFormat,
  ExportEngineInput,
} from '../../src/lib/contracts/export.types';
import type { ExportArtifactMetadata } from '../../src/lib/contracts/export-artifact.types';
import { DEFAULT_EXPORT_ENGINE } from '../../src/lib/contracts/engine-registry.types';
import { resolveVaultPath } from '../security/path-guard';
import { getVaultRootPath } from '../services/vault.service';
import {
  createJob,
  getJob,
  listJobs,
  updatePhase,
  updateProgress,
  updatePaths,
  setError,
  setChildProcess,
  cancelJob,
} from '../services/export-job.manager';
import { pandocEngine } from '../services/engines/export/pandoc.engine';
import { validateResourcePaths } from '../services/engines/export/pandoc-args';
import {
  checkPandocAvailability,
  checkLatexAvailability,
} from '../services/runtime-check.service';
import { assertVaultId, assertJobId } from '../lib/ipc-validation';

// ── Helpers ──────────────────────────────────────

function exportExtension(format: ExportFormat): string {
  switch (format) {
    case 'docx': return '.docx';
    case 'pdf': return '.pdf';
    case 'latex': return '.tex';
    case 'html': return '.html';
  }
}

// ── Registration ─────────────────────────────────

export function registerExportIpc(): void {
  // ── export:create-job ───────────────────────
  ipcMain.handle(
    EXPORT_CREATE_JOB_CHANNEL,
    async (_event, input: unknown): Promise<CreateExportJobOutcome> => {
      try {
        const { vaultId, sourceMarkdownRelativePath, targetFormat, pandocOptions, engine } =
          (input as CreateExportJobInput) ?? {};

        const vault = assertVaultId(vaultId);
        const markdownPath = typeof sourceMarkdownRelativePath === 'string' &&
          sourceMarkdownRelativePath.trim().length > 0
          ? sourceMarkdownRelativePath
          : '';
        if (!markdownPath) {
          return { ok: false, code: 'MARKDOWN_NOT_FOUND', message: 'No Markdown file specified.' };
        }
        if (!markdownPath.endsWith('.md') && !markdownPath.endsWith('.markdown')) {
          return { ok: false, code: 'INTERNAL_ERROR', message: 'Source file must be a Markdown file.' };
        }

        const format: ExportFormat = targetFormat ?? 'docx';
        if (!['docx', 'pdf', 'latex', 'html'].includes(format)) {
          return {
            ok: false,
            code: 'UNSUPPORTED_FORMAT',
            message: 'Unsupported export format: ' + format,
          };
        }

        // Validate engine
        const selectedEngine = engine ?? DEFAULT_EXPORT_ENGINE;
        if (selectedEngine !== 'pandoc') {
          return {
            ok: false,
            code: 'ENGINE_NOT_AVAILABLE',
            message: 'Engine is not available: ' + selectedEngine,
          };
        }

        // Resolve vault root
        const rootPath = getVaultRootPath(vault);
        if (!rootPath) {
          return { ok: false, code: 'VAULT_NOT_OPEN', message: 'No vault is currently open.' };
        }

        // Validate source markdown path is inside vault
        try {
          resolveVaultPath(rootPath, markdownPath);
        } catch {
          return {
            ok: false,
            code: 'MARKDOWN_NOT_FOUND',
            message: 'Source Markdown file is not inside the vault.',
          };
        }

        // Check source file exists
        const sourceAbs = resolveVaultPath(rootPath, markdownPath);
        try {
          await fs.access(sourceAbs);
        } catch {
          return { ok: false, code: 'MARKDOWN_NOT_FOUND', message: 'Source Markdown file not found.' };
        }

        // Validate resourcePaths
        const resourceErr = validateResourcePaths(rootPath, pandocOptions?.resourcePaths);
        if (resourceErr) {
          return { ok: false, code: 'INTERNAL_ERROR', message: resourceErr };
        }

        // Run Pandoc + LaTeX availability checks
        const pandocResult = await checkPandocAvailability();
        if (!pandocResult.available) {
          return { ok: false, code: 'ENGINE_NOT_AVAILABLE', message: 'Pandoc is not available.' };
        }

        if (format === 'pdf') {
          const latexResult = await checkLatexAvailability();
          if (!latexResult.available) {
            return {
              ok: false,
              code: 'LATEX_NOT_AVAILABLE',
              message: 'LaTeX is not available. PDF export requires a LaTeX installation.',
            };
          }
        }

        // Create job
        const job = createJob({
          vaultId: vault,
          engine: selectedEngine,
          targetFormat: format,
          sourceMarkdownRelativePath: markdownPath,
        });

        // Execute export asynchronously
        executeExport({
          jobId: job.jobId,
          vaultId: vault,
          rootPath,
          sourceMarkdownRelativePath: markdownPath,
          targetFormat: format,
          pandocOptions: {
            standalone: pandocOptions?.standalone ?? true,
            templateId: pandocOptions?.templateId ?? null,
            bibliographyId: pandocOptions?.bibliographyId ?? null,
            cslStyleId: pandocOptions?.cslStyleId ?? null,
            resourcePaths: pandocOptions?.resourcePaths,
            metadata: pandocOptions?.metadata,
          },
        }).catch((err) => {
          console.error('[schola:export] Async export failed for job ' + job.jobId + ':', err);
        });

        return { ok: true, jobId: job.jobId };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, code: 'INTERNAL_ERROR', message };
        }
        return { ok: false, code: 'INTERNAL_ERROR', message: message.slice(0, 200) };
      }
    },
  );

  // ── export:get-job-status ───────────────────
  ipcMain.handle(
    EXPORT_GET_JOB_STATUS_CHANNEL,
    async (_event, vaultId: unknown, jobId: unknown): Promise<GetExportJobStatusResult> => {
      try {
        assertVaultId(vaultId);
        const id = assertJobId(jobId);
        const status = getJob(id);
        if (!status) {
          return { ok: false, code: 'JOB_NOT_FOUND', message: 'Export job not found.' };
        }
        return { ok: true, status };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, code: 'INVALID_INPUT', message };
        }
        return { ok: false, code: 'VAULT_NOT_OPEN', message: message.slice(0, 200) };
      }
    },
  );

  // ── export:list-jobs ────────────────────────
  ipcMain.handle(
    EXPORT_LIST_JOBS_CHANNEL,
    async (_event, vaultId: unknown): Promise<ListExportJobsResult> => {
      try {
        const id = assertVaultId(vaultId);
        const jobs = listJobs(id);
        return { ok: true, jobs };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, code: 'VAULT_NOT_OPEN', message };
        }
        return { ok: false, code: 'VAULT_NOT_OPEN', message: message.slice(0, 200) };
      }
    },
  );

  // ── export:cancel-job ───────────────────────
  ipcMain.handle(
    EXPORT_CANCEL_JOB_CHANNEL,
    async (_event, vaultId: unknown, jobId: unknown): Promise<CancelExportJobResult> => {
      try {
        assertVaultId(vaultId);
        const id = assertJobId(jobId);
        const status = cancelJob(id);
        if (!status) {
          return { ok: false, code: 'JOB_NOT_FOUND', message: 'Export job not found.' };
        }
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, code: 'JOB_NOT_CANCELLABLE', message };
        }
        return { ok: false, code: 'JOB_NOT_CANCELLABLE', message: message.slice(0, 200) };
      }
    },
  );
}

// ── Export execution (async, fire-and-forget) ────

interface ExecuteExportParams {
  readonly jobId: string;
  readonly vaultId: string;
  readonly rootPath: string;
  readonly sourceMarkdownRelativePath: string;
  readonly targetFormat: ExportFormat;
  readonly pandocOptions: {
    readonly standalone: boolean;
    readonly templateId: string | null;
    readonly bibliographyId: string | null;
    readonly cslStyleId: string | null;
    readonly resourcePaths?: readonly string[];
    readonly metadata?: {
      readonly title?: string;
      readonly author?: string;
      readonly date?: string;
      readonly lang?: string;
    };
  };
}

async function executeExport(params: ExecuteExportParams): Promise<void> {
  const { jobId, vaultId, rootPath, sourceMarkdownRelativePath, targetFormat } = params;

  try {
    updatePhase(jobId, 'converting');
    updateProgress(jobId, 0.1);

    // Build output path: _exports/<jobId>_<safeBaseName>.<ext>
    const safeBase = sourceMarkdownRelativePath
      .split('/').pop()!
      .replace(/\.(md|markdown)$/i, '')
      .replace(/[<>:"|?*\\]/g, '_')
      .slice(0, 100) || 'export';

    const ext = exportExtension(targetFormat);
    const outputRel = '_exports/' + jobId + '_' + safeBase + ext;

    // Ensure _exports/ exists
    const exportsDir = '_exports';
    const exportsDirAbs = resolveVaultPath(rootPath, exportsDir);
    await fs.mkdir(exportsDirAbs, { recursive: true });

    // Build metadata path
    const metadataDir = '.schola/metadata/exports';
    const metadataDirAbs = resolveVaultPath(rootPath, metadataDir);
    await fs.mkdir(metadataDirAbs, { recursive: true });
    const metadataRel = metadataDir + '/' + jobId + '.json';
    const metadataAbs = resolveVaultPath(rootPath, metadataRel);

    updatePaths(jobId, { outputRelativePath: outputRel, metadataRelativePath: metadataRel });
    updateProgress(jobId, 0.2);

    // Call Pandoc engine
    const engineInput: ExportEngineInput = {
      vaultId,
      jobId,
      sourceFormat: 'markdown',
      targetFormat,
      markdownRelativePath: sourceMarkdownRelativePath,
      outputRelativePath: outputRel,
      metadataRelativePath: metadataRel,
      pandocOptions: params.pandocOptions,
    };

    const startTime = Date.now();
    const engineResult = await pandocEngine.convert(engineInput);
    const durationMs = Date.now() - startTime;
    updateProgress(jobId, 0.9);

    // Write export metadata
    const metadata: ExportArtifactMetadata = {
      schemaVersion: 1,
      exportId: jobId,
      vaultId,
      jobId,
      sourceMarkdownRelativePath,
      outputRelativePath: engineResult.ok ? outputRel : '',
      metadataRelativePath: metadataRel,
      targetFormat,
      engine: 'pandoc',
      engineVersion: pandocEngine.version,
      pandocOptions: params.pandocOptions,
      warnings: engineResult.warnings.map((w) => ({
        code: w.code,
        message: w.message.slice(0, 500),
        format: targetFormat,
      })),
      error: engineResult.error
        ? {
            code: engineResult.error.code,
            message: engineResult.error.message.slice(0, 500),
            recoverable: engineResult.error.recoverable,
          }
        : null,
      createdAt: new Date().toISOString(),
      durationMs,
    };

    await fs.writeFile(metadataAbs, JSON.stringify(metadata, null, 2), 'utf-8');
    updateProgress(jobId, 0.95);

    if (engineResult.ok) {
      updatePhase(jobId, 'completed');
      updateProgress(jobId, 1);
    } else {
      setError(jobId, {
        code: engineResult.error?.code ?? 'CONVERSION_FAILED',
        message: engineResult.error?.message ?? 'Conversion failed.',
        recoverable: false,
      });
      updatePhase(jobId, 'failed');
      updateProgress(jobId, 1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown export error';
    setError(jobId, { code: 'INTERNAL_ERROR', message: message.slice(0, 500), recoverable: false });
    updatePhase(jobId, 'failed');
    updateProgress(jobId, 0);
  } finally {
    setChildProcess(jobId, null);
  }
}
