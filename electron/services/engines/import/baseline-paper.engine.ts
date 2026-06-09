/**
 * Baseline paper import engine — Phase 3-4-Lite-B.
 *
 * Built-in lightweight PDF text extraction using pdfjs-dist (Apache 2.0).
 * No Python, no external runtime, no model download, no network, no child_process.
 *
 * Provides honest baseline quality: text extraction only.
 * Complex layout, formulas, tables, figures are NOT preserved.
 * Users are directed to the original PDF for verification.
 *
 * ⚠️  Security invariants:
 *     1. Only processes vault-internal attachmentRelativePath.
 *     2. sourcePath is NEVER part of EngineConvertInput.
 *     3. Pure JavaScript — no child_process, no shell.
 *     4. No network access — PDF read from local buffer only.
 *     5. Input/output paths resolved via resolveVaultPath().
 *     6. Raw pdfjs-dist internal errors are never returned to the caller.
 *     7. All engine outputs use vault-relative paths only.
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { resolveVaultPath } from '../../../security/path-guard';
import { getVaultRootPath } from '../../vault.service';
import type {
  IImportEngine,
  ImportEngine,
  ImportSourceFormat,
  EngineConvertInput,
  EngineConvertResult,
  ImportWarningEntry,
} from '../../../../src/lib/contracts/import.types';

// ── Constants ────────────────────────────────────

const SUPPORTED_FORMATS: readonly ImportSourceFormat[] = ['pdf'];

const MAX_FILE_SIZE_BYTES: Partial<Record<ImportSourceFormat, number>> = {
  pdf: 50 * 1024 * 1024, // 50 MB
};

const ENGINE_VERSION = '1.0.0';

/** Safety limit: refuse to process PDFs with more pages than this. */
const MAX_PAGES = 2000;

/**
 * Path segments from this file to the pdfjs-dist worker.
 * This file is at: dist-electron/electron/services/engines/import/baseline-paper.engine.js
 * pdfjs-dist is at: node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs
 *
 * Phase 4-0-P0: extraResources places worker at resources/pdfjs-worker/ in packaged app.
 */
function resolveWorkerUrl(): string {
  // Priority 0 (packaged): extraResources → resources/pdfjs-worker/
  const packagedCandidate = path.join(process.resourcesPath, 'pdfjs-worker', 'pdf.worker.min.mjs');
  if (existsSync(packagedCandidate)) {
    return 'file://' + packagedCandidate.replace(/\\/g, '/');
  }
  // Priority 1 (dev): walk up from __dirname to project root node_modules
  const devCandidates = [
    path.resolve(__dirname, '..', '..', '..', '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs'),
    path.resolve(__dirname, '..', '..', '..', '..', '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs'),
  ];
  for (const candidate of devCandidates) {
    if (existsSync(candidate)) {
      return 'file://' + candidate.replace(/\\/g, '/');
    }
  }
  // Fallback: return first dev candidate (pdfjs-dist will fail with a clear error if missing)
  return 'file://' + devCandidates[0].replace(/\\/g, '/');
}

// ── Helpers ───────────────────────────────────────

function resolveVaultRootForVault(vaultId: string): string | null {
  return getVaultRootPath(vaultId);
}

