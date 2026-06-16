import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'node:path';

import { registerAppIpc } from './ipc/app.ipc';
import { registerNoteIpc } from './ipc/note.ipc';
import { registerVaultIpc } from './ipc/vault.ipc';
import { registerIndexQueryIpc } from './ipc/index-query.ipc';
import { registerGraphQueryIpc } from './ipc/graph-query.ipc';
import { registerImportIpc } from './ipc/import.ipc';
import { registerExportIpc } from './ipc/export.ipc';
import { registerArtifactIpc } from './ipc/artifact.ipc';
import { registerRuntimePackIpc } from './ipc/runtime-pack.ipc';
import { registerPreviewExportIpc } from './ipc/preview-export.ipc';
import { registerSettingsIpc } from './ipc/settings.ipc';
import { registerAIResearchIpc } from './ipc/ai-research.ipc';
import { registerResourceReadIpc } from './ipc/resource-read.ipc';
import { registerResourceImportIpc } from './ipc/resource-import.ipc';
import { abortAllPendingTasks } from './services/ai-research-task.service';
import {
  load as loadRuntimeStatusStore,
  reconcile as reconcileRuntimeStatus,
} from './services/runtime-pack/runtime-pack-status-store.service';
// Phase 3-4-F0: probeAllReservedEngines disabled — Docling bundled runtime paused.
// Uncomment when re-enabling reserved engine probes.
// import { probeAllReservedEngines } from './services/engines/import/import-engine-capability-probe.service';
// Phase 4-0-B-IMP-3: PyMuPDF4LLM core engine probe DEPRECATED — removed from active route.
// import { probeCorePyMuPDF4LLM } from './services/engines/import/import-engine-capability-probe.service';
// Phase 3-4-K: Marker external runtime probe MOVED to on-demand.
// probeCoreMarker is deferred to import:check-enhanced-runtime IPC handler.
// import { probeCoreMarker } from './services/engines/import/import-engine-capability-probe.service';
import { loadFeatureFlags } from './services/feature-flag.service';
import { stopAllWatchers } from './services/vault-watcher.service';
import { closeAllIndexDbs } from './services/index-db.service';
import { perfLog, PROCESS_START_AT } from './lib/perf';
import { installScholaMenu } from './menu/app-menu.service';

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// ── E2E test infrastructure: isolated userData ──
// When SCHOLA_TEST_USER_DATA is set, Electron uses this directory
// instead of the default userData path.  This prevents localStorage
// pollution across test specs.
const TEST_USER_DATA = process.env.SCHOLA_TEST_USER_DATA;
if (TEST_USER_DATA) {
  app.setPath('userData', TEST_USER_DATA);
}

// ── E2E test infrastructure: crash diagnostics ──
// Log render-process-gone events so test failures are debuggable.
app.on('render-process-gone', (_event, _webContents, details) => {
  console.error(
    `[schola:main] Render process gone (reason=${details.reason}, exitCode=${details.exitCode})`,
  );
});

app.on('child-process-gone', (_event, details) => {
  console.error(
    `[schola:main] Child process gone (type=${details.type}, reason=${details.reason}, exitCode=${details.exitCode})`,
  );
});

// ── Process-level unhandled errors ──
process.on('uncaughtException', (error) => {
  console.error(`[schola:main] Uncaught exception: ${error.message}`);
  console.error(error.stack ?? '(no stack)');
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(`[schola:main] Unhandled rejection: ${message}`);
  if (reason instanceof Error && reason.stack) {
    console.error(reason.stack);
  }
});

let mainWindow: BrowserWindow | null = null;

// ── Lifecycle tracker for crash diagnostics ──
// Track renderer readiness milestones so handleWindowLoadFailure
// can report whether the renderer ever reached dom-ready or
// did-finish-load before the failure occurred.
let windowDomReady = false;
let windowDidFinishLoad = false;
let lastLifecycleEvent = 'none';

function resolvePreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function handleWindowLoadFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  let code = 'N/A';
  let errno = 'N/A';
  if (error instanceof Error && 'code' in error) {
    code = String((error as NodeJS.ErrnoException).code ?? 'N/A');
    errno = String((error as NodeJS.ErrnoException).errno ?? 'N/A');
  }

  const loadTarget = VITE_DEV_SERVER_URL ?? 'dist/index.html';
  const windowId = mainWindow?.id ?? 'N/A';

  console.error(
    `[schola:main] Load failure — ` +
      `target=${loadTarget} ` +
      `window=${windowId} ` +
      `domReady=${windowDomReady} ` +
      `didFinishLoad=${windowDidFinishLoad} ` +
      `lastEvent=${lastLifecycleEvent} ` +
      `code=${code} ` +
      `errno=${errno} ` +
      `message=${message}`,
  );

  app.quit();
}

function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
  } catch {
    return false;
  }
}

function createMainWindow(): BrowserWindow {
  const createdWindow = new BrowserWindow({
    frame: false,
    width: 1120,
    height: 720,
    minWidth: 800,
    minHeight: 520,
    title: 'Schola',
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  createdWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Schola failed to open external URL: ${message}`);
      });
    }

    return { action: 'deny' };
  });

  createdWindow.webContents.on('will-navigate', (event) => {
    const targetUrl = event.url;
    const currentUrl = createdWindow.webContents.getURL();

    if (targetUrl !== currentUrl) {
      event.preventDefault();
    }
  });

  createdWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );

  const loadPromise = VITE_DEV_SERVER_URL
    ? createdWindow.loadURL(VITE_DEV_SERVER_URL)
    : createdWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));

  loadPromise.catch(handleWindowLoadFailure);

  // ── Renderer lifecycle diagnostics ──
  // Ordered roughly by expected firing sequence so log output
  // is naturally chronological and easy to diff against failures.

  createdWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[schola:main] Preload error (path=${preloadPath}, error=${message})`);
    lastLifecycleEvent = 'preload-error';
  });

  createdWindow.webContents.on('did-finish-load', () => {
    windowDomReady = true;
    windowDidFinishLoad = true;
    lastLifecycleEvent = 'did-finish-load';
    perfLog(`[perf:startup] didFinishLoad=${Date.now() - PROCESS_START_AT}ms`);
    console.log(`[schola:main] Did-finish-load (window=${mainWindow?.id ?? '?'})`);
  });

  createdWindow.webContents.on(
    'did-fail-provisional-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error(
        `[schola:main] Did-fail-provisional-load ` +
          `(errorCode=${errorCode}, description=${errorDescription}, ` +
          `validatedURL=${validatedURL}, isMainFrame=${String(isMainFrame)})`,
      );
      lastLifecycleEvent = 'did-fail-provisional-load';
    },
  );

  createdWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(
      `[schola:main] Window render-process-gone (reason=${details.reason}, exitCode=${details.exitCode})`,
    );
    lastLifecycleEvent = 'render-process-gone';
  });

  createdWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error(
        `[schola:main] Did-fail-load ` +
          `(errorCode=${errorCode}, description=${errorDescription}, ` +
          `validatedURL=${validatedURL}, isMainFrame=${String(isMainFrame)})`,
      );
      lastLifecycleEvent = 'did-fail-load';
    },
  );

  createdWindow.webContents.on('unresponsive', () => {
    console.warn(`[schola:main] Window unresponsive (window=${mainWindow?.id ?? '?'})`);
    lastLifecycleEvent = 'unresponsive';
  });

  createdWindow.webContents.on('responsive', () => {
    console.log(`[schola:main] Window responsive (window=${mainWindow?.id ?? '?'})`);
    lastLifecycleEvent = 'responsive';
  });

  createdWindow.webContents.on('destroyed', () => {
    console.log(`[schola:main] WebContents destroyed (window=${mainWindow?.id ?? '?'})`);
    lastLifecycleEvent = 'destroyed';
  });

  createdWindow.on('closed', () => {
    console.log(`[schola:main] Window closed (window=${mainWindow?.id ?? '?'})`);
    lastLifecycleEvent = 'closed';
    mainWindow = null;
  });

  return createdWindow;
}

