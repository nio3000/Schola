/**
 * Import error codes — Phase 3-1-A.
 *
 * Exhaustive error code union used by ImportJobError and ImportErrorEntry.
 * All codes are semantic — no system paths or stack traces are exposed.
 */

export type ImportErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'MIME_MISMATCH'
  | 'FILE_TOO_LARGE'
  | 'SOURCE_NOT_FOUND'
  | 'COPY_FAILED'
  | 'ENGINE_NOT_AVAILABLE'
  | 'CONVERSION_FAILED'
  | 'WRITE_MARKDOWN_FAILED'
  | 'WRITE_COMPANION_FAILED'
  | 'CANCELLED'
  | 'INTERNAL_ERROR'
  // Phase 3-4-K reserved — enabled in Phase 3-4-L Marker model preflight.
  | 'RUNTIME_NEEDS_SETUP';
