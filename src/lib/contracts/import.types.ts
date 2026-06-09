/**
 * Import contract types — Phase 3-1-A.
 *
 * Defines the IImportEngine interface, supported source formats,
 * engine identifiers, and the safe convert input/output types.
 *
 * ⚠️ EngineConvertInput MUST NOT contain sourcePath (E-1 C1 frozen).
 *    Adapter only processes vault-internal attachmentRelativePath.
 */

// ── Formats ────────────────────────────────────

export type ImportSourceFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'html';

// ── Engines ─────────────────────────────────────

/**
 * Phase 2 / Phase 3-1 / Phase 3-4-I / Phase 3-4-Lite:
 * 'markitdown' (quick), 'baseline_paper' (paper_quality, built-in), and
 * 'pymupdf4llm' (paper_enhanced, external) are the enabled Core engines.
 * Reserved engines exist in the type system only — they are never installed,
 * never called, never shown in UI, and never registered as IPC handlers.
 */
export type ImportEngine =
  | 'markitdown'
  | 'pymupdf4llm'
  | 'baseline_paper'
  | 'docling_reserved'
  | 'mineru_reserved'
  | 'marker_reserved'
  | 'dots_ocr_reserved';

// ── Capabilities ────────────────────────────────

export type ImportEngineCapability =
  | 'text-extraction'
  | 'table-extraction'
  | 'image-extraction'
  | 'heading-detection'
  | 'list-detection'
  | 'hyperlink-detection'
  | 'ocr'
  // Phase 3-4-B: layout / quality capabilities
  | 'layout-aware'
  | 'figure-extraction'
  | 'equation-extraction'
  | 'reference-extraction'
  | 'chinese-layout'
  | 'confidence-report';

// ── Import Mode (Phase 3-4-B) ──────────────────

/**
 * Import mode — Phase 3-4-B / Phase 3-4-H2 / Phase 3-4-K / Phase 3-4-Lite.
 *
 * quick:          Default fast import via MarkItDown (requires MarkItDown runtime).
 *                 Suitable for general docs (DOCX, PPTX, XLSX, HTML, simple PDF).
 * paper_quality:  Built-in lightweight paper import via BaselinePaperEngine.  PDF-only.
 *                 Always available — does NOT depend on external runtime installation.
 *                 Uses pdfjs-dist (Apache 2.0) for basic PDF text extraction.
 *                 Honest quality: figures/tables/formulas marked as 'unknown'.
 * paper_enhanced: High-fidelity paper import via external runtimes (PyMuPDF4LLM,
 *                 Marker, etc.).  PDF-only.  User-managed — NOT distributed by Schola.
 *                 Probe detects user-installed runtimes; availableModes reflects result.
 *                 Adapter / bridge / model preflight deferred to Phase 3-4-L / Phase 4-0+.
 * precision:      Layout-aware import for academic PDFs.  Reserved for docling_reserved.
 *                 NOT YET AVAILABLE — returns ENGINE_NOT_AVAILABLE.
 * ocr:            OCR import for scanned/image PDFs.  Requires ≥1 OCR engine.
 *                 NOT YET AVAILABLE — returns ENGINE_NOT_AVAILABLE.
 *
 * ⚠️  renderer selects mode only — never selects a specific engine.
 *     main process resolves mode → engine based on capability probe results.
 */
export type ImportMode = 'quick' | 'paper_quality' | 'paper_enhanced' | 'precision' | 'ocr';

/**
 * Product-level import mode — Phase 4-0-B.
 *
 * The only two import options shown in the UI.
 * 'quick'    — default, always available. Internal routing handles PDF vs non-PDF.
 * 'enhanced' — high-fidelity paper import. Currently unavailable (deferred to Marker/MinerU).
 *
 * ⚠️  UI consumes ProductImportMode only.
 *     Internal mapping to legacy ImportMode is handled by useImportJob / IPC layer.
 */
export type ProductImportMode = 'quick' | 'enhanced';

// ── Engine Interface ───────────────────────────

export interface IImportEngine {
  readonly id: ImportEngine;
  readonly displayName: string;
  readonly version: string;
  readonly supportedFormats: readonly ImportSourceFormat[];
  readonly maxFileSizeBytes: Partial<Record<ImportSourceFormat, number>>;

  /**
   * Convert a vault-internal attachment to Markdown.
   *
   * ⚠️  The input contains ONLY vault-relative paths.
   *     External sourcePath is consumed by the main-process
   *     authorization / copy stage and never reaches the adapter.
   */
  convert(input: EngineConvertInput): Promise<EngineConvertResult>;
}

// ── Input ───────────────────────────────────────

export interface EngineConvertInput {
  readonly vaultId: string;
  readonly jobId: string;

  /** Source format of the original file (PDF / DOCX / …). */
  readonly sourceFormat: ImportSourceFormat;

  /** Vault-relative path to the copied attachment (E-1 C1 frozen). */
  readonly attachmentRelativePath: string;

  /** Vault-relative path where the generated Markdown is written. */
  readonly outputMarkdownRelativePath: string;

  /** Vault-relative path for the import companion JSON metadata. */
  readonly companionRelativePath: string;

  // ⚠️  sourcePath intentionally absent — see E-1 C1 freeze.
}

// ── Output ──────────────────────────────────────

export interface EngineConvertResult {
  readonly ok: boolean;

  /** Vault-relative path to the generated Markdown (null on failure). */
  readonly markdownRelativePath: string | null;

  /** Vault-relative path to the companion JSON (null on failure). */
  readonly companionRelativePath: string | null;

  /** Conversion quality: full success, partial with warnings, or failed. */
  readonly quality: 'full' | 'partial' | 'failed';

  readonly warnings: readonly ImportWarningEntry[];
  readonly error: ImportErrorEntry | null;
}

// ── Warning / Error (lightweight — full types in import-error.types.ts) ──

export interface ImportWarningEntry {
  readonly code: string;
  readonly message: string;
  readonly format: ImportSourceFormat;
}

export interface ImportErrorEntry {
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
}