function safeBaseName(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName));
  return base
    .replace(/[<>:"|?*\\/]/g, '_')
    .replace(/^\.+/, '_')
    .slice(0, 200)
    || 'imported';
}

/** Error messages that are safe to return to the caller — no paths, no traceback. */
function safeError(code: string, message: string): NonNullable<EngineConvertResult['error']> {
  return { code, message, recoverable: false };
}

// ── Engine ───────────────────────────────────────

export const baselinePaperEngine: IImportEngine = {
  id: 'baseline_paper' as ImportEngine,
  displayName: '内置论文导入',
  version: ENGINE_VERSION,
  supportedFormats: SUPPORTED_FORMATS,
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,

  async convert(input: EngineConvertInput): Promise<EngineConvertResult> {
    const warnings: ImportWarningEntry[] = [];

    // Step 1: Validate source format
    if (input.sourceFormat !== 'pdf') {
      return {
        ok: false,
        markdownRelativePath: null,
        companionRelativePath: null,
        quality: 'failed',
        warnings: [],
        error: safeError('UNSUPPORTED_FORMAT', '论文导入仅支持 PDF 格式。'),
      };
    }

    // Step 2: Resolve vault paths
    const rootPath = resolveVaultRootForVault(input.vaultId);
    if (!rootPath) {
      return {
        ok: false,
        markdownRelativePath: null,
        companionRelativePath: null,
        quality: 'failed',
        warnings: [],
        error: safeError('VAULT_NOT_AVAILABLE', '知识库不可用。'),
      };
    }

    const attachmentAbs = resolveVaultPath(rootPath, input.attachmentRelativePath);
    const outputAbs = resolveVaultPath(rootPath, input.outputMarkdownRelativePath);

    // Ensure output directory exists
    const outputDir = path.dirname(outputAbs);
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch {
      return {
        ok: false,
        markdownRelativePath: null,
        companionRelativePath: null,
        quality: 'failed',
        warnings: [],
        error: safeError('INTERNAL_ERROR', '无法创建输出目录。'),
      };
    }

    // Step 3: Check file size
    let fileSize: number;
    try {
      const stat = await fs.stat(attachmentAbs);
      fileSize = stat.size;
      if (fileSize > (MAX_FILE_SIZE_BYTES.pdf ?? 50 * 1024 * 1024)) {
        return {
          ok: false,
          markdownRelativePath: null,
          companionRelativePath: null,
          quality: 'failed',
          warnings: [],
          error: safeError('FILE_TOO_LARGE', 'PDF 文件过大，请选择小于 50MB 的文件。'),
        };
      }
      if (fileSize === 0) {
        return {
          ok: false,
          markdownRelativePath: null,
          companionRelativePath: null,
          quality: 'failed',
          warnings: [],
          error: safeError('EMPTY_FILE', 'PDF 文件为空。'),
        };
      }
    } catch {
      return {
        ok: false,
        markdownRelativePath: null,
        companionRelativePath: null,
        quality: 'failed',
        warnings: [],
        error: safeError('FILE_NOT_FOUND', 'PDF 文件不可读。'),
      };
    }

    // Step 4: Read PDF buffer (vault-internal only)
    let pdfData: Uint8Array;
    try {
      const buf = await fs.readFile(attachmentAbs);
      pdfData = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
      return {
        ok: false,
        markdownRelativePath: null,
        companionRelativePath: null,
        quality: 'failed',
        warnings: [],
        error: safeError('FILE_READ_ERROR', '无法读取 PDF 文件。'),
      };
    }

    // Step 5: Load pdfjs-dist (dynamic import — ESM in CJS project)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pdfjsLib: Record<string, any>;
    try {
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } catch {
      return {
        ok: false,
        markdownRelativePath: null,
        companionRelativePath: null,
        quality: 'failed',
        warnings: [],
        error: safeError('ENGINE_NOT_AVAILABLE', '论文导入引擎初始化失败。'),
      };
    }

    // Configure worker
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = resolveWorkerUrl();
    } catch {
      // Worker path resolution failed — try with default
      // pdfjs-dist will attempt default resolution, may or may not work
    }

    // Step 6: Parse PDF and extract text
    try {
      const doc = await pdfjsLib.getDocument({
        data: pdfData,
        disableFontFace: true,
        useSystemFonts: false,
      }).promise;

      const pageCount = doc.numPages;

      // Safety: refuse extremely large PDFs
      if (pageCount > MAX_PAGES) {
        return {
          ok: false,
          markdownRelativePath: null,
          companionRelativePath: null,
          quality: 'failed',
          warnings: [],
          error: safeError('FILE_TOO_LARGE', `PDF 页数过多（${pageCount} 页），基础导入最多支持 ${MAX_PAGES} 页。`),
        };
      }

      // Page count warning for large documents
      if (pageCount > 200) {
        warnings.push({
          code: 'LARGE_DOCUMENT',
          message: `PDF 共有 ${pageCount} 页，基础导入可能稍慢。复杂内容请结合原 PDF 核对。`,
          format: 'pdf',
        });
      }

      // Extract text from each page
      const pages: string[] = [];
      let emptyPageCount = 0;

      for (let i = 1; i <= pageCount; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();

        interface PdfJsTextItem { str: string }
        const pageText = (textContent.items as PdfJsTextItem[])
          .map((item) => item.str ?? '')
          .join(' ')
          .trim();

        if (pageText.length === 0) {
          emptyPageCount += 1;
        }

        // Add page marker and text
        pages.push(`<!-- page ${i} -->\n\n${pageText}`);
      }

      const markdownBody = pages.join('\n\n');

      // Build Markdown with header
      const safeName = safeBaseName(path.basename(input.attachmentRelativePath));
      const markdownContent = `# ${safeName}\n\n> 当前为基础论文导入结果。复杂排版、公式、表格和图片内容可能需要结合原 PDF 核对。\n\n${markdownBody}\n`;

      // Check if any text was extracted
      const markdownBytes = Buffer.byteLength(markdownBody, 'utf-8');

      if (markdownBytes === 0 || emptyPageCount === pageCount) {
        // No text extracted at all — likely a scanned/image PDF
        return {
          ok: true,
          markdownRelativePath: input.outputMarkdownRelativePath,
          companionRelativePath: input.companionRelativePath,
          quality: 'partial',
          warnings: [
            ...warnings,
            {
              code: 'NO_TEXT_EXTRACTED',
              message: '未能从该 PDF 中提取文本内容。可能是扫描件或纯图片 PDF。建议对照原 PDF 查看。',
              format: 'pdf',
            },
          ],
          error: null,
        };
      }

      // Write Markdown to output path
      await fs.writeFile(outputAbs, markdownContent, 'utf-8');

      return {
        ok: true,
        markdownRelativePath: input.outputMarkdownRelativePath,
        companionRelativePath: input.companionRelativePath,
        quality: 'partial', // baseline is always partial — honest about limitations
        warnings,
        error: null,
      };
    } catch (err: unknown) {
      // Safe error message — no paths, no traceback, no stderr
      const message = err instanceof Error ? err.message : 'Unknown error';

      // Detect common error patterns
      if (message.includes('Password') || message.includes('encrypted') || message.includes('BadPasswordException')) {
        return {
          ok: false,
          markdownRelativePath: null,
          companionRelativePath: null,
          quality: 'failed',
          warnings,
          error: safeError('ENCRYPTED_PDF', 'PDF 文件已加密，无法导入。请先解密后再尝试。'),
        };
      }

      if (message.includes('InvalidPDFException') || message.includes('Invalid') && message.includes('PDF')) {
        return {
          ok: false,
          markdownRelativePath: null,
          companionRelativePath: null,
          quality: 'failed',
          warnings,
          error: safeError('INVALID_PDF', 'PDF 文件无效或已损坏。'),
        };
      }

      // Generic safe error
      console.error(`[schola:import:baseline_paper] Conversion error: ${message.slice(0, 200)}`);
      return {
        ok: false,
        markdownRelativePath: null,
        companionRelativePath: null,
        quality: 'failed',
        warnings,
        error: safeError('CONVERSION_FAILED', '论文导入失败。请尝试快速导入或检查 PDF 文件后重试。'),
      };
    }
  },
};
