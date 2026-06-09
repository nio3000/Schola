/**
 * Performance timing utility (main process).
 *
 * All timing is relative to `PROCESS_START_AT`, which is captured at
 * module evaluation time.  Output is gated by `SCHOLA_PERF_LOG=1`.
 */

/** Wall-clock timestamp captured when the main process starts. */
export const PROCESS_START_AT = Date.now();

/**
 * Emit a performance-log message to stdout.
 *
 * No-op unless the `SCHOLA_PERF_LOG` environment variable is set to `'1'`.
 */
export function perfLog(message: string): void {
  if (process.env.SCHOLA_PERF_LOG === '1') {
    console.log(message);
  }
}
