/**
 * PyMuPDF4LLM import engine — Phase 3-4-I-ENG-2.
 *
 * @deprecated Phase 4-0-B-IMP-3: PyMuPDF4LLM removed from active route.
 * Engine code preserved for reference only.
 * Do NOT use for new import jobs — routing will reject.
 * Future: Marker/MinerU will serve the enhanced import route.
 *
 * Original: Implements IImportEngine for PyMuPDF4LLM.
 * Converts PDF attachments to Markdown via a controlled Python bridge script
 * (pymupdf4llm_convert.py).
 *
 * ⚠️  Security invariants (same as markitdown.engine.ts):
 *     1. Only processes vault-internal attachmentRelativePath.
 *     2. sourcePath is NEVER part of EngineConvertInput.
 *     3. Uses child_process.execFile (no shell: true).
 *     4. Parameters are array-ised, never string-concatenated.
 *     5. Input/output paths resolved via resolveVaultPath().
 *     6. Raw stderr is never returned to the caller.
 *     7. Timeout + kill on failure.
 *     8. Bridge stdout JSON is validated before use.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveVaultPath } from '../../../security/path-guard';
import { resolvePythonExe } from '../../runtime-check.service';
import { getVaultRootPath } from '../../vault.service';
import { sanitizeErrorMessage } from './bridge-validation';
import type {
  IImportEngine,
  ImportEngine,
  ImportSourceFormat,
  EngineConvertInput,
  EngineConvertResult,
  ImportWarningEntry,
} from '../../../../src/lib/contracts/import.types';

// ── Constants ────────────────────────────────────

const CONVERSION_TIMEOUT_MS = 300_000; // 5 minutes for large academic PDFs
const MAX_STDOUT_BYTES = 500_000;
const SUPPORTED_FORMATS: readonly ImportSourceFormat[] = ['pdf'];

const VALID_ERROR_CODES = new Set([
  'PYMUPDF4LLM_NOT_AVAILABLE',
  'CONVERSION_FAILED',
  'INVALID_OUTPUT',
  'TIMEOUT',
]);

// ── Helpers ───────────────────────────────────────

function resolveVaultRootForVault(vaultId: string): string | null {
  return getVaultRootPath(vaultId);
}

function resolveBridgeScriptPath(): string {
  return path.resolve(__dirname, '..', '..', '..', '..', '..', 'scripts', 'python', 'engines', 'pymupdf4llm_convert.py');
}

interface BridgeSuccess {
  ok: true;
  pageCount: number | null;
  markdownBytes: number;
  imageCount: number;
  tableCount: number;
  warnings: string[];
}

interface BridgeFailure {
  ok: false;
  errorCode: string;
  message: string;
}

type BridgeOutput = BridgeSuccess | BridgeFailure;

function validateBridgeOutput(raw: unknown): BridgeOutput {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'Bridge output is not a JSON object.' };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.ok !== 'boolean') {
    return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'Bridge output missing required field: ok.' };
  }

  if (obj.ok === true) {
    // Success shape
    if (obj.pageCount !== undefined && obj.pageCount !== null && typeof obj.pageCount !== 'number') {
      return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'Bridge output pageCount must be number or null.' };
    }
    if (typeof obj.markdownBytes !== 'number') {
      return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'Bridge output markdownBytes must be a number.' };
    }
    if (typeof obj.imageCount !== 'number') {
      return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'Bridge output imageCount must be a number.' };
    }
    if (typeof obj.tableCount !== 'number') {
      return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'Bridge output tableCount must be a number.' };
    }
    const warnings = obj.warnings;
    if (warnings !== undefined && (!Array.isArray(warnings) || warnings.some(w => typeof w !== 'string'))) {
      return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'Bridge output warnings must be a string array.' };
    }
    return {
      ok: true,
      pageCount: typeof obj.pageCount === 'number' ? obj.pageCount : null,
      markdownBytes: obj.markdownBytes as number,
      imageCount: obj.imageCount as number,
      tableCount: obj.tableCount as number,
      warnings: Array.isArray(warnings) ? warnings.map(w => String(w).slice(0, 500)) : [],
    };
  }

  // Failure shape
  if (typeof obj.errorCode !== 'string' || !VALID_ERROR_CODES.has(obj.errorCode)) {
    return { ok: false, errorCode: 'INVALID_OUTPUT', message: 'Bridge output errorCode is invalid.' };
  }
  const message = typeof obj.message === 'string' ? obj.message.slice(0, 500) : 'Unknown bridge error.';
  return { ok: false, errorCode: obj.errorCode, message };
}

// ── Cleanup ───────────────────────────────────────

async function safeCleanup(absPaths: string[]): Promise<void> {
  for (const p of absPaths) {
    try { await fs.rm(p, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

// ── Engine ────────────────────────────────────────

export const pymupdf4llmEngine: IImportEngine = {
  id: 'pymupdf4llm' as ImportEngine,
  displayName: 'PyMuPDF4LLM',
  version: 'unknown',
  supportedFormats: SUPPORTED_FORMATS,
  maxFileSizeBytes: {},

  async convert(input: EngineConvertInput): Promise<EngineConvertResult> {
    const rootPath = resolveVaultRootForVault(input.vaultId);
    if (!rootPath) {
      return {
        ok: false, markdownRelativePath: null, companionRelativePath: null,
        quality: 'failed', warnings: [],
        error: { code: 'INTERNAL_ERROR', message: 'Vault is not available.', recoverable: false },
      };
    }

    const attachmentAbs = resolveVaultPath(rootPath, input.attachmentRelativePath);
    const outputAbs = resolveVaultPath(rootPath, input.outputMarkdownRelativePath);
    const outputDir = path.dirname(outputAbs);

    // Ensure output and assets directories exist
    const assetsDirRel = `notes/imported/assets/${input.jobId}`;
    const assetsDirAbs = resolveVaultPath(rootPath, assetsDirRel);

    try {
      await fs.mkdir(outputDir, { recursive: true });
      await fs.mkdir(assetsDirAbs, { recursive: true });
    } catch {
      return {
        ok: false, markdownRelativePath: null, companionRelativePath: null,
        quality: 'failed', warnings: [],
        error: { code: 'INTERNAL_ERROR', message: 'Cannot create output directories.', recoverable: false },
      };
    }

    // Resolve Python
    let pythonExe: string;
    try {
      const resolved = await resolvePythonExe();
      if (!resolved) {
        return {
          ok: false, markdownRelativePath: null, companionRelativePath: null,
          quality: 'failed', warnings: [],
          error: { code: 'INTERNAL_ERROR', message: '论文导入引擎暂不可用。', recoverable: false },
        };
      }
      pythonExe = resolved;
    } catch {
      return {
        ok: false, markdownRelativePath: null, companionRelativePath: null,
        quality: 'failed', warnings: [],
        error: { code: 'INTERNAL_ERROR', message: '论文导入引擎暂不可用。', recoverable: false },
      };
    }

    const bridgeScript = resolveBridgeScriptPath();

    try {
      const { stdout, killed } = await new Promise<{ stdout: string; killed: boolean }>((resolve, reject) => {
        const cp = execFile(
          pythonExe,
          [
            bridgeScript,
            '--input-pdf', attachmentAbs,
            '--output-md', outputAbs,
            '--assets-dir', assetsDirAbs,
            '--job-id', input.jobId,
            '--image-format', 'png',
            '--dpi', '150',
          ],
          {
            timeout: CONVERSION_TIMEOUT_MS,
            windowsHide: true,
            maxBuffer: MAX_STDOUT_BYTES + 1024,
          },
          (err, stdout, stderr) => {
            if (stderr && stderr.trim().length > 0) {
              // Log diagnostics to main-process console only (never to UI)
              const sanitizedStderr = sanitizeErrorMessage(stderr.slice(0, 500));
              console.error(`[schola:import:pymupdf4llm] Bridge stderr (diagnostic): ${sanitizedStderr}`);
            }
            if (err) {
              resolve({ stdout: stdout ?? '', killed: (err as { killed?: boolean }).killed === true });
              return;
            }
            resolve({ stdout: stdout ?? '', killed: false });
          },
        );
        // Reject only for unexpected execFile failures (not conversion errors)
        cp.on('error', (e) => reject(e));
      });

      if (killed) {
        await safeCleanup([outputAbs, assetsDirAbs]);
        return {
          ok: false, markdownRelativePath: null, companionRelativePath: null,
          quality: 'failed', warnings: [],
          error: { code: 'INTERNAL_ERROR', message: '论文导入超时。', recoverable: false },
        };
      }

      if (!stdout || stdout.trim().length === 0) {
        await safeCleanup([outputAbs, assetsDirAbs]);
        return {
          ok: false, markdownRelativePath: null, companionRelativePath: null,
          quality: 'failed', warnings: [],
          error: { code: 'CONVERSION_FAILED', message: '论文导入结果无效。', recoverable: false },
        };
      }

      // Parse bridge stdout JSON
      let bridgeResult: BridgeOutput;
      try {
        const firstLine = stdout.split(/[\r\n]+/)[0] ?? '';
        if (firstLine.length > MAX_STDOUT_BYTES) {
          await safeCleanup([outputAbs, assetsDirAbs]);
          return {
            ok: false, markdownRelativePath: null, companionRelativePath: null,
            quality: 'failed', warnings: [],
            error: { code: 'INVALID_OUTPUT', message: '论文导入结果无效。', recoverable: false },
          };
        }
        // Security: reject stdout containing forbidden patterns
        const forbiddenPatterns = ['traceback', 'site-packages', 'C:\\Users', '/home/', '/Users/'];
        const lower = firstLine.toLowerCase();
        if (forbiddenPatterns.some(p => lower.includes(p.toLowerCase()))) {
          await safeCleanup([outputAbs, assetsDirAbs]);
          return {
            ok: false, markdownRelativePath: null, companionRelativePath: null,
            quality: 'failed', warnings: [],
            error: { code: 'INVALID_OUTPUT', message: '论文导入结果无效。', recoverable: false },
          };
        }
        bridgeResult = validateBridgeOutput(JSON.parse(firstLine));
      } catch {
        await safeCleanup([outputAbs, assetsDirAbs]);
        return {
          ok: false, markdownRelativePath: null, companionRelativePath: null,
          quality: 'failed', warnings: [],
          error: { code: 'INVALID_OUTPUT', message: '论文导入结果无效。', recoverable: false },
        };
      }

      if (!bridgeResult.ok) {
        await safeCleanup([outputAbs, assetsDirAbs]);
        return {
          ok: false, markdownRelativePath: null, companionRelativePath: null,
          quality: 'failed', warnings: [],
          error: { code: 'CONVERSION_FAILED', message: '论文导入转换失败。', recoverable: false },
        };
      }

      // Verify output Markdown exists and is non-empty
      let markdownOk = false;
      try {
        const stat = await fs.stat(outputAbs);
        markdownOk = stat.size > 0;
      } catch { /* missing */ }
      if (!markdownOk) {
        await safeCleanup([outputAbs, assetsDirAbs]);
        return {
          ok: false, markdownRelativePath: null, companionRelativePath: null,
          quality: 'failed', warnings: [],
          error: { code: 'INVALID_OUTPUT', message: '论文导入结果无效。', recoverable: false },
        };
      }

      const success = bridgeResult as BridgeSuccess;
      const warnings: ImportWarningEntry[] = success.warnings.map(w => ({
        code: 'CONVERSION_WARNING',
        message: sanitizeErrorMessage(w).slice(0, 500),
        format: 'pdf',
      }));

      return {
        ok: true,
        markdownRelativePath: input.outputMarkdownRelativePath,
        companionRelativePath: input.companionRelativePath,
        quality: warnings.length > 0 ? 'partial' : 'full',
        warnings,
        error: null,
      };
    } catch {
      await safeCleanup([outputAbs, assetsDirAbs]);
      return {
        ok: false, markdownRelativePath: null, companionRelativePath: null,
        quality: 'failed', warnings: [],
        error: { code: 'CONVERSION_FAILED', message: '论文导入转换失败。', recoverable: false },
      };
    }
  },
};
