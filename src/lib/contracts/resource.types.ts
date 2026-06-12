/**
 * Resource types — Phase 5-4A-IMP-1.
 *
 * Defines ResourceKind, ResourceViewerKind, ResourceEntry,
 * and ResourceMetadata for the multi-format resource layer.
 *
 * Security invariants:
 * 1. NO system absolute paths anywhere.
 * 2. ALL paths are vault-relative.
 * 3. NO binary content in type definitions.
 * 4. NO secret / API key fields.
 */

// ── Resource Kind ──────────────────────────────

/** Resource category based on file extension. */
export type ResourceKind =
  | 'markdown'
  | 'pdf'
  | 'html'
  | 'docx'
  | 'doc'
  | 'pptx'
  | 'xlsx'
  | 'xls'
  | 'csv'
  | 'txt'
  | 'image'
  | 'other';

// ── Resource Viewer Kind ────────────────────────

/** Viewer type for each resource kind. */
export type ResourceViewerKind =
  | 'markdown-editor'
  | 'pdf-viewer'
  | 'html-viewer'
  | 'image-viewer'
  | 'text-viewer'
  | 'metadata-viewer'
  | 'unsupported';

// ── Resource Entry ─────────────────────────────

/**
 * A resource entry in the vault file tree.
 * Extends the concept of FileEntry to non-Markdown files.
 *
 * ⚠️  Contains NO system absolute paths.
 *     All path fields are vault-relative.
 */
export interface ResourceEntry {
  readonly name: string;
  readonly relativePath: string;
  readonly isDirectory: boolean;
  readonly children?: readonly ResourceEntry[];

  /** Lowercase extension with dot, e.g. ".pdf". */
  readonly extension: string;
  readonly kind: ResourceKind;
  readonly viewerKind: ResourceViewerKind;
  /** File size in bytes. 0 for directories. */
  readonly size: number;
  /** Last modification time in ms since epoch. */
  readonly mtime: number;

  /** Optional file hash (deferred for large files). */
  readonly hash?: string;
  /** Import timestamp in ms since epoch. */
  readonly importedAt?: number;
  readonly source?: 'vault' | 'imported' | 'generated';
  /** Vault-relative path to the sidecar metadata JSON. */
  readonly metadataRelativePath?: string;
}

// ── Resource Metadata ───────────────────────────

/**
 * Sidecar metadata for a resource file.
 * Stored at .schola/metadata/resources/ as JSON.
 *
 * ⚠️  Contains NO system absolute paths.
 *     Does NOT contain file content.
 *     Does NOT contain secrets or API keys.
 */
export interface ResourceMetadata {
  readonly schemaVersion: 1;
  readonly resourceId: string;
  readonly vaultId: string;

  /** Vault-relative path to the resource file. */
  readonly resourceRelativePath: string;
  /** Vault-relative path to this metadata JSON itself. */
  readonly metadataRelativePath: string;

  readonly kind: ResourceKind;
  readonly originalName: string;
  readonly size: number;
  /** Import timestamp in ms since epoch. */
  readonly importedAt: number;
  readonly source: 'vault' | 'imported' | 'generated';

  /** Bibliographic metadata (optional, filled by extract pipeline later). */
  readonly title?: string;
  readonly authors?: readonly string[];
  readonly year?: string;
  readonly journal?: string;
  readonly doi?: string;
  readonly abstract?: string;
  readonly keywords?: readonly string[];
  /** If resource was imported as Markdown, the path to the generated note. */
  readonly notesRelativePath?: string;
}

// ── PDF Read IPC (Phase 5-4A-IMP-3) ─────────────

export interface ReadPdfResourceInput {
  readonly vaultId: string;
  /** Vault-relative path. Must end with .pdf. */
  readonly relativePath: string;
}

export interface ReadPdfResourceSuccess {
  readonly ok: true;
  /** PDF file bytes as ArrayBuffer. */
  readonly bytes: ArrayBuffer;
  readonly fileName: string;
  readonly size: number;
}

export interface ReadPdfResourceFailure {
  readonly ok: false;
  readonly error: string; // sanitized
}

export type ReadPdfResourceResult = ReadPdfResourceSuccess | ReadPdfResourceFailure;

/** Max PDF file size for in-memory read (50 MB). */
export const MAX_PDF_READ_SIZE = 50 * 1024 * 1024;

// ── HTML Read IPC (Phase 5-4A-IMP-4) ─────────────

export interface ReadHtmlResourceInput {
  readonly vaultId: string;
  /** Vault-relative path. Must end with .html or .htm. */
  readonly relativePath: string;
}

export interface ReadHtmlResourceSuccess {
  readonly ok: true;
  readonly html: string;
  readonly fileName: string;
  readonly size: number;
}

export interface ReadHtmlResourceFailure {
  readonly ok: false;
  readonly error: string;
}

export type ReadHtmlResourceResult = ReadHtmlResourceSuccess | ReadHtmlResourceFailure;

/** Max HTML file size for in-memory read (5 MB). */
export const MAX_HTML_READ_SIZE = 5 * 1024 * 1024;

