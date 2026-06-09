/**
 * Docling import engine — Phase 3-4-C2-a / Phase 3-4-D-R5-P1 / Phase 3-4-F0.
 *
 * @archived Phase 4-0-B-IMP-3: Docling permanently removed from active route.
 * DISABLE_RESERVED_ENGINE_PROBES=true permanently — precision route REJECTED.
 * Code preserved as historical reference only.
 * Do NOT re-enable — future enhanced import will use Marker/MinerU instead.
 *
 * Original: Implements IImportEngine for docling_reserved.
 * Converts PDF attachments to Markdown via a controlled Python bridge script.
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
 *     9. Bridge output filenames are bare — paths are constructed by main process.
 *
 * Phase 3-4-D-R5-P1: error messages use Chinese user-facing text.
 *     Internal diagnostics use DIAGNOSTIC_ERROR_CODES.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveVaultPath } from '../../../security/path-guard';
import { resolvePythonExe } from '../../runtime-check.service';
import { getVaultRootPath } from '../../vault.service';
import { validateBridgeOutput, sanitizeErrorMessage, DIAGNOSTIC_ERROR_CODES } from './bridge-validation';
import type {
  IImportEngine,
  ImportEngine,
  ImportSourceFormat,
  EngineConvertInput,
  EngineConvertResult,
  ImportWarningEntry,
} from '../../../../src/lib/contracts/import.types';

// ── Constants ────────────────────────────────────

const CONVERSION_TIMEOUT_MS = 300_000;
const MAX_STDOUT_BYTES = 100_000;
const SUPPORTED_FORMATS: readonly ImportSourceFormat[] = ['pdf'];

// ── Bridge script path ───────────────────────────

function resolveBridgeScriptPath(): string {
  // From dist-electron/electron/services/engines/import/ → 5 levels up → project root
  return path.resolve(__dirname, '..', '..', '..', '..', '..', 'scripts', 'python', 'engines', 'docling_convert.py');
}

// ── Engine ───────────────────────────────────────

export const doclingEngine: IImportEngine = {
  id: 'docling_reserved' as ImportEngine,
  displayName: 'Docling',
  version: 'unknown',
  supportedFormats: SUPPORTED_FORMATS,
  maxFileSizeBytes: { pdf: 100 * 1024 * 1024 },

  async convert(input: EngineConvertInput): Promise<EngineConvertResult> {
    let vaultRoot: string;
    try {
      vaultRoot = getVaultRootPath(input.vaultId);
    } catch {
      return {
        ok: false, markdownRelativePath: null, companionRelativePath: null,
        quality: 'failed', warnings: [],
        error: { code: 'INTERNAL_ERROR', message: 'Vault is not available for conversion.', recoverable: false },
      };
    }

    const attachmentAbs = resolveVaultPath(vaultRoot, input.attachmentRelativePath);
    const outputAbs = resolveVaultPath(vaultRoot, input.outputMarkdownRelativePath);
    const outputDir = path.dirname(outputAbs);
    await fs.mkdir(outputDir, { recursive: true });

    const assetsRel = `notes/imported/assets/${input.jobId}`;
    const assetsAbs = resolveVaultPath(vaultRoot, assetsRel);
    await fs.mkdir(assetsAbs, { recursive: true });

    const pythonExe = await resolvePythonExe();
    if (!pythonExe) {
      return {
        ok: false, markdownRelativePath: null, companionRelativePath: null,
        quality: 'failed', warnings: [],
        error: { code: DIAGNOSTIC_ERROR_CODES.PRECISION_CONVERSION_FAILED, message: '论文导入暂不可用。', recoverable: false },
      };
    }

    const bridgeScript = resolveBridgeScriptPath();
    const warnings: ImportWarningEntry[] = [];

    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(
          pythonExe,
          [bridgeScript, '--input', attachmentAbs, '--output', outputAbs, '--assets-dir', assetsAbs],
          { timeout: CONVERSION_TIMEOUT_MS, windowsHide: true, maxBuffer: MAX_STDOUT_BYTES + 1024 },
          (err, out, stderr) => {
            if (err) {
              if ((err as NodeJS.ErrnoException & { killed?: boolean }).killed) {
                reject(new Error('TIMEOUT')); return;
              }
              reject(new Error('论文导入失败。可稍后重试，或改用快速导入。'));
              return;
            }
            if (stderr && stderr.trim().length > 0) {
              warnings.push({ code: 'CONVERSION_WARNING', message: 'Conversion produced diagnostic output.', format: input.sourceFormat });
            }
            resolve(out);
          },
        );
      });

      if (stdout.length > MAX_STDOUT_BYTES) {
        return {
          ok: false, markdownRelativePath: null, companionRelativePath: null,
          quality: 'failed', warnings,
          error: { code: DIAGNOSTIC_ERROR_CODES.PRECISION_BRIDGE_INVALID_JSON, message: '论文导入返回无效数据。', recoverable: false },
        };
      }

      let bridgeOutput: ReturnType<typeof validateBridgeOutput>;
      try { bridgeOutput = validateBridgeOutput(JSON.parse(stdout)); } catch {
        return {
          ok: false, markdownRelativePath: null, companionRelativePath: null,
          quality: 'failed', warnings,
          error: { code: DIAGNOSTIC_ERROR_CODES.PRECISION_BRIDGE_INVALID_JSON, message: '论文导入返回无效数据。', recoverable: false },
        };
      }

      if (!bridgeOutput.ok) {
        const msg = bridgeOutput.error ? sanitizeErrorMessage(bridgeOutput.error) : '论文导入失败。可稍后重试，或改用快速导入。';
        return {
          ok: false, markdownRelativePath: null, companionRelativePath: null,
          quality: 'failed', warnings,
          error: { code: 'CONVERSION_FAILED', message: msg, recoverable: false },
        };
      }

      let markdownExists = false;
      try { const stat = await fs.stat(outputAbs); markdownExists = stat.size > 0; } catch { /* missing */ }
      if (!markdownExists) {
        return {
          ok: false, markdownRelativePath: null, companionRelativePath: null,
          quality: 'failed', warnings,
          error: { code: DIAGNOSTIC_ERROR_CODES.PRECISION_OUTPUT_EMPTY, message: '论文导入未能生成有效内容。', recoverable: false },
        };
      }

      return {
        ok: true,
        markdownRelativePath: input.outputMarkdownRelativePath,
        companionRelativePath: input.companionRelativePath,
        quality: 'full', warnings, error: null,
      };
    } catch (_err) {
      if (_err instanceof Error && _err.message === 'TIMEOUT') {
        return {
          ok: false, markdownRelativePath: null, companionRelativePath: null,
          quality: 'failed', warnings,
          error: { code: DIAGNOSTIC_ERROR_CODES.PRECISION_TIMEOUT, message: '论文导入超时，文档可能过大。', recoverable: false },
        };
      }
      // Engine errors already sanitized above; sanitize again as defence-in-depth
      const msg = _err instanceof Error ? sanitizeErrorMessage(_err.message) : '论文导入失败。可稍后重试，或改用快速导入。';
      return {
        ok: false, markdownRelativePath: null, companionRelativePath: null,
        quality: 'failed', warnings,
        error: { code: DIAGNOSTIC_ERROR_CODES.PRECISION_CONVERSION_FAILED, message: msg || '论文导入失败。可稍后重试，或改用快速导入。', recoverable: false },
      };
    }
  },
};
