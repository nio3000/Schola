import type { ScholaNoteApi } from './note.types';
import type { ScholaVaultApi } from './vault.types';
import type { ScholaWikiQueryApi } from './wiki-query.types';
import type { ScholaSearchQueryApi } from './search-query.types';
import type { ScholaIndexApi } from './index-status.types';
import type { ScholaGraphApi } from './graph-query.types';
import type { ScholaImportApi } from './import-job.types';
import type { ScholaExportApi } from './export-job.types';
import type { ScholaArtifactApi } from './artifact.types';
import type { ScholaRuntimeApi } from './runtime-pack.types';
import type { ScholaPreviewExportApi } from './preview-export.types';
import type { ScholaSettingsApi } from './settings.types';
import type { ScholaAIResearchApi } from './ai-research.types';

// Phase 5-3-IMP: Menu IPC listener API
// Phase 5-3-QUALITY-DEBT: Typed union payloads replace Record<string, unknown>

export type ScholaMenuAction =
  | 'newMarkdown'
  | 'newFolder'
  | 'rename'
  | 'delete'
  | 'revealInExplorer'
  | 'find'
  | 'clearContext';

export type ScholaGraphAction =
  | 'openStylePanel'
  | 'toggleRelationLabel'
  | 'resetView';

export type ScholaGraphScope =
  | 'current-file'
  | 'selected-files'
  | 'folder-project'
  | 'custom'
  | 'whole-vault';

export type ScholaGraphLayout =
  | 'force-directed'
  | 'hierarchical'
  | 'circular';

export type ScholaViewPanel =
  | 'activityBar'
  | 'sideBar'
  | 'bottomPanel';

export type ScholaNavigateActivity =
  | 'files'
  | 'search'
  | 'graph'
  | 'ai'
  | 'artifacts'
  | 'plugins'
  | 'settings'
  | 'help';

export interface ScholaMenuNavigatePayload {
  readonly activity: ScholaNavigateActivity;
  readonly section?: string;
  readonly action?: string;
}

export interface ScholaMenuActionPayload {
  readonly action: ScholaMenuAction;
}

export interface ScholaMenuViewTogglePayload {
  readonly panel: ScholaViewPanel;
}

export interface ScholaMenuGraphScopePayload {
  readonly scope: ScholaGraphScope;
}

export interface ScholaMenuGraphLayoutPayload {
  readonly layout: ScholaGraphLayout;
}

export interface ScholaMenuGraphActionPayload {
  readonly action: ScholaGraphAction;
}

export type ScholaMenuPayload =
  | ScholaMenuNavigatePayload
  | ScholaMenuActionPayload
  | ScholaMenuViewTogglePayload
  | ScholaMenuGraphScopePayload
  | ScholaMenuGraphLayoutPayload
  | ScholaMenuGraphActionPayload;

export interface ScholaMenuApi {
  /** Listen for menu commands from main process. Returns unsubscribe function. */
  readonly onNavigate: (callback: (payload: ScholaMenuPayload) => void) => (() => void);
}

export type AppPlatform =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin'
  | 'netbsd';

export const APP_GET_INFO_CHANNEL = 'app:get-info';
export const APP_OPEN_HELP_CHANNEL = 'app:open-help';
export const APP_RENDERER_READY_CHANNEL = 'app:renderer-ready';
export const APP_PERF_LOG_CHANNEL = 'app:perf-log';
export const WINDOW_MINIMIZE_CHANNEL = 'window:minimize';
export const WINDOW_TOGGLE_MAXIMIZE_CHANNEL = 'window:toggle-maximize';
export const WINDOW_CLOSE_CHANNEL = 'window:close';
export const WINDOW_IS_MAXIMIZED_CHANNEL = 'window:is-maximized';

/** Phase 0 application metadata exposed through the safe preload API. */
export interface AppInfo {
  readonly name: 'Schola';
  readonly version: string;
  readonly platform: AppPlatform;
  readonly phase: string;
}

export interface HelpOpenResult {
  readonly ok: boolean;
  readonly status: 'placeholder';
  readonly title: string;
  readonly message?: string;
}

/** Narrow app namespace exposed to the renderer. */
export interface ScholaAppApi {
  readonly getInfo: () => Promise<AppInfo>;
  readonly openHelp: () => Promise<HelpOpenResult>;
  /** Fire-and-forget signal that the React shell has mounted. */
  readonly notifyRendererReady: () => void;
  /** Fire-and-forget performance log. Gated by SCHOLA_PERF_LOG in main. */
  readonly perfLog: (message: string) => void;
}

/** Fixed-function window controls exposed for the frameless custom titlebar. */
export interface ScholaWindowControlsApi {
  readonly minimize: () => Promise<void>;
  readonly toggleMaximize: () => Promise<boolean>;
  readonly close: () => Promise<void>;
  readonly isMaximized: () => Promise<boolean>;
}

/** Complete renderer-visible API surface. */
export interface ScholaApi {
  readonly app: ScholaAppApi;
  readonly windowControls: ScholaWindowControlsApi;
  readonly vault: ScholaVaultApi;
  readonly note: ScholaNoteApi;
  readonly wiki: ScholaWikiQueryApi;
  readonly search: ScholaSearchQueryApi;
  readonly index: ScholaIndexApi;
  readonly graph: ScholaGraphApi;
  readonly import: ScholaImportApi;
  readonly export: ScholaExportApi;
  readonly artifact: ScholaArtifactApi;
  readonly runtime: ScholaRuntimeApi;
  readonly previewExport: ScholaPreviewExportApi;
  readonly settings: ScholaSettingsApi;
  readonly aiResearch: ScholaAIResearchApi;
  readonly menu: ScholaMenuApi;
}
