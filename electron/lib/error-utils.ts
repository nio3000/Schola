/**
 * Shared IPC error handling utilities — Phase 4-0-B-IMP-2.
 *
 * Extracted from redundant error-handling patterns across IPC handler files
 * (audit DUP-03, DUP-04).  Provides consistent error sanitization and
 * IPC error response formatting.
 *
 * ⚠️  Main-process-internal only.  Never exposed to renderer.
 */

/**
 * Sanitize an error for IPC response.
 * Truncates to 200 characters and strips newlines.
 */
export function sanitizeIpcError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 200).replace(/[\n\r\t]/g, ' ');
}

/**
 * Create a standard IPC error response body.
 * Handles the INVALID_INPUT pattern automatically.
 */
export function ipcErrorBody(
  err: unknown,
  defaultCode: string,
): { code: string; message: string } {
  const msg = sanitizeIpcError(err);

  // INVALID_INPUT errors from assert* guards carry their own code
  if (msg.startsWith('INVALID_INPUT')) {
    return { code: 'INVALID_INPUT', message: msg };
  }

  return { code: defaultCode, message: msg };
}
