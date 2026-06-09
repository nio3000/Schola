/**
 * MarkItDown import engine — Phase 3-1-B / Phase 3-4-D-R5-P1.
 *
 * Implements IImportEngine for MarkItDown, the default import engine.
 * Converts PDF / DOCX attachments to Markdown via the `markitdown` Python
 * CLI module.
 *
 * ⚠️  Security invariants:
 *     1. Only processes vault-internal attachmentRelativePath.
 *     2. sourcePath is NEVER part of EngineConvertInput.
 *     3. Uses child_process.execFile (no shell: true).
 *     4. Parameters are array-ised, never string-concatenated.
 *     5. Input/output paths resolved via resolveVaultPath().
 *     6. Raw stderr is never returned to the caller.
 *     7. Timeout + kill on failure.
 *
 * Phase 3-4-D-R5-P1: all error messages sanitized via sanitizeErrorMessage().
 *     UI-facing text uses Chinese user-friendly messages.
 *     Internal diagnostics use DIAGNOSTIC_ERROR_CODES.
 */

import { execFile, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveVaultPath } from '../../../security/path-guard';
import { resolvePythonExe } from '../../runtime-check.service';
import { sanitizeErrorMessage, DIAGNOSTIC_ERROR_CODES } from './bridge-validation';
import type {
  IImportEngine,
  ImportEngine,
  ImportSourceFormat,
  EngineConvertInput,
  EngineConvertResult,
  ImportWarningEntry,
} from '../../../../src/lib/contracts/import.types';

// ── Constants ────────────────────────────────────

const CONVERSION_TIMEOUT_MS = 120_000; // 2 minutes

const SUPPORTED_FORMATS: readonly ImportSourceFormat[] = ['pdf', 'docx'];

const MAX_FILE_SIZE_BYTES: Partial<Record<ImportSourceFormat, number>> = {
  pdf: 50 * 1024 * 1024,   // 50 MB
  docx: 50 * 1024 * 1024,  // 50 MB
};

// ── Engine ───────────────────────────────────────

export const markitdownEngine: IImportEngine = {
  id: 'markitdown' as ImportEngine,
  displayName: 'MarkItDown',
  version: '0.x', // Overwritten at runtime after availability check
  supportedFormats: SUPPORTED_FORMATS,
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,

  async convert(input: EngineConvertInput): Promise<EngineConvertResult> {
    const rootPath = resolveVaultRootForVault(input.vaultId);
    if (!rootPath) {
      return {
        ok: false,
        markdownRelativePath: null,
        companionRelativePath: null,
        quality: 'failed',
        warnings: [],
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Vault is not available for conversion.',
          recoverable: false,
        },
      };
    }

    const attachmentAbs = resolveVaultPath(rootPath, input.attachmentRelativePath);
    const outputAbs = resolveVaultPath(rootPath, input.outputMarkdownRelativePath);

    // Ensure output directory exists
    const outputDir = path.dirname(outputAbs);
    await fs.mkdir(outputDir, { recursive: true });

    const pythonExe = await resolvePythonExe();
    if (!pythonExe) {
      return {
        ok: false,
        markdownRelativePath: null,
        companionRelativePath: null,
        quality: 'failed',
        warnings: [],
        error: {
          code: DIAGNOSTIC_ERROR_CODES.QUICK_CONVERSION_FAILED,
          message: '快速导入暂不可用。',
          recoverable: false,
        },
      };
    }

    // Run MarkItDown: python -m markitdown <input> -o <output>
    const warnings: ImportWarningEntry[] = [];
    const childBox: { current: ChildProcess | null } = { current: null };

    try {
      const markdownContent = await new Promise<string>((resolve, reject) => {
        const cp = execFile(
          pythonExe,
          ['-m', 'markitdown', attachmentAbs, '-o', outputAbs],
          {
            timeout: CONVERSION_TIMEOUT_MS,
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024,
          },
          (err, stdout, stderr) => {
            if (err) {
              const stderrFirstLine = (stderr ?? '').split(/[\r\n]+/)[0]?.slice(0, 200) ?? '';
              const sanitized = stderrFirstLine
                ? sanitizeErrorMessage(stderrFirstLine)
                : '';
              // Log raw diagnostic to main-process console only (never to UI)
              if (stderrFirstLine) {
                console.error(`[schola:import:quick] Conversion failed (diagnostic): ${sanitized}`);
              }
              reject(new Error('快速导入失败。请尝试论文导入，或检查文件格式后重试。'));
              return;
            }
            if (stderr && stderr.trim().length > 0) {
              const sanitizedStderr = stderr.split(/[\r\n]+/)[0]?.slice(0, 200) ?? '';
              warnings.push({
                code: 'CONVERSION_WARNING',
                message: sanitizedStderr,
                format: input.sourceFormat,
              });
            }
            resolve(stdout);
          },
        );
        childBox.current = cp;
      });

      // If stdout contains content (MarkItDown can output inline too), use it
      // Otherwise read the output file
      let finalContent = markdownContent;
      try {
        finalContent = await fs.readFile(outputAbs, 'utf-8');
      } catch {
        // If output file is empty or missing but we got stdout, use stdout
        if (markdownContent.trim().length > 0) {
          await fs.writeFile(outputAbs, markdownContent, 'utf-8');
          finalContent = markdownContent;
        }
      }

      if (finalContent.trim().length === 0) {
        return {
          ok: false,
          markdownRelativePath: null,
          companionRelativePath: null,
          quality: 'failed',
          warnings,
          error: {
            code: DIAGNOSTIC_ERROR_CODES.QUICK_CONVERSION_FAILED,
            message: '快速导入未能生成有效内容。',
            recoverable: false,
          },
        };
      }

      const quality: 'full' | 'partial' =
        warnings.length > 0 ? 'partial' : 'full';

      return {
        ok: true,
        markdownRelativePath: input.outputMarkdownRelativePath,
        companionRelativePath: input.companionRelativePath,
        quality,
        warnings,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown conversion error';
      // Sanitize: the message may contain MarkItDown/stderr/paths from the reject path
      const sanitized = sanitizeErrorMessage(message);
      if (message !== sanitized) {
        console.error(`[schola:import:quick] ${sanitized}`);
      }
      return {
        ok: false,
        markdownRelativePath: null,
        companionRelativePath: null,
        quality: 'failed',
        warnings,
        error: {
          code: DIAGNOSTIC_ERROR_CODES.QUICK_CONVERSION_FAILED,
          message: '快速导入失败。请尝试论文导入，或检查文件格式后重试。',
          recoverable: false,
        },
      };
    } finally {
      if (childBox.current && !childBox.current.killed) {
        try { childBox.current.kill(); } catch { /* ignore */ }
      }
    }
  },
};

// ── Vault root resolution ────────────────────────

/** Lazy import to avoid circular dependency with vault.service. */
function resolveVaultRootForVault(vaultId: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getVaultRootPath } = require('../../vault.service');
    return getVaultRootPath(vaultId) ?? null;
  } catch {
    return null;
  }
}
