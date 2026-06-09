/**
 * Export contract types — Phase 3-1-A.
 *
 * Defines the IExportEngine interface, supported target formats,
 * engine identifiers, PandocOptions, and the safe export input/output.
 *
 * ⚠️  ALL path fields use *RelativePath naming (E-2 C3 / E-3 C2 frozen).
 *     System absolute paths are never stored in metadata or job status.
 */

// ── Capabilities ────────────────────────────────

export type ExportEngineCapability =
  | 'pdf-output'
  | 'html-output'
  | 'template-support'
  | 'math-rendering'
  | 'cross-reference';

// ── Formats ────────────────────────────────────

export type ExportFormat = 'docx' | 'pdf' | 'latex' | 'html';

// ── Engines ─────────────────────────────────────

/**
 * Phase 2 / Phase 3-1: only 'pandoc' is the enabled default engine.
 * Reserved engines exist in the type system only.
 */
export type ExportEngine =
  | 'pandoc'
  | 'weasyprint_reserved'
  | 'typst_reserved'
  | 'princexml_reserved';

// ── Engine Interface ───────────────────────────

export interface IExportEngine {
  readonly id: ExportEngine;
  readonly displayName: string;
  readonly version: string;
  readonly supportedFormats: readonly ExportFormat[];
  readonly capabilities: readonly ExportEngineCapability[];

  /**
   * Convert a vault Markdown file to the requested target format.
   *
   * Method name `convert` mirrors IImportEngine.convert for symmetry
   * (E-2 frozen; E-4 review C3 confirmed).
   */
  convert(input: ExportEngineInput): Promise<ExportEngineResult>;
}

// ── Input ───────────────────────────────────────

export interface ExportEngineInput {
  readonly vaultId: string;
  readonly jobId: string;
  readonly sourceFormat: 'markdown';

  /** Target export format. */
  readonly targetFormat: ExportFormat;

  /** Vault-relative path to the source Markdown file. */
  readonly markdownRelativePath: string;

  /** Vault-relative path where the export artifact is written (inside _exports/). */
  readonly outputRelativePath: string;

  /** Vault-relative path for the export metadata JSON. */
  readonly metadataRelativePath: string;

  /** Pandoc controlled options (whitelist-mapped by the engine). */
  readonly pandocOptions: PandocOptions;
}

// ── Pandoc Options (whitelist-only — E-2 C2 frozen) ──

export interface PandocOptions {
  readonly standalone: boolean;

  /** Template file name inside .schola/export/templates/ (path-validated). */
  readonly templateId: string | null;

  /** Bibliography file name inside .schola/export/bibliography/ (path-validated). */
  readonly bibliographyId: string | null;

  /** CSL style file name inside .schola/export/csl/ (path-validated). */
  readonly cslStyleId: string | null;

  /**
   * Vault-internal resource search paths.
   *
   * Security requirements (E-2 C2 frozen):
   * 1. Vault-relative paths only.
   * 2. Absolute paths forbidden.
   * 3. `../` escapes forbidden.
   * 4. Paths outside the vault root forbidden.
   * 5. Phase 3-1-C must validate each path via resolveVaultPath()
   *    before mapping to Pandoc --resource-path.
   */
  readonly resourcePaths?: readonly string[];

  /**
   * Whitelisted Pandoc metadata keys.
   *
   * Only `title`, `author`, `date`, and `lang` are permitted.
   * Arbitrary keys are rejected by the parameter constructor.
   */
  readonly metadata?: {
    readonly title?: string;
    readonly author?: string;
    readonly date?: string;
    readonly lang?: string;
  };

  // ⚠️  The following are INTENTIONALLY ABSENT (E-2 blacklist):
  //     rawArgs, filters, luaFilters, shellEscape, pdfEngine,
  //     dataDir, variables, includeInHeader, includeBeforeBody,
  //     includeAfterBody
}

// ── Output ──────────────────────────────────────

export interface ExportEngineResult {
  readonly ok: boolean;

  /** Vault-relative path to the export artifact (null on failure). */
  readonly outputRelativePath: string | null;

  /** Vault-relative path to the export metadata JSON (null on failure). */
  readonly metadataRelativePath: string | null;

  readonly outputSizeBytes: number;
  readonly warnings: readonly ExportWarningEntry[];
  readonly error: ExportErrorEntry | null;
}

// ── Warning / Error (lightweight) ───────────────

export interface ExportWarningEntry {
  readonly code: string;
  readonly message: string;
  readonly format: ExportFormat;
}

export interface ExportErrorEntry {
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
}