// ── Resource Import IPC (Phase 5-4A-IMP-5) ──────

export interface ImportResourceInput {
  readonly vaultId: string;
}

export interface ImportResourceSuccess {
  readonly ok: true;
  readonly resourceRelativePath: string;
  readonly metadataRelativePath: string;
  readonly kind: ResourceKind;
  readonly originalName: string;
  readonly size: number;
}

export interface ImportResourceFailure {
  readonly ok: false;
  readonly error: string;
}

export type ImportResourceResult = ImportResourceSuccess | ImportResourceFailure;

// ── Text Preview IPC (Phase 5-4B-IMP-1) ──────────

export interface ReadTextPreviewInput {
  readonly vaultId: string;
  /** Vault-relative path. Must end with .txt or .csv. */
  readonly relativePath: string;
}

export interface ReadTextPreviewSuccess {
  readonly ok: true;
  readonly text: string;
  readonly fileName: string;
  readonly size: number;
  readonly kind: 'txt' | 'csv';
}

export interface ReadTextPreviewFailure {
  readonly ok: false;
  readonly error: string;
}

export type ReadTextPreviewResult = ReadTextPreviewSuccess | ReadTextPreviewFailure;

/** Max text/CSV file size for in-memory read (2 MB). */
export const MAX_TEXT_READ_SIZE = 2 * 1024 * 1024;

// ── DOCX Preview IPC (Phase 5-4B-IMP-2) ───────────

export interface DocxPreviewParagraph {
  readonly text: string;
  readonly style: 'heading1' | 'heading2' | 'heading3' | 'normal';
}

export interface ReadDocxPreviewInput {
  readonly vaultId: string;
  readonly relativePath: string;
}

export interface ReadDocxPreviewSuccess {
  readonly ok: true;
  readonly fileName: string;
  readonly relativePath: string;
  readonly size: number;
  readonly paragraphs: readonly DocxPreviewParagraph[];
  readonly truncated: boolean;
  readonly totalParagraphs: number;
}

export interface ReadDocxPreviewFailure {
  readonly ok: false;
  readonly error: string;
}

export type ReadDocxPreviewResult = ReadDocxPreviewSuccess | ReadDocxPreviewFailure;

/** Max DOCX file size (20 MB). */
export const MAX_DOCX_READ_SIZE = 20 * 1024 * 1024;

// ── XLSX Preview IPC (Phase 5-4B-IMP-2) ────────────

export interface ReadXlsxPreviewInput {
  readonly vaultId: string;
  readonly relativePath: string;
  readonly sheetIndex?: number;
}

export interface XlsxSheetPreview {
  readonly name: string;
  readonly rows: readonly (readonly string[])[];
  readonly totalRows: number;
  readonly totalColumns: number;
  readonly truncatedRows: boolean;
  readonly truncatedColumns: boolean;
}

export interface XlsxWorkbookPreview {
  readonly sheetNames: readonly string[];
  readonly activeSheetIndex: number;
  readonly activeSheet: XlsxSheetPreview;
}

export interface ReadXlsxPreviewSuccess {
  readonly ok: true;
  readonly fileName: string;
  readonly relativePath: string;
  readonly size: number;
  readonly workbook: XlsxWorkbookPreview;
}

export interface ReadXlsxPreviewFailure {
  readonly ok: false;
  readonly error: string;
}

export type ReadXlsxPreviewResult = ReadXlsxPreviewSuccess | ReadXlsxPreviewFailure;

/** Max XLSX file size (20 MB). */
export const MAX_XLSX_READ_SIZE = 20 * 1024 * 1024;

// ── XLS Preview IPC (Phase 5-4B-LEGACY) ───────────

export interface ReadXlsPreviewInput {
  readonly vaultId: string;
  readonly relativePath: string;
  readonly sheetIndex?: number;
}

export interface ReadXlsPreviewSuccess {
  readonly ok: true;
  readonly fileName: string;
  readonly relativePath: string;
  readonly workbook: {
    readonly sheetNames: readonly string[];
    readonly activeSheet: {
      readonly name: string;
      readonly rows: readonly (readonly string[])[];
      readonly totalRows: number;
      readonly totalColumns: number;
      readonly truncated: boolean;
    };
  };
}

export interface ReadXlsPreviewFailure {
  readonly ok: false;
  readonly error: string;
}

export type ReadXlsPreviewResult = ReadXlsPreviewSuccess | ReadXlsPreviewFailure;

// ── DOC Preview IPC (Phase 5-4B-DOC-CONTENT-IMP) ──

export interface ReadDocPreviewInput {
  readonly vaultId: string;
  readonly relativePath: string;
}

export interface ReadDocPreviewSuccess {
  readonly ok: true;
  readonly fileName: string;
  readonly relativePath: string;
  readonly text: string;
  readonly size: number;
  readonly truncated: boolean;
}

export interface ReadDocPreviewFailure {
  readonly ok: false;
  readonly error: string;
}

export type ReadDocPreviewResult = ReadDocPreviewSuccess | ReadDocPreviewFailure;
