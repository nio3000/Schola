/**
 * Import companion JSON metadata — Phase 3-1-A.
 *
 * Stored at .schola/metadata/imports/import_xxx.json after a successful
 * (or partial) import.  Companion JSON lives outside the user note space.
 *
 * ⚠️  MUST NOT contain external sourcePath (E-1 C1 frozen).
 *     All path fields are vault-relative.
 */

import type { ImportEngine, ImportSourceFormat, ImportMode } from './import.types';

export interface ImportCompanion {
  readonly schemaVersion: 1;
  readonly companionId: string;
  readonly vaultId: string;
  readonly jobId: string;

  /** Vault-relative path to the generated Markdown. */
  readonly markdownRelativePath: string;

  /** Vault-relative path to the attachment copy. */
  readonly attachmentRelativePath: string;

  readonly sourceFormat: ImportSourceFormat;

  /** Safe display name (no path). */
  readonly sourceFileName: string;

  /** SHA-256 of the copied source file. */
  readonly sourceFileHash: string;

  readonly engine: ImportEngine;
  readonly engineVersion: string | null;

  /** Conversion quality. */
  readonly quality: 'full' | 'partial' | 'failed';

  readonly warnings: readonly {
    readonly code: string;
    readonly message: string;
    readonly format: ImportSourceFormat;
  }[];

  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly recoverable: boolean;
  } | null;

  readonly createdAt: string; // ISO 8601

  // ── Phase 3-4-B optional extensions ─────────────
  // ALL fields below are optional for backward compatibility.
  // Existing MarkItDown companions (Phase 3-1) omit these fields.

  /** Import mode used for this job.  Omitted for Phase 3-1 quick imports. */
  readonly importMode?: ImportMode;

  /** Total page count of the source document (precision/OCR modes). */
  readonly pageCount?: number;

  /** Extracted figures with captions and asset paths. */
  readonly figures?: readonly FigureEntry[];

  /** Extracted tables (Markdown or image fallback). */
  readonly tables?: readonly TableEntry[];

  /** Extracted equations (LaTeX or image fallback). */
  readonly equations?: readonly EquationEntry[];

  /** Per-dimension confidence summary. */
  readonly confidence?: ConfidenceSummary;

  /** Reading-order warnings for sections that may need manual review. */
  readonly readingOrderWarnings?: readonly string[];

  // ── Phase 3-4-H2 paper_quality optional extensions ──
  // ALL fields below are optional for backward compatibility.
  // Omitted for quick / precision / ocr companions.

  /** Document source type. 'paper_pdf' for paper_quality mode. */
  readonly sourceType?: 'paper_pdf';

  /** Vault-relative path to the original PDF copy. */
  readonly originalFileRef?: string;

  /** Vault-relative path to the assets directory for this job. */
  readonly assetsDir?: string;

  /** Summary of extracted/converted assets. */
  readonly assetSummary?: AssetSummary;

  /** Quality assessment report for paper_quality mode. */
  readonly qualityReport?: QualityReport;

  /** Preview availability metadata. */
  readonly preview?: PreviewMeta;

  // ⚠️  sourcePath intentionally absent (E-1 C1 frozen).
  //     The external source path is consumed by the main-process
  //     authorization / copy stage and never persisted.
}

// ── Phase 3-4-B sub-types ────────────────────────

export interface FigureEntry {
  readonly id: string;
  readonly page: number;
  readonly caption: string | null;
  /** Vault-relative path to the extracted figure asset. */
  readonly assetRelativePath: string;
  readonly confidence: 'high' | 'medium' | 'low';
}

export interface TableEntry {
  readonly id: string;
  readonly page: number;
  /** Inline Markdown table text, or null if image-only fallback. */
  readonly markdownRef: string | null;
  /** Vault-relative path to table image (fallback). */
  readonly imageRelativePath: string | null;
  readonly confidence: 'high' | 'medium' | 'low';
}

export interface EquationEntry {
  readonly id: string;
  readonly page: number;
  /** LaTeX source, or null if image-only fallback. */
  readonly latex: string | null;
  /** Vault-relative path to equation image (fallback). */
  readonly imageRelativePath: string | null;
  readonly confidence: 'high' | 'medium' | 'low';
}

export interface ConfidenceSummary {
  readonly text: 'high' | 'medium' | 'low';
  readonly equations: 'high' | 'medium' | 'low';
  readonly tables: 'high' | 'medium' | 'low';
  readonly figures: 'high' | 'medium' | 'low';
  readonly references: 'high' | 'medium' | 'low';
}

// ── Phase 3-4-H2 paper_quality sub-types ──────────

export interface AssetSummary {
  readonly figures: number;
  readonly tables: number;
  readonly formulaImages: number;
  readonly pageSnapshots: number;
}

export interface QualityReport {
  readonly textExtracted: boolean;
  readonly figuresPreserved: 'yes' | 'partial' | 'no' | 'unknown';
  readonly tablesPreserved: 'yes' | 'partial' | 'no' | 'unknown';
  readonly formulasPreserved: 'image' | 'text' | 'partial' | 'no' | 'unknown' | 'placeholder';
  readonly warnings: readonly string[];
}

export interface PreviewMeta {
  readonly available: boolean;
  readonly markdownPreviewPath?: string;
}
