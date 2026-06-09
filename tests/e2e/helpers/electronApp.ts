import { _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ScholaAppContext {
  readonly electronApp: ElectronApplication;
  readonly page: Page;
  /** Absolute path to the isolated userData directory. */
  readonly userDataDir: string;
  /** Captured console messages from the renderer (max 200). */
  readonly consoleLog: readonly string[];
  /** Captured page errors from the renderer. */
  readonly pageErrors: readonly string[];
  /** Captured stdout lines from the Electron main process. */
  readonly stdout: readonly string[];
  /** Captured stderr lines from the Electron main process. */
  readonly stderr: readonly string[];
  /** Electron process exit code (null while running). */
  readonly exitCode: number | null;
  /** Sequence number for this launch attempt (1 or 2). */
  readonly attempt: number;
  /** Lifecycle events captured from the Electron process & page. */
  readonly lifecycleEvents: readonly string[];

  /**
   * Close the Electron app and clean up the temporary userData
   * directory.  Safe to call multiple times.
   */
  close(): Promise<void>;
}

export interface LaunchScholaOptions {
  /**
   * Absolute path to a sample vault.  When set the env var
   * `SCHOLA_TEST_VAULT_PATH` is passed to Electron so that the
   * native file dialog is bypassed, and the helper clicks the
   * "打开" button automatically.
   */
  readonly vaultPath?: string;
  /**
   * After the vault is opened, wait up to this many ms for the
   * workspace sidebar to appear.  Default: 15_000.
   */
  readonly workspaceTimeout?: number;
}

// ─────────────────────────────────────────────
// Failure classification
// ─────────────────────────────────────────────

export type FailurePhase =
  | 'launch'
  | 'renderer-ready'
  | 'business-assertion'
  | 'cleanup';

export class ScholaE2eError extends Error {
  readonly phase: FailurePhase;
  readonly lifecycleEvents: readonly string[];

  constructor(
    phase: FailurePhase,
    message: string,
    lifecycleEvents: readonly string[] = [],
    options?: { cause?: unknown },
  ) {
    super(`[schola:e2e:${phase}] ${message}`, options);
    this.name = 'ScholaE2eError';
    this.phase = phase;
    this.lifecycleEvents = lifecycleEvents;
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const MAX_LOG_ENTRIES = 200;

let counter = 0;

function uniqueTempDir(): string {
  counter += 1;
  const ts = Date.now();
  return path.join(os.tmpdir(), `schola-e2e-${ts}-${counter}`);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function removeDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // Best-effort cleanup — the OS will eventually purge /tmp entries.
  }
}

function pushLog(arr: string[], entry: string): void {
  arr.push(entry);
  if (arr.length > MAX_LOG_ENTRIES) arr.shift();
}

function killElectronProcess(electronApp?: ElectronApplication): void {
  if (!electronApp) return;
  try {
    const proc = electronApp.process();
    if (proc && proc.exitCode === null) {
      proc.kill('SIGKILL');
    }
  } catch {
    // Process may already be gone.
  }
}

// ─────────────────────────────────────────────
// Launch (single attempt, no retry)
// ─────────────────────────────────────────────

interface LaunchAttemptResult {
  ctx: ScholaAppContext;
  lifecycleEvents: string[];
}

async function launchScholaAttempt(
  options: LaunchScholaOptions,
  attempt: number,
): Promise<LaunchAttemptResult> {
  const userDataDir = uniqueTempDir();
  ensureDir(userDataDir);

  const consoleLog: string[] = [];
  const pageErrors: string[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const lifecycleEvents: string[] = [];
  let exitCode: number | null = null;
  let closed = false;

  const recordLifecycle = (event: string): void => {
    lifecycleEvents.push(event);
    if (lifecycleEvents.length > 60) lifecycleEvents.shift();
  };

  recordLifecycle(`attempt-${attempt}:start`);

  // ── Phase 1: build env & launch Electron ──
  const rawEnv: Record<string, string | undefined> = {
    ...(process.env as Record<string, string | undefined>),
    SCHOLA_TEST_USER_DATA: userDataDir,
  };

  if (options.vaultPath) {
    rawEnv.SCHOLA_TEST_VAULT_PATH = options.vaultPath;
  }

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawEnv)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  let electronApp: ElectronApplication;
  try {
    electronApp = await electron.launch({
      args: ['dist-electron/electron/main.js'],
      env,
    });
  } catch (err) {
    recordLifecycle(`attempt-${attempt}:electron-launch-failed`);
    removeDir(userDataDir);
    throw new ScholaE2eError('launch', 'Electron process failed to start.', [...lifecycleEvents], { cause: err });
  }

  recordLifecycle(`attempt-${attempt}:electron-launched`);

  // ── Phase 2: collect main-process stdio immediately ──
  const proc = electronApp.process();
  if (proc) {
    proc.on('exit', (code) => {
      exitCode = code;
      recordLifecycle(`attempt-${attempt}:electron-exit(${code})`);
    });
    if (proc.stdout) {
      proc.stdout.on('data', (chunk: Buffer) => {
        chunk
          .toString('utf-8')
          .split('\n')
          .filter(Boolean)
          .forEach((line) => pushLog(stdout, line));
      });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        chunk
          .toString('utf-8')
          .split('\n')
          .filter(Boolean)
          .forEach((line) => pushLog(stderr, line));
      });
    }
  }

  // ── Phase 3: get first window ──
  let page: Page;
  try {
    page = await electronApp.firstWindow();
  } catch (err) {
    recordLifecycle(`attempt-${attempt}:firstWindow-failed`);
    killElectronProcess(electronApp);
    removeDir(userDataDir);
    throw new ScholaE2eError('launch', 'firstWindow() failed — Electron may not have created a window.', [...lifecycleEvents], { cause: err });
  }

  recordLifecycle(`attempt-${attempt}:firstWindow-ok`);

  // ── Phase 4: attach page-level listeners BEFORE any wait ──
  // This ensures we capture logs even for early crashes.

  page.on('console', (msg) => {
    pushLog(consoleLog, `[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    pushLog(pageErrors, err.message);
    recordLifecycle(`attempt-${attempt}:pageerror(${err.message.slice(0, 80)})`);
  });

  page.on('crash', () => {
    recordLifecycle(`attempt-${attempt}:page-crash`);
  });

  page.on('close', () => {
    recordLifecycle(`attempt-${attempt}:page-closed`);
    closed = true;
  });

  // ── Phase 5: wait for base load ──
  try {
    await page.waitForLoadState('load', { timeout: 15_000 });
  } catch (err) {
    recordLifecycle(`attempt-${attempt}:load-timeout`);
    killElectronProcess(electronApp);
    removeDir(userDataDir);
    throw new ScholaE2eError('launch', 'Page did not reach load state.', [...lifecycleEvents], { cause: err });
  }

  recordLifecycle(`attempt-${attempt}:load-ok`);

  // ── Phase 6: wait for renderer ready ──
  // The schola-ready DOM marker is set by React App's useEffect on
  // initial mount — it signals "React shell booted", not "business
  // functionality ready".

  if (options.vaultPath) {
    // Vault mode: wait for welcome-page, click open, wait for workspace
    try {
      await page.waitForSelector('[data-testid="welcome-page"]', { timeout: 10_000 });
    } catch (err) {
      recordLifecycle(`attempt-${attempt}:welcome-timeout`);
      killElectronProcess(electronApp);
      removeDir(userDataDir);
      throw new ScholaE2eError('renderer-ready', 'Welcome page did not appear.', [...lifecycleEvents], { cause: err });
    }

    recordLifecycle(`attempt-${attempt}:welcome-ok`);

    const openButton = page.getByTestId('welcome-open-vault');
    await openButton.click();
    recordLifecycle(`attempt-${attempt}:vault-opening`);

    const wsTimeout = options.workspaceTimeout ?? 15_000;
    try {
      await page.waitForSelector('.workspace-sidebar', { timeout: wsTimeout });
    } catch (err) {
      recordLifecycle(`attempt-${attempt}:workspace-timeout`);
      killElectronProcess(electronApp);
      removeDir(userDataDir);
      throw new ScholaE2eError('renderer-ready', 'Workspace sidebar did not appear after vault open.', [...lifecycleEvents], { cause: err });
    }

    recordLifecycle(`attempt-${attempt}:workspace-ok`);

    // Allow the file tree to finish rendering
    await page.waitForTimeout(800);
  } else {
    // No-vault mode: wait for welcome-page OR schola-ready marker
    try {
      await page.waitForSelector('[data-testid="welcome-page"]', { timeout: 20_000 });
    } catch (err) {
      recordLifecycle(`attempt-${attempt}:welcome-timeout`);
      killElectronProcess(electronApp);
      removeDir(userDataDir);
      throw new ScholaE2eError('renderer-ready', 'Welcome page did not appear within 20s.', [...lifecycleEvents], { cause: err });
    }

    recordLifecycle(`attempt-${attempt}:welcome-ok`);
  }

  // Confirm schola-ready marker exists (React App has mounted)
  try {
    await page.waitForFunction(
      () => document.documentElement.dataset.scholaReady === 'true',
      { timeout: 5_000 },
    );
    recordLifecycle(`attempt-${attempt}:schola-ready`);
  } catch {
    // Non-fatal: marker may not exist on very old builds;
    // the welcome-page check above is the primary readiness gate.
    recordLifecycle(`attempt-${attempt}:schola-ready-missing`);
  }

  recordLifecycle(`attempt-${attempt}:ready`);

  const ctx: ScholaAppContext = {
    electronApp,
    page,
    userDataDir,
    consoleLog,
    pageErrors,
    stdout,
    stderr,
    exitCode,
    attempt,
    lifecycleEvents,

    async close() {
      if (closed) return;
      closed = true;

      try {
        await electronApp.close();
      } catch {
        // Window may already be closed.
      }

      // Ensure the process is gone
      killElectronProcess(electronApp);

      // Brief wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 500));

      removeDir(userDataDir);
    },
  };

  return { ctx, lifecycleEvents };
}

// ─────────────────────────────────────────────
// Public launch (with 1 startup retry)
// ─────────────────────────────────────────────

/**
 * Launch Schola for an E2E test.  Automatically retries ONCE if
 * the failure occurs during the startup phase (launch or renderer-
 * ready).  Business assertions inside test bodies are never retried.
 */
export async function launchSchola(
  options: LaunchScholaOptions = {},
): Promise<ScholaAppContext> {
  const attempts: Array<{
    attempt: number;
    error: unknown;
    lifecycleEvents: string[];
  }> = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await launchScholaAttempt(options, attempt);
      return result.ctx;
    } catch (err) {
      attempts.push({
        attempt,
        error: err,
        lifecycleEvents:
          err instanceof ScholaE2eError
            ? [...err.lifecycleEvents]
            : [],
      });

      // Only retry launch / renderer-ready failures.
      // Business-assertion and cleanup failures should not reach here
      // from the helper, but we guard anyway.
      if (err instanceof ScholaE2eError && err.phase === 'business-assertion') {
        throw err;
      }

      if (attempt === 2) {
        // Both attempts failed — dump combined diagnostics and throw.
        dumpLaunchFailure(attempts);
        throw err;
      }

      // Brief cooldown between attempts so OS resources release
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Unreachable — the loop above always either returns or throws.
  throw new Error('Unexpected: launchSchola exited loop without result.');
}

// ─────────────────────────────────────────────
// Diagnostics
// ─────────────────────────────────────────────

function dumpLaunchFailure(
  attempts: Array<{
    attempt: number;
    error: unknown;
    lifecycleEvents: string[];
  }>,
): void {
  process.stderr.write('\n── [schola:e2e] LAUNCH RETRY EXHAUSTED ──\n');
  for (const { attempt, error, lifecycleEvents } of attempts) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`  Attempt ${attempt}: ${message}\n`);
    if (error instanceof Error && error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 4);
      for (const line of stackLines) {
        process.stderr.write(`    ${line}\n`);
      }
    }
    if (lifecycleEvents.length > 0) {
      process.stderr.write(`  Lifecycle (attempt ${attempt}):\n`);
      for (const ev of lifecycleEvents.slice(-20)) {
        process.stderr.write(`    ${ev}\n`);
      }
    }
  }
}

/**
 * Dump captured logs to stderr for post-mortem debugging.
 * Call this before re-throwing after a test failure.
 */
export function dumpScholaLogs(ctx: ScholaAppContext): void {
  const sections: Array<[string, readonly string[]]> = [
    ['renderer console', ctx.consoleLog],
    ['renderer page errors', ctx.pageErrors],
    ['main process stdout', ctx.stdout],
    ['main process stderr', ctx.stderr],
    ['lifecycle events', ctx.lifecycleEvents],
  ];

  process.stderr.write(
    `\n── [schola:e2e] Log dump (attempt ${ctx.attempt}, exitCode=${ctx.exitCode ?? 'N/A'}) ──\n`,
  );

  for (const [label, lines] of sections) {
    if (lines.length === 0) continue;
    process.stderr.write(`\n── ${label} (last ${lines.length}) ──\n`);
    for (const line of lines.slice(-40)) {
      process.stderr.write(`  ${line}\n`);
    }
  }
}
