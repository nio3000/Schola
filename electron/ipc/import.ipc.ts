/**
 * Import IPC handlers — Phase 3-1-B / Phase 3-4-H3 / Phase 3-4-I.
 *
 * Registers 8 fixed-function import IPC channels:
 *   import:select-source
 *   import:create-job
 *   import:get-job-status
 *   import:list-jobs
 *   import:cancel-job
 *   import:get-available-modes
 *   import:open-original-file    (Phase 3-4-H3)
 *   import:reveal-original-file  (Phase 3-4-H3)
 *
 * ⚠️  sourcePath NEVER crosses to the renderer.
 *     All renderer-visible paths are vault-relative.
 */

import { ipcMain, dialog } from 'electron';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  IMPORT_SELECT_SOURCE_CHANNEL,
  IMPORT_CREATE_JOB_CHANNEL,
  IMPORT_GET_JOB_STATUS_CHANNEL,
  IMPORT_LIST_JOBS_CHANNEL,
  IMPORT_CANCEL_JOB_CHANNEL,
  IMPORT_GET_AVAILABLE_MODES_CHANNEL,
  IMPORT_OPEN_ORIGINAL_FILE_CHANNEL,
  IMPORT_REVEAL_ORIGINAL_FILE_CHANNEL,
} from '../../src/lib/contracts/import-export-ipc.types';
import type {
  CreateImportJobInput,
  CreateImportJobOutcome,
  GetImportJobStatusResult,
  ListImportJobsResult,
  CancelImportJobResult,
  SelectImportSourceResult,
  SelectImportSourceInput,
  ImportSourceFormatFilter,
  GetAvailableModesResult,
  EnhancedImportDiagnostics,
  OpenOriginalImportFileResult,
  RevealOriginalImportFileResult,
} from '../../src/lib/contracts/import-job.types';
import type {
  ImportSourceFormat,
  ImportEngine,
  ImportMode,
  EngineConvertInput,
  EngineConvertResult,
} from '../../src/lib/contracts/import.types';
import type { ImportCompanion, PreviewMeta } from '../../src/lib/contracts/import-companion.types';
import { DEFAULT_IMPORT_ENGINE } from '../../src/lib/contracts/engine-registry.types';
import { resolveVaultPath, assertPathInsideRoot } from '../security/path-guard';
import { getVaultRootPath } from '../services/vault.service';
import { isFeatureEnabled } from '../services/feature-flag.service';
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
} from '../services/import-job.manager';
import { markitdownEngine } from '../services/engines/import/markitdown.engine';
import { doclingEngine } from '../services/engines/import/docling.engine';
import { baselinePaperEngine } from '../services/engines/import/baseline-paper.engine';
import { computeAvailableModes, computeAvailableProductModes, getCachedEnhancedDiagnosticsSnapshot, getCachedEnhancedDiagnostics, runMarkerConversionPoC } from '../services/engines/import/import-engine-capability-probe.service';
import { sanitizeErrorMessage } from '../services/engines/import/bridge-validation';
import { assertVaultId, assertString, assertJobId } from '../lib/ipc-validation';
import { sanitizeIpcError, ipcErrorBody } from '../lib/error-utils';
import {
  buildPreviewMeta,
  buildPaperQualityFrontmatter,
} from '../services/engines/import/paper-quality-post-process.service';
import {
  openOriginalImportFile,
  revealOriginalImportFile,
} from '../services/import-original-file-open.service';

// ── Constants ─────────────────────────────────────

/** Baseline paper engine version for companion metadata (Phase 3-4-Lite). */
const ENGINE_VERSION = '1.0.0';

/** Default diagnostics when no probe has been performed yet. */
function defaultEnhancedDiagnostics(): EnhancedImportDiagnostics {
  return {
    available: false,
    reason: 'Enhanced runtime not yet checked. Click "Enhanced Import" to probe.',
    installHint: null,
    pythonVersion: null,
    engineVersion: null,
    enginePackageInstalled: false,
    modelsDownloaded: null,
    modelSizeMb: null,
    diskFreeMb: null,
  };
}

// ── Source token store ───────────────────────────

interface SourceTokenEntry {
  readonly sourcePath: string;
  readonly sourceFileName: string;
  readonly sourceFormat: ImportSourceFormat;
  readonly sizeBytes: number;
  readonly expiresAt: number;
}

