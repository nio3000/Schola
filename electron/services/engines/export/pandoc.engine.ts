/**
 * Pandoc default export engine — Phase 3-1-C.
 *
 * Implements IExportEngine for Pandoc.  Converts vault Markdown files
 * to DOCX / HTML / LaTeX / PDF via the `pandoc` CLI.
 *
 * ⚠️  Security invariants:
 *     1. Only processes vault-internal markdownRelativePath.
 *     2. System absolute paths are never stored in output.
 *     3. Uses child_process.execFile (no shell: true).
 *     4. Parameters are array-ised, never string-concatenated.
 *     5. All paths resolved via resolveVaultPath().
 *     6. Output strictly inside _exports/.
 *     7. Raw stderr never returned to caller.
 *     8. Timeout + kill on failure.
 */

import { execFile, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveVaultPath } from '../../../security/path-guard';
import {
  resolvePandocExe,
} from '../../runtime-check.service';
import type {
  IExportEngine,
  ExportEngine,
  ExportFormat,
  ExportEngineInput,
  ExportEngineResult,
  ExportWarningEntry,
} from '../../../../src/lib/contracts/export.types';
import {
  buildPandocArgs,
  validateResourcePaths,
} from './pandoc-args';

// ── Constants ────────────────────────────────────

const CONVERSION_TIMEOUT_MS = 120_000;
const SUPPORTED_FORMATS: readonly ExportFormat[] = ['docx', 'pdf', 'latex', 'html'];

// ── Engine ───────────────────────────────────────

export const pandocEngine: IExportEngine = {
  id: 'pandoc' as ExportEngine,
  displayName: 'Pandoc',
  version: '0.x',
  supportedFormats: SUPPORTED_FORMATS,
  capabilities: ['pdf-output', 'html-output', 'template-support', 'math-rendering', 'cross-reference'],

  async convert(input: ExportEngineInput): Promise<ExportEngineResult> {
    const rootPath = resolveVaultRootForVault(input.vaultId);
    if (!rootPath) {
      return failResult('INTERNAL_ERROR', 'Vault is not available for conversion.');
    }

    const sourceAbs = resolveVaultPath(rootPath, input.markdownRelativePath);
    const outputAbs = resolveVaultPath(rootPath, input.outputRelativePath);

    // Ensure _exports/ directory exists
    const outputDir = path.dirname(outputAbs);
    await fs.mkdir(outputDir, { recursive: true });

    // Check Pandoc availability
    const pandocExe = await resolvePandocExe();
    if (!pandocExe) {
      return failResult('PANDOC_NOT_AVAILABLE', 'Pandoc is not available. Please install it from https://pandoc.org/installing.html');
    }

    // Validate resourcePaths
    const resourcePathsErr = validateResourcePaths(rootPath, input.pandocOptions.resourcePaths);
    if (resourcePathsErr) {
      return failResult('RESOURCE_PATH_INVALID', resourcePathsErr);
    }

    // Build Pandoc args
    const args = buildPandocArgs(rootPath, {
      sourceAbs,
      outputAbs,
      targetFormat: input.targetFormat,
      options: input.pandocOptions,
    });

    const warnings: ExportWarningEntry[] = [];
    const childBox: { current: ChildProcess | null } = { current: null };

    try {
      await new Promise<void>((resolve, reject) => {
        const cp = execFile(
          pandocExe,
          args,
          { timeout: CONVERSION_TIMEOUT_MS, windowsHide: true },
          (err, _stdout, stderr) => {
            if (err) {
              const stderrFirstLine = (stderr ?? '').split(/[\r\n]+/)[0]?.slice(0, 200) ?? '';
              const message = stderrFirstLine
                ? `Pandoc conversion failed: ${stderrFirstLine}`
                : 'Pandoc conversion failed.';
              reject(new Error(message));
              return;
            }
            if (stderr && stderr.trim().length > 0) {
              warnings.push({
                code: 'CONVERSION_WARNING',
                message: stderr.split(/[\r\n]+/)[0]?.slice(0, 200) ?? '',
                format: input.targetFormat,
              });
            }
            resolve();
          },
        );
        childBox.current = cp;
      });

      // Verify output file exists and has content
      let outputSizeBytes = 0;
      try {
        const stat = await fs.stat(outputAbs);
        outputSizeBytes = stat.size;
      } catch {
        return failResult('WRITE_ARTIFACT_FAILED', 'Export artifact was not created.');
      }

      if (outputSizeBytes === 0) {
        return failResult('CONVERSION_FAILED', 'Pandoc produced an empty output file.');
      }

      return {
        ok: true,
        outputRelativePath: input.outputRelativePath,
        metadataRelativePath: input.metadataRelativePath,
        outputSizeBytes,
        warnings,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown conversion error';
      return failResult('CONVERSION_FAILED', message.slice(0, 500));
    } finally {
      if (childBox.current && !childBox.current.killed) {
        try { childBox.current.kill(); } catch { /* ignore */ }
      }
    }
  },
};

// ── Helpers ──────────────────────────────────────

function failResult(code: string, message: string): ExportEngineResult {
  return {
    ok: false,
    outputRelativePath: null,
    metadataRelativePath: null,
    outputSizeBytes: 0,
    warnings: [],
    error: { code, message: message.slice(0, 500), recoverable: false },
  };
}

function resolveVaultRootForVault(vaultId: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getVaultRootPath } = require('../../vault.service');
    return getVaultRootPath(vaultId) ?? null;
  } catch {
    return null;
  }
}
