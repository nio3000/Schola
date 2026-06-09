/**
 * Import / Export IPC channel constants — Phase 3-1-A.
 *
 * Defines ONLY the allowed fixed-function IPC channels.
 *
 * ⚠️  Banned channels are INTENTIONALLY ABSENT from this file:
 *     import:run-python, import:list-engines, import:set-engine,
 *     export:run-pandoc, export:set-pandoc-args, export:list-engines,
 *     export:set-engine, export:select-format, export:open-output-external,
 *     shell:show-item, and any generic open / reveal / run / shell channels.
 *
 * These channels are never registered as IPC handlers in Phase 3-1.
 */

// ── Import IPC ──────────────────────────────────

/** Trigger the OS file-open dialog and return a source selection token. */
export const IMPORT_SELECT_SOURCE_CHANNEL = 'import:select-source';

/** Create a new import job from the selected source. */
export const IMPORT_CREATE_JOB_CHANNEL = 'import:create-job';

/** Poll the status of an active import job. */
export const IMPORT_GET_JOB_STATUS_CHANNEL = 'import:get-job-status';

/** List all import jobs (active and recent) for the current vault. */
export const IMPORT_LIST_JOBS_CHANNEL = 'import:list-jobs';

/** Cancel an active import job. */
export const IMPORT_CANCEL_JOB_CHANNEL = 'import:cancel-job';

/** Query which import modes are available (Phase 3-4-D). */
export const IMPORT_GET_AVAILABLE_MODES_CHANNEL = 'import:get-available-modes';

/** Open the original imported PDF in the system default application (Phase 3-4-H3). */
export const IMPORT_OPEN_ORIGINAL_FILE_CHANNEL = 'import:open-original-file';

/** Reveal the original imported PDF in the OS file manager (Phase 3-4-H3). */
export const IMPORT_REVEAL_ORIGINAL_FILE_CHANNEL = 'import:reveal-original-file';

// ── Export IPC ──────────────────────────────────

/** Create a new export job for a Markdown file. */
export const EXPORT_CREATE_JOB_CHANNEL = 'export:create-job';

/** Poll the status of an active export job. */
export const EXPORT_GET_JOB_STATUS_CHANNEL = 'export:get-job-status';

/** List all export jobs (active and recent) for the current vault. */
export const EXPORT_LIST_JOBS_CHANNEL = 'export:list-jobs';

/** Cancel an active export job. */
export const EXPORT_CANCEL_JOB_CHANNEL = 'export:cancel-job';

// ── Preview Export IPC (Phase 4-0-P0-UI-EXPORT) ──

/** Export current preview as self-contained HTML file. */
export const PREVIEW_EXPORT_HTML_CHANNEL = 'preview:export-html';

/** Export current preview as PDF via printToPDF. */
export const PREVIEW_EXPORT_PDF_CHANNEL = 'preview:export-pdf';