const sourceTokens = new Map<string, SourceTokenEntry>();
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateToken(): string {
  return `src_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function consumeToken(token: string): SourceTokenEntry | null {
  const entry = sourceTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sourceTokens.delete(token);
    return null;
  }
  sourceTokens.delete(token); // one-time use
  return entry;
}

function storeToken(entry: SourceTokenEntry): string {
  const token = generateToken();
  sourceTokens.set(token, entry);
  // Periodic cleanup of expired tokens
  if (sourceTokens.size > 100) {
    const now = Date.now();
    for (const [key, val] of sourceTokens) {
      if (now > val.expiresAt) sourceTokens.delete(key);
    }
  }
  return token;
}

// ── Helpers ──────────────────────────────────────

function detectFormat(fileName: string): ImportSourceFormat | null {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.docx') return 'docx';
  return null;
}

function safeBaseName(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName));
  // Replace unsafe characters with underscores
  return base
    .replace(/[<>:"|?*\\/]/g, '_')
    .replace(/^\.+/, '_')
    .slice(0, 200)
    || 'imported';
}

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk: Buffer) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ── Registration ─────────────────────────────────

export function registerImportIpc(): void {
  // ── import:select-source ─────────────────────
  ipcMain.handle(
    IMPORT_SELECT_SOURCE_CHANNEL,
    async (_event, input?: SelectImportSourceInput): Promise<SelectImportSourceResult> => {
      try {
        // Validate formatFilter whitelist
        const ALLOWED_FORMATS: readonly ImportSourceFormatFilter[] = ['pdf', 'docx', 'pptx', 'xlsx', 'html'];
        const requested = input?.formatFilter ?? [];
        const valid = requested.length > 0
          ? requested.filter(f => (ALLOWED_FORMATS as readonly string[]).includes(f))
          : ['pdf', 'docx'];
        const extensions = valid.length > 0 ? valid : ['pdf', 'docx'];

        const result = await dialog.showOpenDialog({
          title: 'Select source file to import',
          properties: ['openFile'],
          filters: [
            { name: 'Documents', extensions },
          ],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return {
            ok: false,
            reason: 'cancelled',
            message: 'File selection was cancelled.',
          };
        }

        const sourcePath = result.filePaths[0];
        const sourceFileName = path.basename(sourcePath);
        const format = detectFormat(sourceFileName);

        if (!format) {
          return {
            ok: false,
            reason: 'unsupported_format',
            message: 'Only PDF and DOCX files are currently supported.',
          };
        }

        let stat: { size: number };
        try {
          stat = await fs.stat(sourcePath);
        } catch {
          return {
            ok: false,
            reason: 'internal_error',
            message: 'Could not read the selected file.',
          };
        }

        const token = storeToken({
          sourcePath,
          sourceFileName,
          sourceFormat: format,
          sizeBytes: stat.size,
          expiresAt: Date.now() + TOKEN_TTL_MS,
        });

        return {
          ok: true,
          selectedSourceToken: token,
          sourceFileName,
          sourceFormat: format as 'pdf' | 'docx',
          sizeBytes: stat.size,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return {
          ok: false,
          reason: 'internal_error',
          message: message.slice(0, 200),
        };
      }
    },
  );

  // ── import:create-job ───────────────────────
  ipcMain.handle(
    IMPORT_CREATE_JOB_CHANNEL,
    async (_event, input: unknown): Promise<CreateImportJobOutcome> => {
      try {
        const { vaultId, selectedSourceToken, title, engine, mode } =
          (input as CreateImportJobInput & { title?: string; engine?: ImportEngine; mode?: 'quick' | 'paper_quality' | 'paper_enhanced' | 'precision' | 'ocr' }) ?? {};

        const vault = assertVaultId(vaultId);
        const token = assertString(selectedSourceToken, 'selectedSourceToken');

        // Resolve vault root
        const rootPath = getVaultRootPath(vault);
        if (!rootPath) {
          return { ok: false, code: 'VAULT_NOT_OPEN', message: 'No vault is currently open.' };
        }

        // Consume token (one-time use)
        const entry = consumeToken(token);
        if (!entry) {
          return {
            ok: false,
            code: 'NO_SOURCE_SELECTED',
            message: 'No source file was selected or the selection has expired. Please select a file again.',
          };
        }

        // ── Resolve import mode ──
        const importMode: ImportMode = (mode as ImportMode | undefined) ?? 'quick';

        // ocr: still unavailable
        if (importMode === 'ocr') {
          return {
            ok: false,
            code: 'ENGINE_NOT_AVAILABLE',
            message: 'OCR import is not available.',
          };
        }

        // ── Resolve engine from mode ──
        // engine from renderer is only accepted as 'markitdown' (backward compat).
        // Any other explicit engine value → ENGINE_NOT_AVAILABLE.
        // The main process selects the engine based on mode, never from renderer input.
        let resolvedEngine: ImportEngine;
        let engineVersionForCompanion: string | null = null;

        if (engine !== undefined && engine !== 'markitdown') {
          return {
            ok: false,
            code: 'ENGINE_NOT_AVAILABLE',
            message: 'The requested engine is not available.',
          };
        }

        // ── quick (default): auto-route PDF vs non-PDF ──
        if (importMode === 'quick') {
          // Phase 4-0-B: quick + PDF → built-in baseline engine
          if (entry.sourceFormat === 'pdf') {
            resolvedEngine = 'baseline_paper';
            engineVersionForCompanion = ENGINE_VERSION;
          } else {
            resolvedEngine = DEFAULT_IMPORT_ENGINE; // markitdown
          }
        }
        // ── enhanced: paper_enhanced, feature-flag-gated ──
        else if (importMode === 'paper_enhanced') {
          if (entry.sourceFormat !== 'pdf') {
            return {
              ok: false,
              code: 'UNSUPPORTED_FORMAT',
              message: '增强导入仅支持 PDF 格式。',
            };
          }
          // Phase 4-0-D-4/D-5: feature-flag-gated Marker production integration
          if (!isFeatureEnabled('enhancedImportEnabled')) {
            return {
              ok: false,
              code: 'ENGINE_NOT_AVAILABLE',
              message: '增强导入尚未就绪。该功能将在后续版本中开放。',
            };
          }
          // Check Marker availability (reuses cache from import:check-enhanced-runtime)
          const diag = await getCachedEnhancedDiagnostics({ forceRefresh: false });
          if (!diag.available || !diag.enginePackageInstalled) {
            return {
              ok: false,
              code: 'ENGINE_NOT_AVAILABLE',
              message: diag.reason ?? '增强导入运行时未就绪。请安装 Python 3.10+ 与 marker-pdf。',
            };
          }
          // Route to Marker engine
          resolvedEngine = 'marker_reserved';
          engineVersionForCompanion = ENGINE_VERSION;
        }
        // ── paper_quality: legacy compatibility ──
        else if (importMode === 'paper_quality') {
          if (entry.sourceFormat !== 'pdf') {
            return {
              ok: false,
              code: 'UNSUPPORTED_FORMAT',
              message: '论文导入仅支持 PDF 格式。',
            };
          }
          // Legacy: route to built-in baseline engine (same as quick+PDF)
          resolvedEngine = 'baseline_paper';
          engineVersionForCompanion = ENGINE_VERSION;
        }
        // ── precision: deprecated ──
        else if (importMode === 'precision') {
          return {
            ok: false,
            code: 'ENGINE_NOT_AVAILABLE',
            message: 'Precision import is no longer available.',
          };
        }
        else {
          resolvedEngine = DEFAULT_IMPORT_ENGINE; // 'markitdown'
        }

        // Create job
        const job = createJob({
          vaultId: vault,
          engine: resolvedEngine,
          sourceFormat: entry.sourceFormat,
          sourceFileName: entry.sourceFileName,
          mode: importMode,
        });

        // Execute import asynchronously (don't block IPC response)
        executeImport({
          jobId: job.jobId,
          vaultId: vault,
          rootPath,
          sourcePath: entry.sourcePath,
          sourceFormat: entry.sourceFormat,
          sourceFileName: entry.sourceFileName,
          title,
          mode,
          engine: resolvedEngine,
          engineVersion: engineVersionForCompanion,
          importMode,
        }).catch((err) => {
          console.error(`[schola:import] Async import failed for job ${job.jobId}:`, err);
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

  // ── import:get-job-status ───────────────────
  ipcMain.handle(
    IMPORT_GET_JOB_STATUS_CHANNEL,
    async (_event, vaultId: unknown, jobId: unknown): Promise<GetImportJobStatusResult> => {
      try {
        assertVaultId(vaultId);
        const id = assertJobId(jobId);
        const status = getJob(id);
        if (!status) {
          return { ok: false, code: 'JOB_NOT_FOUND', message: 'Import job not found.' };
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

  // ── import:list-jobs ────────────────────────
  ipcMain.handle(
    IMPORT_LIST_JOBS_CHANNEL,
    async (_event, vaultId: unknown): Promise<ListImportJobsResult> => {
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

  // ── import:cancel-job ───────────────────────
  ipcMain.handle(
    IMPORT_CANCEL_JOB_CHANNEL,
    async (_event, vaultId: unknown, jobId: unknown): Promise<CancelImportJobResult> => {
      try {
        assertVaultId(vaultId);
        const id = assertJobId(jobId);
        const status = cancelJob(id);
        if (!status) {
          return { ok: false, code: 'JOB_NOT_FOUND', message: 'Import job not found.' };
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

  // ── import:get-available-modes ───────────────
  ipcMain.handle(
    IMPORT_GET_AVAILABLE_MODES_CHANNEL,
    async (): Promise<GetAvailableModesResult> => {
      // Phase 4-4-B: Use snapshot to avoid blocking on full diagnostics probe.
      // Enhanced diagnostics are returned from cache (or null if never probed).
      // On-demand probe is triggered separately via import:check-enhanced-runtime.
      const modes = computeAvailableModes(true);
      const productModes = computeAvailableProductModes(true);
      const enhancedDiagnostics = getCachedEnhancedDiagnosticsSnapshot()
        ?? defaultEnhancedDiagnostics();
      return {
        ok: true,
        modes: {
          quick: modes.quick,
          paperQuality: modes.paper_quality,
          paperEnhanced: modes.paper_enhanced,
          precision: modes.precision,
          ocr: modes.ocr,
        },
        productModes: {
          quick: productModes.quick,
          enhanced: productModes.enhanced,
        },
        enhancedDiagnostics,
      };
    },
  );

  // ── import:check-enhanced-runtime ─────────────
  // Phase 4-4-B: On-demand Marker / enhanced runtime probe.
  // Triggered when the user clicks "Enhanced Import" in the UI.
  // Uses cached result within TTL; supports forceRefresh for manual re-check.
  ipcMain.handle(
    'import:check-enhanced-runtime',
    async (_event, input?: { forceRefresh?: boolean }): Promise<EnhancedImportDiagnostics> => {
      try {
        const result = await getCachedEnhancedDiagnostics({
          forceRefresh: input?.forceRefresh ?? false,
        });
        return result;
      } catch (err) {
        const message = sanitizeErrorMessage(
          err instanceof Error ? err.message : 'Unknown error',
        );
        return {
          available: false,
          reason: message.slice(0, 200),
          installHint: null,
          pythonVersion: null,
          engineVersion: null,
          enginePackageInstalled: false,
          modelsDownloaded: null,
          modelSizeMb: null,
          diskFreeMb: null,
        };
      }
    },
  );

  // ── H3: import:open-original-file ────────────
  ipcMain.handle(
    IMPORT_OPEN_ORIGINAL_FILE_CHANNEL,
    async (_event, vaultId: unknown, originalFileRef: unknown): Promise<OpenOriginalImportFileResult> => {
      try {
        if (typeof vaultId !== 'string' || vaultId.trim().length === 0) {
          return { ok: false, error: 'Vault 无效。' };
        }
        return await openOriginalImportFile(vaultId, originalFileRef);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { ok: false, error: message.slice(0, 200) };
      }
    },
  );

  // ── H3: import:reveal-original-file ──────────
  ipcMain.handle(
    IMPORT_REVEAL_ORIGINAL_FILE_CHANNEL,
    async (_event, vaultId: unknown, originalFileRef: unknown): Promise<RevealOriginalImportFileResult> => {
      try {
        if (typeof vaultId !== 'string' || vaultId.trim().length === 0) {
          return { ok: false, error: 'Vault 无效。' };
        }
        return await revealOriginalImportFile(vaultId, originalFileRef);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { ok: false, error: message.slice(0, 200) };
      }
    },
  );
}

// ── Import execution (async, fire-and-forget from IPC) ──

/**
 * Phase 4-0-D-4: Bridge Marker PoC runner to EngineConvertInput.
 * Validates vault boundary before calling the controlled bridge.
 */
async function runMarkerConversion(
  input: EngineConvertInput,
  vaultRoot: string,
): Promise<EngineConvertResult> {
  const attachmentAbs = resolveVaultPath(vaultRoot, input.attachmentRelativePath);
  const outputDir = path.join(path.dirname(resolveVaultPath(vaultRoot, input.outputMarkdownRelativePath)), 'marker_output');

  assertPathInsideRoot(vaultRoot, attachmentAbs);
  assertPathInsideRoot(vaultRoot, outputDir);

  const result = await runMarkerConversionPoC({
    attachmentPath: attachmentAbs,
    outputDir,
  });

  if (result.ok) {
    return {
      ok: true,
      markdownRelativePath: input.outputMarkdownRelativePath,
      companionRelativePath: input.companionRelativePath,
      quality: 'full' as const,
      warnings: [],
      error: null,
    };
  }
  return {
    ok: false,
    markdownRelativePath: null,
    companionRelativePath: null,
    quality: 'failed' as const,
    warnings: [],
    error: { code: result.errorCode ?? 'CONVERSION_FAILED', message: result.errorMessage ?? 'Unknown error.', recoverable: false },
  };
}

interface ExecuteImportParams {
  readonly jobId: string;
  readonly vaultId: string;
  readonly rootPath: string;
  readonly sourcePath: string;
  readonly sourceFormat: ImportSourceFormat;
  readonly sourceFileName: string;
  readonly title?: string;
  readonly mode?: 'quick' | 'paper_quality' | 'paper_enhanced' | 'precision' | 'ocr';
  readonly engine: ImportEngine;
  readonly engineVersion: string | null;
  readonly importMode: ImportMode;
}

async function executeImport(params: ExecuteImportParams): Promise<void> {
  const { jobId, vaultId, rootPath, sourcePath, sourceFormat, sourceFileName, title } = params;

  let outputMarkdownRel = '';

  try {
    // Phase: copying
    updatePhase(jobId, 'copying');
    updateProgress(jobId, 0.05);

    // Build attachment path: attachments/imports/<jobId>_<safeName>.<ext>
    const safeName = safeBaseName(sourceFileName);
    const originalExt = sourceFormat === 'pdf' ? '.pdf' : '.docx';
    const attachmentRel = 'attachments/imports/' + jobId + '_' + safeName + originalExt;
    const attachmentAbs = resolveVaultPath(rootPath, attachmentRel);

    // Ensure attachments/imports/ exists
    const attachmentsDir = 'attachments/imports';
    const attachmentsDirAbs = resolveVaultPath(rootPath, attachmentsDir);
    await fs.mkdir(attachmentsDirAbs, { recursive: true });

    await fs.copyFile(sourcePath, attachmentAbs);

    // sourcePath is now consumed — discard it
    // (the local variable sourcePath goes out of scope after this function)

    updateProgress(jobId, 0.2);

    // Compute SHA-256 of the copied file
    const fileHash = await hashFile(attachmentAbs);

    // Build output paths
    const notesDir = 'notes/imported';
    const notesDirAbs = resolveVaultPath(rootPath, notesDir);
    await fs.mkdir(notesDirAbs, { recursive: true });

    outputMarkdownRel = notesDir + '/' + safeName + '.md';
    let outputMarkdownAbs = resolveVaultPath(rootPath, outputMarkdownRel);

    // Avoid overwriting existing files
    let counter = 1;
    while (await fileExists(outputMarkdownAbs)) {
      outputMarkdownRel = `${notesDir}/${safeName}_${counter}.md`;
      outputMarkdownAbs = resolveVaultPath(rootPath, outputMarkdownRel);
      counter += 1;
    }

    const metadataDir = '.schola/metadata/imports';
    const metadataDirAbs = resolveVaultPath(rootPath, metadataDir);
    await fs.mkdir(metadataDirAbs, { recursive: true });

    const companionRel = metadataDir + '/' + jobId + '.json';
    const companionAbs = resolveVaultPath(rootPath, companionRel);

    // Update job paths
    updatePaths(jobId, {
      attachmentRelativePath: attachmentRel,
      outputMarkdownRelativePath: outputMarkdownRel,
      companionRelativePath: companionRel,
    });
    updateProgress(jobId, 0.3);

    // Phase: converting
    updatePhase(jobId, 'converting');
    updateProgress(jobId, 0.4);

    // ── Route to engine ──
    const engineInput: EngineConvertInput = {
      vaultId,
      jobId,
      sourceFormat,
      attachmentRelativePath: attachmentRel,
      outputMarkdownRelativePath: outputMarkdownRel,
      companionRelativePath: companionRel,
    };

    const isMarker = params.engine === 'marker_reserved';
    const isPrecision = params.engine === 'docling_reserved';
    const isPaperQuality = params.importMode === 'paper_quality';
    const engineResult = isMarker
      ? await runMarkerConversion(engineInput, rootPath)
      : (isPrecision
         ? await doclingEngine.convert(engineInput)
         : (isPaperQuality ? await baselinePaperEngine.convert(engineInput)
            : await markitdownEngine.convert(engineInput)));
    updateProgress(jobId, 0.85);

    // ── paper_quality: create assetsDir ──
    let paperQualityAssetsDir = '';
    if (isPaperQuality) {
      paperQualityAssetsDir = `notes/imported/assets/${jobId}`;
      try {
        const assetsDirAbs = resolveVaultPath(rootPath, paperQualityAssetsDir);
        await fs.mkdir(assetsDirAbs, { recursive: true });
      } catch {
        // assetsDir creation failed — non-fatal, record in diagnostics
      }
    }

    // ── Build companion ──
    const companionCreatedAt = new Date().toISOString();
    const originalFileRef = isPaperQuality ? attachmentRel : undefined;
    const companion: ImportCompanion = {
      schemaVersion: 1,
      companionId: jobId,
      vaultId,
      jobId,
      markdownRelativePath: outputMarkdownRel,
      attachmentRelativePath: attachmentRel,
      sourceFormat,
      sourceFileName,
      sourceFileHash: fileHash,
      engine: params.engine,
      engineVersion: isPrecision ? params.engineVersion
        : (isPaperQuality ? params.engineVersion : markitdownEngine.version),
      quality: engineResult.ok ? engineResult.quality : 'failed',
      // importMode always recorded for paper_quality; only on success for quick/precision
      ...(engineResult.ok
        ? { importMode: params.importMode }
        : (isPaperQuality ? { importMode: params.importMode as ImportMode } : {})),
      warnings: engineResult.warnings.map((w: { readonly code: string; readonly message: string; readonly format: string }) => ({
        code: w.code,
        message: w.message.slice(0, 500),
        format: sourceFormat,
      })),
      error: engineResult.error
        ? {
            code: engineResult.error.code,
            message: sanitizeErrorMessage(engineResult.error.message).slice(0, 500),
            recoverable: engineResult.error.recoverable,
          }
        : null,
      createdAt: companionCreatedAt,
      // ── paper_quality extensions ──
      ...(isPaperQuality ? {
        sourceType: 'paper_pdf' as const,
        originalFileRef: originalFileRef as string,
        assetsDir: paperQualityAssetsDir || undefined,
        assetSummary: engineResult.ok ? {
          figures: 0,
          tables: 0,
          formulaImages: 0,
          pageSnapshots: 0,
        } : undefined,
        qualityReport: engineResult.ok ? {
          textExtracted: true,
          figuresPreserved: 'unknown' as const,
          tablesPreserved: 'unknown' as const,
          formulasPreserved: 'unknown' as const,
          warnings: [
            '当前为基础论文导入，图片、公式、表格和复杂排版可能未被完整保留，请结合原 PDF 核对。',
            '如需高精度解析，可在后续增强组件中配置外部运行时。',
          ],
        } : undefined,
        preview: engineResult.ok ? buildPreviewMeta(outputMarkdownRel) : { available: false } as PreviewMeta,
      } : {}),
    };

    // Write companion — failure here triggers cleanup
    try {
      await fs.writeFile(companionAbs, JSON.stringify(companion, null, 2), 'utf-8');
    } catch {
      // Companion write failed: treat as overall failure + cleanup
      await cleanupImportArtifacts(rootPath, outputMarkdownRel, jobId, companionRel);
      setError(jobId, {
        code: 'INTERNAL_ERROR',
        message: '导入元数据保存失败。',
        recoverable: false,
      });
      updatePhase(jobId, 'failed');
      updateProgress(jobId, 1);
      return;
    }
    updateProgress(jobId, 0.95);

    if (engineResult.ok) {
      // ── Success path ──
      // Verify output Markdown exists and is non-empty
      let markdownOk = false;
      try {
        const stat = await fs.stat(outputMarkdownAbs);
        markdownOk = stat.size > 0;
      } catch { /* missing */ }

      if (!markdownOk) {
        await cleanupImportArtifacts(rootPath, outputMarkdownRel, jobId, companionRel);
        setError(jobId, {
          code: 'CONVERSION_FAILED',
          message: '导入未能生成有效内容。',
          recoverable: false,
        });
        updatePhase(jobId, 'failed');
        updateProgress(jobId, 1);
        return;
      }

      // Paper quality: write extended frontmatter
      if (isPaperQuality) {
        const frontmatter = buildPaperQualityFrontmatter({
          jobId,
          originalFileRef: attachmentRel,
          createdAt: companion.createdAt,
          title,
          sourceFileName,
        });
        const existingContent = await fs.readFile(outputMarkdownAbs, 'utf-8');
        await fs.writeFile(outputMarkdownAbs, frontmatter + '\n' + existingContent, 'utf-8');
      } else if (!isPrecision) {
        // Quick mode: prepend frontmatter to Markdown
        const frontmatter = [
          '---',
          `title: ${title ?? safeName}`,
          `sourceFormat: ${sourceFormat}`,
          `importedAt: ${companion.createdAt}`,
          `companionId: ${jobId}`,
          `sourceFileName: ${sourceFileName}`,
          '---',
          '',
        ].join('\n');
        const existingContent = await fs.readFile(outputMarkdownAbs, 'utf-8');
        await fs.writeFile(outputMarkdownAbs, frontmatter + existingContent, 'utf-8');
      }

      updatePhase(jobId, 'completed');
      updateProgress(jobId, 1);
    } else {
      // ── Failure path: cleanup + record error ──
      await cleanupImportArtifacts(rootPath, outputMarkdownRel, jobId, null);
      setError(jobId, {
        code: engineResult.error?.code ?? 'CONVERSION_FAILED',
        message: engineResult.error?.message
          ? sanitizeErrorMessage(engineResult.error.message).slice(0, 500)
          : (isPrecision ? '论文导入失败。可稍后重试，或改用快速导入。'
            : (isPaperQuality ? '论文导入未能完成，原始文件已保留，可尝试快速导入。'
            : '快速导入失败。请尝试论文导入，或检查文件格式后重试。')),
        recoverable: false,
      });
      updatePhase(jobId, 'failed');
      updateProgress(jobId, 1);
    }
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Unknown import error';
    // Best-effort cleanup
    if (typeof outputMarkdownRel === 'string' && outputMarkdownRel) {
      await cleanupImportArtifacts(rootPath, outputMarkdownRel, jobId, null).catch(() => {});
    }
    setError(jobId, {
      code: 'INTERNAL_ERROR',
      message: sanitizeErrorMessage(rawMsg).slice(0, 500),
      recoverable: false,
    });
    updatePhase(jobId, 'failed');
    updateProgress(jobId, 0);
  } finally {
    setChildProcess(jobId, null);
  }
}

// ── Cleanup ──────────────────────────────────────

/**
 * Remove import artifacts on failure.
 *
 * Cleans: output Markdown, assets directory, and optionally the companion JSON.
 * All removals are best-effort — failures are silently ignored to avoid
 * masking the primary conversion error.
 */
async function cleanupImportArtifacts(
  rootPath: string,
  outputMarkdownRel: string,
  jobId: string,
  companionRel: string | null,
): Promise<void> {
  const removals: string[] = [];

  // Output Markdown
  try {
    removals.push(resolveVaultPath(rootPath, outputMarkdownRel));
  } catch { /* path invalid — skip */ }

  // Assets directory
  try {
    removals.push(resolveVaultPath(rootPath, `notes/imported/assets/${jobId}`));
  } catch { /* path invalid — skip */ }

  // Companion (if provided)
  if (companionRel) {
    try {
      removals.push(resolveVaultPath(rootPath, companionRel));
    } catch { /* path invalid — skip */ }
  }

  for (const absPath of removals) {
    try {
      await fs.rm(absPath, { recursive: true, force: true });
    } catch {
      // Best-effort: suppress individual removal errors
    }
  }
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}
