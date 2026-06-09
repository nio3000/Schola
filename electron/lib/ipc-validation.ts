/**
 * Shared IPC input validation guards — Phase 4-0-B-IMP-2.
 *
 * Extracted from redundant definitions across IPC handler files
 * (audit DUP-01, DUP-02).  All IPC handlers should use these
 * instead of defining their own assert* functions.
 *
 * ⚠️  Main-process-internal only.  Never exposed to renderer.
 */

/**
 * Assert a non-empty string value for vault ID.
 * Throws with INVALID_INPUT prefix for consistent IPC error handling.
 */
export function assertVaultId(input: unknown): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error('INVALID_INPUT: vaultId must be a non-empty string.');
  }
  return input;
}

/**
 * Assert a non-empty string with a custom label.
 */
export function assertString(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error(`INVALID_INPUT: ${label} must be a non-empty string.`);
  }
  return input;
}

/**
 * Assert a non-empty string suitable for job IDs.
 */
export function assertJobId(input: unknown): string {
  return assertString(input, 'jobId');
}

/**
 * Assert a non-empty vault-relative path.
 */
export function assertRelativePath(input: unknown): string {
  return assertString(input, 'relativePath');
}

/**
 * Assert a boolean value.
 */
export function assertBoolean(val: unknown, name: string): boolean {
  if (typeof val !== 'boolean') {
    throw new Error(`INVALID_INPUT: ${name} must be a boolean`);
  }
  return val;
}

/**
 * Assert a valid number.
 */
export function assertNumber(val: unknown, name: string): number {
  if (typeof val !== 'number' || isNaN(val)) {
    throw new Error(`INVALID_INPUT: ${name} must be a number`);
  }
  return val;
}
