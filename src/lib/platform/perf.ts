/**
 * Performance timing utility (renderer-side).
 *
 * Captures the renderer process start time at module evaluation so all
 * timing logs share a common baseline.  Actual log output is gated by
 * the main process via `window.schola.app.perfLog`, which checks the
 * `SCHOLA_PERF_LOG` environment variable.
 *
 * Module-level once-per-lifecycle guards prevent duplicate logs across
 * component remounts.  These flags live at module scope so React
 * re-renders and component re-mounts never reset them.
 */

/** Wall-clock timestamp captured when this module is first evaluated. */
export const RENDERER_START_AT = Date.now();

/**
 * Send a performance-log message to the main process.
 *
 * The main process will drop the message unless `SCHOLA_PERF_LOG=1`.
 * This function is a no-op when the preload API is unavailable.
 */
export function perfLog(message: string): void {
  try {
    window.schola?.app?.perfLog?.(message);
  } catch {
    // Silently ignore — perf logging must never disrupt the application.
  }
}

// ── Once-per-app-lifecycle log guards ──
// Module-level booleans persist across component remounts so each key
// milestone is logged exactly once per application start.

let _editorReadyLogged = false;
let _editorPreviewReadyLogged = false;

/**
 * Log `[perf:renderer] editorReady=...` exactly once per application
 * lifecycle, regardless of how many times EditorPanel is mounted.
 */
export function logEditorReadyOnce(): void {
  if (_editorReadyLogged) return;
  _editorReadyLogged = true;
  perfLog(`[perf:renderer] editorReady=${Date.now() - RENDERER_START_AT}ms`);
}

/**
 * Log `[perf:renderer] editorPreviewReady=...` exactly once per
 * application lifecycle.
 */
export function logEditorPreviewReadyOnce(): void {
  if (_editorPreviewReadyLogged) return;
  _editorPreviewReadyLogged = true;
  perfLog(`[perf:renderer] editorPreviewReady=${Date.now() - RENDERER_START_AT}ms`);
}