registerAppIpc();
registerVaultIpc();
registerNoteIpc();
registerIndexQueryIpc();
registerGraphQueryIpc();
registerImportIpc();
registerExportIpc();
registerArtifactIpc();
// Phase 4-0-B-IMP-4: Runtime Pack IPC deferred.
// Runtime Pack hidden — IPC registration paused.
// Re-evaluate when Plugin Manager design phase begins (Phase 4-0-D).
// registerRuntimePackIpc();
registerPreviewExportIpc();
registerResourceReadIpc();
registerResourceImportIpc();
registerSettingsIpc();
registerAIResearchIpc();

// Phase 4-0-B-IMP-4: Runtime Pack status store deferred.
// loadRuntimeStatusStore().then(() => {
//   reconcileRuntimeStatus();
// }).catch((err: unknown) => {
//   const msg = err instanceof Error ? err.message : String(err);
//   console.error(`[schola:main] Failed to load runtime status store: ${msg}`);
// });

app.whenReady().then(() => {
  perfLog(`[perf:startup] appReady=${Date.now() - PROCESS_START_AT}ms`);
  console.log('[schola:main] App ready');
  // Phase 5-3-IMP: Install Schola custom application menu (replaces Phase 1-C hidden menu)
  installScholaMenu({ mainWindow: null as unknown as BrowserWindow, locale: 'zh-CN' });

  // Phase 4-0-D-5: Load feature flags (default all OFF)
  loadFeatureFlags();

  mainWindow = createMainWindow();
  perfLog(`[perf:startup] windowCreated=${Date.now() - PROCESS_START_AT}ms`);

  // Install menu after window is created for proper webContents reference
  installScholaMenu({ mainWindow, locale: 'zh-CN' });

  // Phase 3-4-F0: Reserved engine probe disabled.
  // Docling bundled runtime paused as default — precision=false.
  // To re-enable: set DISABLE_RESERVED_ENGINE_PROBES=false in
  // import-engine-capability-probe.service.ts and uncomment below.
  // void probeAllReservedEngines().catch((err) => {
  //   console.warn('[schola:main] Engine capability probe failed:', err instanceof Error ? err.message : String(err));
  // });

  // Phase 4-0-B-IMP-3: PyMuPDF4LLM core engine probe DEPRECATED.
  // PyMuPDF4LLM removed from active route per Phase 4-0-B convergence.
  // Code preserved for reference — do not re-enable without explicit re-evaluation.
  // void probeCorePyMuPDF4LLM().then((result) => {
  //   console.log(`[schola:main] PyMuPDF4LLM core engine probe: status=${result.status} version=${result.version ?? 'none'}`);
  // }).catch((err: unknown) => {
  //   console.warn('[schola:main] PyMuPDF4LLM core engine probe failed:', err instanceof Error ? err.message : String(err));
  // });

  // Phase 3-4-K: Marker external runtime probe MOVED to on-demand.
  // Probe is now triggered by import:check-enhanced-runtime IPC handler
  // (import-engine-capability-probe.service.ts → getCachedEnhancedDiagnostics).
  // This avoids blocking app startup with Python discovery + import check.

  app.on('activate', () => {
    if (mainWindow === null) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('[schola:main] Window-all-closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('[schola:main] Before-quit');
  abortAllPendingTasks();
  stopAllWatchers();
  closeAllIndexDbs();
});

app.on('will-quit', () => {
  console.log('[schola:main] Will-quit');
});

app.on('quit', () => {
  console.log('[schola:main] Quit');
});
