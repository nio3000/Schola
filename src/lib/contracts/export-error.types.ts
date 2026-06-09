/**
 * Export error codes — Phase 3-1-A.
 *
 * Exhaustive error code union used by ExportJobError and ExportErrorEntry.
 * All codes are semantic — no system paths or stack traces are exposed.
 */

export type ExportErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_NOT_MARKDOWN'
  | 'ENGINE_NOT_AVAILABLE'
  | 'PANDOC_NOT_AVAILABLE'
  | 'LATEX_NOT_AVAILABLE'
  | 'INVALID_PANDOC_OPTIONS'
  | 'RESOURCE_PATH_INVALID'
  | 'CONVERSION_FAILED'
  | 'WRITE_ARTIFACT_FAILED'
  | 'INTERNAL_ERROR';
