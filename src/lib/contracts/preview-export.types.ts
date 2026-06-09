/**
 * Preview export IPC contract types — Phase 4-0-P0-UI-EXPORT.
 *
 * Fixed-function IPC for exporting sanitized Markdown preview as HTML or PDF.
 * renderer sends sanitized HTML + theme CSS; main handles save dialog + file write.
 *
 * Security invariants:
 * 1. Input contains ONLY sanitized HTML and theme CSS (no scripts, no remote URLs).
 * 2. Output path is chosen by the user via save dialog — renderer never specifies it.
 * 3. No generic command execution; no shell access.
 * 4. Error messages use safe Chinese text — no paths, no traceback.
 */

export interface PreviewExportInput {
  /** Suggested file name (no path, no extension). */
  readonly fileName: string;
  /** Current preview theme name (from whitelist). */
  readonly themeName: string;
  /** DOMPurify-sanitized preview HTML. */
  readonly sanitizedHtml: string;
  /** Current theme CSS (extracted from registered themes). */
  readonly themeCss: string;
}

export type PreviewExportResult =
  | { readonly ok: true; readonly relativePath?: string }
  | { readonly ok: false; readonly error: string };

/** Renderer-side API surface exposed by preload. */
export interface ScholaPreviewExportApi {
  readonly exportHtml: (input: PreviewExportInput) => Promise<PreviewExportResult>;
  readonly exportPdf: (input: PreviewExportInput) => Promise<PreviewExportResult>;
}
