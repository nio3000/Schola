import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  APP_GET_INFO_CHANNEL as APP_GET_INFO_CHANNEL_TYPE,
  APP_OPEN_HELP_CHANNEL as APP_OPEN_HELP_CHANNEL_TYPE,
  APP_RENDERER_READY_CHANNEL as APP_RENDERER_READY_CHANNEL_TYPE,
  APP_PERF_LOG_CHANNEL as APP_PERF_LOG_CHANNEL_TYPE,
  WINDOW_CLOSE_CHANNEL as WINDOW_CLOSE_CHANNEL_TYPE,
  WINDOW_IS_MAXIMIZED_CHANNEL as WINDOW_IS_MAXIMIZED_CHANNEL_TYPE,
  WINDOW_MINIMIZE_CHANNEL as WINDOW_MINIMIZE_CHANNEL_TYPE,
  WINDOW_TOGGLE_MAXIMIZE_CHANNEL as WINDOW_TOGGLE_MAXIMIZE_CHANNEL_TYPE,
  AppInfo,
  HelpOpenResult,
  ScholaApi,
  ScholaMenuPayload,
} from '../src/lib/contracts/app.types';
import type {
  FOLDER_CREATE_CHANNEL as FOLDER_CREATE_CHANNEL_TYPE,
  FOLDER_DELETE_CHANNEL as FOLDER_DELETE_CHANNEL_TYPE,
  FOLDER_DELETE_PERMANENT_CHANNEL as FOLDER_DELETE_PERMANENT_CHANNEL_TYPE,
  FOLDER_RENAME_CHANNEL as FOLDER_RENAME_CHANNEL_TYPE,
  FOLDER_MOVE_CHANNEL as FOLDER_MOVE_CHANNEL_TYPE,
  CreateFolderInput,
  CreateFolderResult,
  CreateNoteInput,
  CreateNoteResult,
  DeleteEntryInput,
  DeleteFolderOutcome,
  DeleteNoteOutcome,
  MoveEntryInput,
  MoveFolderResult,
  MoveNoteResult,
  NOTE_CREATE_CHANNEL as NOTE_CREATE_CHANNEL_TYPE,
  NOTE_DELETE_CHANNEL as NOTE_DELETE_CHANNEL_TYPE,
  NOTE_DELETE_PERMANENT_CHANNEL as NOTE_DELETE_PERMANENT_CHANNEL_TYPE,
  NOTE_READ_CHANNEL as NOTE_READ_CHANNEL_TYPE,
  NOTE_RENAME_CHANNEL as NOTE_RENAME_CHANNEL_TYPE,
  NOTE_MOVE_CHANNEL as NOTE_MOVE_CHANNEL_TYPE,
  NOTE_SAVE_CHANNEL as NOTE_SAVE_CHANNEL_TYPE,
  NoteContent,
  RenameEntryInput,
  RenameFolderResult,
  RenameNoteResult,
  SaveNoteResult,
} from '../src/lib/contracts/note.types';
import type {
  CreateVaultResult,
  FileEntry,
  ImageAsset,
  INDEX_SYNC_FILE_EVENTS_CHANNEL as INDEX_SYNC_FILE_EVENTS_CHANNEL_TYPE,
  IndexSyncResult,
  VAULT_CLOSE_CHANNEL as VAULT_CLOSE_CHANNEL_TYPE,
  VAULT_CREATE_CHANNEL as VAULT_CREATE_CHANNEL_TYPE,
  VAULT_FILE_EVENT_CHANNEL as VAULT_FILE_EVENT_CHANNEL_TYPE,
  VAULT_GET_RECENT_CHANNEL as VAULT_GET_RECENT_CHANNEL_TYPE,
  VAULT_LIST_IMAGE_ASSETS_CHANNEL as VAULT_LIST_IMAGE_ASSETS_CHANNEL_TYPE,
  VAULT_OPEN_BY_PATH_CHANNEL as VAULT_OPEN_BY_PATH_CHANNEL_TYPE,
  VAULT_OPEN_CHANNEL as VAULT_OPEN_CHANNEL_TYPE,
  VAULT_RESOLVE_ASSET_URL_CHANNEL as VAULT_RESOLVE_ASSET_URL_CHANNEL_TYPE,
  VAULT_SCAN_CHANNEL as VAULT_SCAN_CHANNEL_TYPE,
  VaultFileEvent,
  VaultInfo,
} from '../src/lib/contracts/vault.types';
import type {
  GetBacklinksResult,
  GetOutgoingResult,
  GetUnresolvedResult,
  WIKI_GET_BACKLINKS_CHANNEL as WIKI_GET_BACKLINKS_CHANNEL_TYPE,
  WIKI_GET_OUTGOING_LINKS_CHANNEL as WIKI_GET_OUTGOING_LINKS_CHANNEL_TYPE,
  WIKI_GET_UNRESOLVED_LINKS_CHANNEL as WIKI_GET_UNRESOLVED_LINKS_CHANNEL_TYPE,
} from '../src/lib/contracts/wiki-query.types';
import type {
  SearchQueryResult,
  SEARCH_QUERY_CHANNEL as SEARCH_QUERY_CHANNEL_TYPE,
} from '../src/lib/contracts/search-query.types';
import type {
  INDEX_GET_STATUS_CHANNEL as INDEX_GET_STATUS_CHANNEL_TYPE,
  INDEX_REBUILD_CHANNEL as INDEX_REBUILD_CHANNEL_TYPE,
  IndexStatus,
  IndexRebuildResult,
} from '../src/lib/contracts/index-status.types';
import type {
  IMPORT_SELECT_SOURCE_CHANNEL as IMPORT_SELECT_SOURCE_CHANNEL_TYPE,
  IMPORT_CREATE_JOB_CHANNEL as IMPORT_CREATE_JOB_CHANNEL_TYPE,
  IMPORT_GET_JOB_STATUS_CHANNEL as IMPORT_GET_JOB_STATUS_CHANNEL_TYPE,
  IMPORT_LIST_JOBS_CHANNEL as IMPORT_LIST_JOBS_CHANNEL_TYPE,
  IMPORT_CANCEL_JOB_CHANNEL as IMPORT_CANCEL_JOB_CHANNEL_TYPE,
  IMPORT_GET_AVAILABLE_MODES_CHANNEL as IMPORT_GET_AVAILABLE_MODES_CHANNEL_TYPE,
  IMPORT_OPEN_ORIGINAL_FILE_CHANNEL as IMPORT_OPEN_ORIGINAL_FILE_CHANNEL_TYPE,
  IMPORT_REVEAL_ORIGINAL_FILE_CHANNEL as IMPORT_REVEAL_ORIGINAL_FILE_CHANNEL_TYPE,
} from '../src/lib/contracts/import-export-ipc.types';
import type {
  EXPORT_CREATE_JOB_CHANNEL as EXPORT_CREATE_JOB_CHANNEL_TYPE,
  EXPORT_GET_JOB_STATUS_CHANNEL as EXPORT_GET_JOB_STATUS_CHANNEL_TYPE,
  EXPORT_LIST_JOBS_CHANNEL as EXPORT_LIST_JOBS_CHANNEL_TYPE,
  EXPORT_CANCEL_JOB_CHANNEL as EXPORT_CANCEL_JOB_CHANNEL_TYPE,
  PREVIEW_EXPORT_HTML_CHANNEL as PREVIEW_EXPORT_HTML_CHANNEL_TYPE,
  PREVIEW_EXPORT_PDF_CHANNEL as PREVIEW_EXPORT_PDF_CHANNEL_TYPE,
  RESOURCE_READ_PDF_CHANNEL as RESOURCE_READ_PDF_CHANNEL_TYPE,
  RESOURCE_READ_HTML_CHANNEL as RESOURCE_READ_HTML_CHANNEL_TYPE,
  RESOURCE_IMPORT_CHANNEL as RESOURCE_IMPORT_CHANNEL_TYPE,
  RESOURCE_READ_TEXT_PREVIEW_CHANNEL as RESOURCE_READ_TEXT_PREVIEW_CHANNEL_TYPE,
  RESOURCE_READ_DOCX_PREVIEW_CHANNEL as RESOURCE_READ_DOCX_PREVIEW_CHANNEL_TYPE,
  RESOURCE_READ_XLSX_PREVIEW_CHANNEL as RESOURCE_READ_XLSX_PREVIEW_CHANNEL_TYPE,
  RESOURCE_READ_XLS_PREVIEW_CHANNEL as RESOURCE_READ_XLS_PREVIEW_CHANNEL_TYPE,
  RESOURCE_READ_DOC_PREVIEW_CHANNEL as RESOURCE_READ_DOC_PREVIEW_CHANNEL_TYPE,
} from '../src/lib/contracts/import-export-ipc.types';
import type {
  CreateImportJobInput,
  CreateImportJobOutcome,
  GetImportJobStatusResult,
  ListImportJobsResult,
  CancelImportJobResult,
  SelectImportSourceResult,
  SelectImportSourceInput,
  GetAvailableModesResult,
  OpenOriginalImportFileResult,
  RevealOriginalImportFileResult,
} from '../src/lib/contracts/import-job.types';
import type {
  CreateExportJobInput,
  CreateExportJobOutcome,
  GetExportJobStatusResult,
  ListExportJobsResult,
  CancelExportJobResult,
} from '../src/lib/contracts/export-job.types';
import type {
  PreviewExportInput,
  PreviewExportResult,
} from '../src/lib/contracts/preview-export.types';
import type {
  ReadPdfResourceInput,
  ReadPdfResourceResult,
  ReadHtmlResourceInput,
  ReadHtmlResourceResult,
  ImportResourceInput,
  ImportResourceResult,
  ReadTextPreviewInput,
  ReadTextPreviewResult,
  ReadDocxPreviewInput,
  ReadDocxPreviewResult,
  ReadXlsxPreviewInput,
  ReadXlsxPreviewResult,
  ReadXlsPreviewInput,
  ReadXlsPreviewResult,
  ReadDocPreviewInput,
  ReadDocPreviewResult,
} from '../src/lib/contracts/resource.types';
import type {
  ARTIFACT_OPEN_GENERATED_MARKDOWN_CHANNEL as ARTIFACT_OPEN_GENERATED_MARKDOWN_CHANNEL_TYPE,
  ARTIFACT_REVEAL_GENERATED_MARKDOWN_CHANNEL as ARTIFACT_REVEAL_GENERATED_MARKDOWN_CHANNEL_TYPE,
  ARTIFACT_OPEN_EXPORT_ARTIFACT_CHANNEL as ARTIFACT_OPEN_EXPORT_ARTIFACT_CHANNEL_TYPE,
  ARTIFACT_REVEAL_EXPORT_ARTIFACT_CHANNEL as ARTIFACT_REVEAL_EXPORT_ARTIFACT_CHANNEL_TYPE,
  ArtifactOpenResult,
} from '../src/lib/contracts/artifact.types';
import type {
  GRAPH_GET_VAULT_GRAPH_CHANNEL as GRAPH_GET_VAULT_GRAPH_CHANNEL_TYPE,
  GetVaultGraphInput,
  GetVaultGraphResult,
} from '../src/lib/contracts/graph-query.types';
import type { ScholaSettingsApi } from '../src/lib/contracts/settings.types';
import type {
  SETTINGS_GET_PROVIDER_PRESETS_CHANNEL as SETTINGS_GET_PROVIDER_PRESETS_CHANNEL_TYPE,
  SETTINGS_GET_PROVIDER_CONFIGS_CHANNEL as SETTINGS_GET_PROVIDER_CONFIGS_CHANNEL_TYPE,
  SETTINGS_SET_PROVIDER_CONFIG_CHANNEL as SETTINGS_SET_PROVIDER_CONFIG_CHANNEL_TYPE,
  SETTINGS_GET_PROVIDER_MODELS_CHANNEL as SETTINGS_GET_PROVIDER_MODELS_CHANNEL_TYPE,
  SETTINGS_FETCH_PROVIDER_MODELS_CHANNEL as SETTINGS_FETCH_PROVIDER_MODELS_CHANNEL_TYPE,
  SETTINGS_TEST_PROVIDER_LATENCY_CHANNEL as SETTINGS_TEST_PROVIDER_LATENCY_CHANNEL_TYPE,
  SETTINGS_GET_API_KEY_STATUS_CHANNEL as SETTINGS_GET_API_KEY_STATUS_CHANNEL_TYPE,
  SETTINGS_SET_API_KEY_CHANNEL as SETTINGS_SET_API_KEY_CHANNEL_TYPE,
  SETTINGS_CLEAR_API_KEY_CHANNEL as SETTINGS_CLEAR_API_KEY_CHANNEL_TYPE,
  SETTINGS_GET_PRIVACY_CONSENT_CHANNEL as SETTINGS_GET_PRIVACY_CONSENT_CHANNEL_TYPE,
  SETTINGS_SET_PRIVACY_CONSENT_CHANNEL as SETTINGS_SET_PRIVACY_CONSENT_CHANNEL_TYPE,
  SETTINGS_GET_CONTEXT_SEND_POLICY_CHANNEL as SETTINGS_GET_CONTEXT_SEND_POLICY_CHANNEL_TYPE,
  SETTINGS_SET_CONTEXT_SEND_POLICY_CHANNEL as SETTINGS_SET_CONTEXT_SEND_POLICY_CHANNEL_TYPE,
  SETTINGS_GET_AI_PREFERENCES_CHANNEL as SETTINGS_GET_AI_PREFERENCES_CHANNEL_TYPE,
  SETTINGS_SET_AI_PREFERENCES_CHANNEL as SETTINGS_SET_AI_PREFERENCES_CHANNEL_TYPE,
  SETTINGS_GET_CONFIRMATION_LOG_CHANNEL as SETTINGS_GET_CONFIRMATION_LOG_CHANNEL_TYPE,
  ProviderConfig,
  PrivacyConsentState,
  AIPreferences,
  ConfirmationLogEntry,
  ContextSendPolicy,
  FetchProviderModelsInput,
  FetchProviderModelsResult,
  MaskedSecretStatus,
  TestProviderLatencyInput,
  TestProviderLatencyResult,
} from '../src/lib/contracts/settings.types';
import type { ProviderPreset } from '../src/lib/contracts/provider-preset.types';
import type { AIModelInfo } from '../src/lib/contracts/ai-provider.types';
import type { ScholaAIResearchApi } from '../src/lib/contracts/ai-research.types';
import type {
  AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL as AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL_TYPE,
  AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL as AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL_TYPE,
  AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL as AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL_TYPE,
  AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL as AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL_TYPE,
  AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL as AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL_TYPE,
  AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL as AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL_TYPE,
  AI_RESEARCH_CANCEL_TASK_CHANNEL as AI_RESEARCH_CANCEL_TASK_CHANNEL_TYPE,
  AI_RESEARCH_GET_TASK_STATUS_CHANNEL as AI_RESEARCH_GET_TASK_STATUS_CHANNEL_TYPE,
  AI_RESEARCH_GET_TASK_RESULT_CHANNEL as AI_RESEARCH_GET_TASK_RESULT_CHANNEL_TYPE,
  AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL as AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL_TYPE,
  AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL as AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL_TYPE,
  AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL as AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL_TYPE,
  AI_RESEARCH_TASK_CHUNK_EVENT as AI_RESEARCH_TASK_CHUNK_EVENT_TYPE,
  AI_RESEARCH_TASK_DONE_EVENT as AI_RESEARCH_TASK_DONE_EVENT_TYPE,
  AI_RESEARCH_TASK_ERROR_EVENT as AI_RESEARCH_TASK_ERROR_EVENT_TYPE,
  ChatChunk,
  AIResearchTaskStatus,
  AIResearchTaskResult,
  BuildContextPackInput,
  CancelTaskInput,
  ConfirmContextPackInput,
  ContextConfirmationSnapshot,
  CreateTaskDraftInput,
  ProviderReadiness,
  ResearchContextPreview,
  RunConfirmedTaskInput,
  SaveArtifactDraftInput,
  SaveArtifactDraftResult,
  SubscribeTaskCallbacks,
} from '../src/lib/contracts/ai-research.types';
import type {
  RUNTIME_LIST_PACKS_CHANNEL as RUNTIME_LIST_PACKS_CHANNEL_TYPE,
  RUNTIME_GET_STATUS_CHANNEL as RUNTIME_GET_STATUS_CHANNEL_TYPE,
  RUNTIME_INSTALL_CHANNEL as RUNTIME_INSTALL_CHANNEL_TYPE,
  RUNTIME_CANCEL_INSTALL_CHANNEL as RUNTIME_CANCEL_INSTALL_CHANNEL_TYPE,
  RUNTIME_UNINSTALL_CHANNEL as RUNTIME_UNINSTALL_CHANNEL_TYPE,
  RUNTIME_ENABLE_CHANNEL as RUNTIME_ENABLE_CHANNEL_TYPE,
  RUNTIME_DISABLE_CHANNEL as RUNTIME_DISABLE_CHANNEL_TYPE,
  RUNTIME_PROBE_CHANNEL as RUNTIME_PROBE_CHANNEL_TYPE,
  RUNTIME_DIAGNOSE_CHANNEL as RUNTIME_DIAGNOSE_CHANNEL_TYPE,
  RUNTIME_CLEAR_CACHE_CHANNEL as RUNTIME_CLEAR_CACHE_CHANNEL_TYPE,
  RUNTIME_EXPORT_DIAGNOSTICS_CHANNEL as RUNTIME_EXPORT_DIAGNOSTICS_CHANNEL_TYPE,
  InstallRuntimePackInput,
  InstallRuntimePackResult,
  UninstallRuntimePackInput,
  UninstallRuntimePackResult,
  DiagnoseRuntimePackInput,
  DiagnoseRuntimePackResult,
  ExportDiagnosticsInput,
  ExportDiagnosticsResult,
  ClearRuntimePackCacheResult,
  ProbeRuntimePackResult,
  ToggleRuntimePackResult,
  CancelInstallRuntimePackResult,
  ListRuntimePacksResult,
  RuntimePackStatus,
} from '../src/lib/contracts/runtime-pack.types';

const APP_GET_INFO_CHANNEL: typeof APP_GET_INFO_CHANNEL_TYPE = 'app:get-info';
const APP_OPEN_HELP_CHANNEL: typeof APP_OPEN_HELP_CHANNEL_TYPE = 'app:open-help';
const APP_RENDERER_READY_CHANNEL: typeof APP_RENDERER_READY_CHANNEL_TYPE = 'app:renderer-ready';
const APP_PERF_LOG_CHANNEL: typeof APP_PERF_LOG_CHANNEL_TYPE = 'app:perf-log';
const WINDOW_MINIMIZE_CHANNEL: typeof WINDOW_MINIMIZE_CHANNEL_TYPE = 'window:minimize';
const WINDOW_TOGGLE_MAXIMIZE_CHANNEL: typeof WINDOW_TOGGLE_MAXIMIZE_CHANNEL_TYPE =
  'window:toggle-maximize';
const WINDOW_CLOSE_CHANNEL: typeof WINDOW_CLOSE_CHANNEL_TYPE = 'window:close';
const WINDOW_IS_MAXIMIZED_CHANNEL: typeof WINDOW_IS_MAXIMIZED_CHANNEL_TYPE = 'window:is-maximized';
const VAULT_OPEN_CHANNEL: typeof VAULT_OPEN_CHANNEL_TYPE = 'vault:open';
const VAULT_OPEN_BY_PATH_CHANNEL: typeof VAULT_OPEN_BY_PATH_CHANNEL_TYPE = 'vault:open-by-path';
const VAULT_CREATE_CHANNEL: typeof VAULT_CREATE_CHANNEL_TYPE = 'vault:create';
const VAULT_RESOLVE_ASSET_URL_CHANNEL: typeof VAULT_RESOLVE_ASSET_URL_CHANNEL_TYPE =
  'vault:resolve-asset-url';
const VAULT_SCAN_CHANNEL: typeof VAULT_SCAN_CHANNEL_TYPE = 'vault:scan';
const VAULT_GET_RECENT_CHANNEL: typeof VAULT_GET_RECENT_CHANNEL_TYPE = 'vault:get-recent';
const VAULT_CLOSE_CHANNEL: typeof VAULT_CLOSE_CHANNEL_TYPE = 'vault:close';
const VAULT_LIST_IMAGE_ASSETS_CHANNEL: typeof VAULT_LIST_IMAGE_ASSETS_CHANNEL_TYPE =
  'vault:list-image-assets';
const WIKI_GET_BACKLINKS_CHANNEL: typeof WIKI_GET_BACKLINKS_CHANNEL_TYPE = 'wiki:get-backlinks';
const WIKI_GET_OUTGOING_LINKS_CHANNEL: typeof WIKI_GET_OUTGOING_LINKS_CHANNEL_TYPE =
  'wiki:get-outgoing-links';
const WIKI_GET_UNRESOLVED_LINKS_CHANNEL: typeof WIKI_GET_UNRESOLVED_LINKS_CHANNEL_TYPE =
  'wiki:get-unresolved-links';
const SEARCH_QUERY_CHANNEL: typeof SEARCH_QUERY_CHANNEL_TYPE = 'search:query';
const INDEX_GET_STATUS_CHANNEL: typeof INDEX_GET_STATUS_CHANNEL_TYPE = 'index:get-status';
const INDEX_REBUILD_CHANNEL: typeof INDEX_REBUILD_CHANNEL_TYPE = 'index:rebuild';
const GRAPH_GET_VAULT_GRAPH_CHANNEL: typeof GRAPH_GET_VAULT_GRAPH_CHANNEL_TYPE =
  'graph:get-vault-graph';
const RUNTIME_LIST_PACKS_CHANNEL: typeof RUNTIME_LIST_PACKS_CHANNEL_TYPE = 'runtime:list-packs';
const RUNTIME_GET_STATUS_CHANNEL: typeof RUNTIME_GET_STATUS_CHANNEL_TYPE = 'runtime:get-status';
const RUNTIME_INSTALL_CHANNEL: typeof RUNTIME_INSTALL_CHANNEL_TYPE = 'runtime:install';
const RUNTIME_CANCEL_INSTALL_CHANNEL: typeof RUNTIME_CANCEL_INSTALL_CHANNEL_TYPE =
  'runtime:cancel-install';
const RUNTIME_UNINSTALL_CHANNEL: typeof RUNTIME_UNINSTALL_CHANNEL_TYPE = 'runtime:uninstall';
const RUNTIME_ENABLE_CHANNEL: typeof RUNTIME_ENABLE_CHANNEL_TYPE = 'runtime:enable';
const RUNTIME_DISABLE_CHANNEL: typeof RUNTIME_DISABLE_CHANNEL_TYPE = 'runtime:disable';
const RUNTIME_PROBE_CHANNEL: typeof RUNTIME_PROBE_CHANNEL_TYPE = 'runtime:probe';
const RUNTIME_DIAGNOSE_CHANNEL: typeof RUNTIME_DIAGNOSE_CHANNEL_TYPE = 'runtime:diagnose';
const RUNTIME_CLEAR_CACHE_CHANNEL: typeof RUNTIME_CLEAR_CACHE_CHANNEL_TYPE = 'runtime:clear-cache';
const RUNTIME_EXPORT_DIAGNOSTICS_CHANNEL: typeof RUNTIME_EXPORT_DIAGNOSTICS_CHANNEL_TYPE =
  'runtime:export-diagnostics';
const AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL: typeof AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL_TYPE =
  'ai-research:get-provider-readiness';
const AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL: typeof AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL_TYPE =
  'ai-research:build-context-pack';
const AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL: typeof AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL_TYPE =
  'ai-research:preview-context-pack';
const AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL: typeof AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL_TYPE =
  'ai-research:confirm-context-pack';
const AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL: typeof AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL_TYPE =
  'ai-research:create-task-draft';
const AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL: typeof AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL_TYPE =
  'ai-research:run-confirmed-task';
const AI_RESEARCH_CANCEL_TASK_CHANNEL: typeof AI_RESEARCH_CANCEL_TASK_CHANNEL_TYPE =
  'ai-research:cancel-task';
const AI_RESEARCH_GET_TASK_STATUS_CHANNEL: typeof AI_RESEARCH_GET_TASK_STATUS_CHANNEL_TYPE =
  'ai-research:get-task-status';
const AI_RESEARCH_GET_TASK_RESULT_CHANNEL: typeof AI_RESEARCH_GET_TASK_RESULT_CHANNEL_TYPE =
  'ai-research:get-task-result';
const AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL: typeof AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL_TYPE =
  'ai-research:clear-task-result';
const AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL: typeof AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL_TYPE =
  'ai-research:discard-artifact';
const AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL: typeof AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL_TYPE =
  'ai-research:save-artifact-draft';
const AI_RESEARCH_TASK_CHUNK_EVENT: typeof AI_RESEARCH_TASK_CHUNK_EVENT_TYPE =
  'ai-research:task-chunk';
const AI_RESEARCH_TASK_DONE_EVENT: typeof AI_RESEARCH_TASK_DONE_EVENT_TYPE =
  'ai-research:task-done';
const AI_RESEARCH_TASK_ERROR_EVENT: typeof AI_RESEARCH_TASK_ERROR_EVENT_TYPE =
  'ai-research:task-error';
const SETTINGS_GET_PROVIDER_PRESETS_CHANNEL: typeof SETTINGS_GET_PROVIDER_PRESETS_CHANNEL_TYPE =
  'settings:get-provider-presets';
const SETTINGS_GET_PROVIDER_CONFIGS_CHANNEL: typeof SETTINGS_GET_PROVIDER_CONFIGS_CHANNEL_TYPE =
  'settings:get-provider-configs';
const SETTINGS_SET_PROVIDER_CONFIG_CHANNEL: typeof SETTINGS_SET_PROVIDER_CONFIG_CHANNEL_TYPE =
  'settings:set-provider-config';
const SETTINGS_GET_PROVIDER_MODELS_CHANNEL: typeof SETTINGS_GET_PROVIDER_MODELS_CHANNEL_TYPE =
  'settings:get-provider-models';
const SETTINGS_FETCH_PROVIDER_MODELS_CHANNEL: typeof SETTINGS_FETCH_PROVIDER_MODELS_CHANNEL_TYPE =
  'settings:fetch-provider-models';
const SETTINGS_TEST_PROVIDER_LATENCY_CHANNEL: typeof SETTINGS_TEST_PROVIDER_LATENCY_CHANNEL_TYPE =
  'settings:test-provider-latency';
const SETTINGS_GET_API_KEY_STATUS_CHANNEL: typeof SETTINGS_GET_API_KEY_STATUS_CHANNEL_TYPE =
  'settings:get-api-key-status';
const SETTINGS_SET_API_KEY_CHANNEL: typeof SETTINGS_SET_API_KEY_CHANNEL_TYPE =
  'settings:set-api-key';
const SETTINGS_CLEAR_API_KEY_CHANNEL: typeof SETTINGS_CLEAR_API_KEY_CHANNEL_TYPE =
  'settings:clear-api-key';
const SETTINGS_GET_PRIVACY_CONSENT_CHANNEL: typeof SETTINGS_GET_PRIVACY_CONSENT_CHANNEL_TYPE =
  'settings:get-privacy-consent';
const SETTINGS_SET_PRIVACY_CONSENT_CHANNEL: typeof SETTINGS_SET_PRIVACY_CONSENT_CHANNEL_TYPE =
  'settings:set-privacy-consent';
const SETTINGS_GET_CONTEXT_SEND_POLICY_CHANNEL: typeof SETTINGS_GET_CONTEXT_SEND_POLICY_CHANNEL_TYPE =
  'settings:get-context-send-policy';
const SETTINGS_SET_CONTEXT_SEND_POLICY_CHANNEL: typeof SETTINGS_SET_CONTEXT_SEND_POLICY_CHANNEL_TYPE =
  'settings:set-context-send-policy';
const SETTINGS_GET_AI_PREFERENCES_CHANNEL: typeof SETTINGS_GET_AI_PREFERENCES_CHANNEL_TYPE =
  'settings:get-ai-preferences';
const SETTINGS_SET_AI_PREFERENCES_CHANNEL: typeof SETTINGS_SET_AI_PREFERENCES_CHANNEL_TYPE =
  'settings:set-ai-preferences';
const SETTINGS_GET_CONFIRMATION_LOG_CHANNEL: typeof SETTINGS_GET_CONFIRMATION_LOG_CHANNEL_TYPE =
  'settings:get-confirmation-log';
const IMPORT_SELECT_SOURCE_CHANNEL: typeof IMPORT_SELECT_SOURCE_CHANNEL_TYPE =
  'import:select-source';
const IMPORT_CREATE_JOB_CHANNEL: typeof IMPORT_CREATE_JOB_CHANNEL_TYPE = 'import:create-job';
const IMPORT_GET_JOB_STATUS_CHANNEL: typeof IMPORT_GET_JOB_STATUS_CHANNEL_TYPE =
  'import:get-job-status';
const IMPORT_LIST_JOBS_CHANNEL: typeof IMPORT_LIST_JOBS_CHANNEL_TYPE = 'import:list-jobs';
const IMPORT_CANCEL_JOB_CHANNEL: typeof IMPORT_CANCEL_JOB_CHANNEL_TYPE = 'import:cancel-job';
const IMPORT_GET_AVAILABLE_MODES_CHANNEL: typeof IMPORT_GET_AVAILABLE_MODES_CHANNEL_TYPE =
  'import:get-available-modes';
const IMPORT_OPEN_ORIGINAL_FILE_CHANNEL: typeof IMPORT_OPEN_ORIGINAL_FILE_CHANNEL_TYPE =
  'import:open-original-file';
const IMPORT_REVEAL_ORIGINAL_FILE_CHANNEL: typeof IMPORT_REVEAL_ORIGINAL_FILE_CHANNEL_TYPE =
  'import:reveal-original-file';
const EXPORT_CREATE_JOB_CHANNEL: typeof EXPORT_CREATE_JOB_CHANNEL_TYPE = 'export:create-job';
const EXPORT_GET_JOB_STATUS_CHANNEL: typeof EXPORT_GET_JOB_STATUS_CHANNEL_TYPE =
  'export:get-job-status';
const EXPORT_LIST_JOBS_CHANNEL: typeof EXPORT_LIST_JOBS_CHANNEL_TYPE = 'export:list-jobs';
const EXPORT_CANCEL_JOB_CHANNEL: typeof EXPORT_CANCEL_JOB_CHANNEL_TYPE = 'export:cancel-job';
const VAULT_FILE_EVENT_CHANNEL: typeof VAULT_FILE_EVENT_CHANNEL_TYPE = 'vault:file-event';
const INDEX_SYNC_FILE_EVENTS_CHANNEL: typeof INDEX_SYNC_FILE_EVENTS_CHANNEL_TYPE =
  'index:sync-file-events';
const NOTE_READ_CHANNEL: typeof NOTE_READ_CHANNEL_TYPE = 'note:read';
const NOTE_SAVE_CHANNEL: typeof NOTE_SAVE_CHANNEL_TYPE = 'note:save';
const NOTE_CREATE_CHANNEL: typeof NOTE_CREATE_CHANNEL_TYPE = 'note:create';
const FOLDER_CREATE_CHANNEL: typeof FOLDER_CREATE_CHANNEL_TYPE = 'folder:create';
const NOTE_RENAME_CHANNEL: typeof NOTE_RENAME_CHANNEL_TYPE = 'note:rename';
const FOLDER_RENAME_CHANNEL: typeof FOLDER_RENAME_CHANNEL_TYPE = 'folder:rename';
const NOTE_DELETE_CHANNEL: typeof NOTE_DELETE_CHANNEL_TYPE = 'note:delete';
const NOTE_DELETE_PERMANENT_CHANNEL: typeof NOTE_DELETE_PERMANENT_CHANNEL_TYPE =
  'note:delete-permanent';
const FOLDER_DELETE_CHANNEL: typeof FOLDER_DELETE_CHANNEL_TYPE = 'folder:delete';
const FOLDER_DELETE_PERMANENT_CHANNEL: typeof FOLDER_DELETE_PERMANENT_CHANNEL_TYPE =
  'folder:delete-permanent';
const NOTE_MOVE_CHANNEL: typeof NOTE_MOVE_CHANNEL_TYPE = 'note:move';
const FOLDER_MOVE_CHANNEL: typeof FOLDER_MOVE_CHANNEL_TYPE = 'folder:move';
const ARTIFACT_OPEN_GENERATED_MARKDOWN_CHANNEL: typeof ARTIFACT_OPEN_GENERATED_MARKDOWN_CHANNEL_TYPE =
  'artifact:open-generated-markdown';
const ARTIFACT_REVEAL_GENERATED_MARKDOWN_CHANNEL: typeof ARTIFACT_REVEAL_GENERATED_MARKDOWN_CHANNEL_TYPE =
  'artifact:reveal-generated-markdown';
const ARTIFACT_OPEN_EXPORT_ARTIFACT_CHANNEL: typeof ARTIFACT_OPEN_EXPORT_ARTIFACT_CHANNEL_TYPE =
  'artifact:open-export-artifact';
const ARTIFACT_REVEAL_EXPORT_ARTIFACT_CHANNEL: typeof ARTIFACT_REVEAL_EXPORT_ARTIFACT_CHANNEL_TYPE =
  'artifact:reveal-export-artifact';
const PREVIEW_EXPORT_HTML_CHANNEL: typeof PREVIEW_EXPORT_HTML_CHANNEL_TYPE = 'preview:export-html';
const PREVIEW_EXPORT_PDF_CHANNEL: typeof PREVIEW_EXPORT_PDF_CHANNEL_TYPE = 'preview:export-pdf';
const RESOURCE_READ_PDF_CHANNEL: typeof RESOURCE_READ_PDF_CHANNEL_TYPE = 'resource:read-pdf';
const RESOURCE_READ_HTML_CHANNEL: typeof RESOURCE_READ_HTML_CHANNEL_TYPE = 'resource:read-html';
const RESOURCE_IMPORT_CHANNEL: typeof RESOURCE_IMPORT_CHANNEL_TYPE = 'resource:import';
const RESOURCE_READ_TEXT_PREVIEW_CHANNEL: typeof RESOURCE_READ_TEXT_PREVIEW_CHANNEL_TYPE =
  'resource:read-text-preview';
const RESOURCE_READ_DOCX_PREVIEW_CHANNEL: typeof RESOURCE_READ_DOCX_PREVIEW_CHANNEL_TYPE =
  'resource:read-docx-preview';
const RESOURCE_READ_XLSX_PREVIEW_CHANNEL: typeof RESOURCE_READ_XLSX_PREVIEW_CHANNEL_TYPE =
  'resource:read-xlsx-preview';
const RESOURCE_READ_XLS_PREVIEW_CHANNEL: typeof RESOURCE_READ_XLS_PREVIEW_CHANNEL_TYPE =
  'resource:read-xls-preview';
const RESOURCE_READ_DOC_PREVIEW_CHANNEL: typeof RESOURCE_READ_DOC_PREVIEW_CHANNEL_TYPE =
  'resource:read-doc-preview';

const scholaApi: ScholaApi = Object.freeze({
  app: Object.freeze({
    getInfo: () => ipcRenderer.invoke(APP_GET_INFO_CHANNEL) as Promise<AppInfo>,
    openHelp: () => ipcRenderer.invoke(APP_OPEN_HELP_CHANNEL) as Promise<HelpOpenResult>,
    notifyRendererReady: () => {
      ipcRenderer.send(APP_RENDERER_READY_CHANNEL);
    },
    perfLog: (message: string) => {
      ipcRenderer.send(APP_PERF_LOG_CHANNEL, message);
    },
  }),
  windowControls: Object.freeze({
    minimize: () => ipcRenderer.invoke(WINDOW_MINIMIZE_CHANNEL) as Promise<void>,
    toggleMaximize: () => ipcRenderer.invoke(WINDOW_TOGGLE_MAXIMIZE_CHANNEL) as Promise<boolean>,
    close: () => ipcRenderer.invoke(WINDOW_CLOSE_CHANNEL) as Promise<void>,
    isMaximized: () => ipcRenderer.invoke(WINDOW_IS_MAXIMIZED_CHANNEL) as Promise<boolean>,
  }),
  vault: Object.freeze({
    openVault: () => ipcRenderer.invoke(VAULT_OPEN_CHANNEL) as Promise<VaultInfo | null>,
    openVaultByPath: (rootPath: string) =>
      ipcRenderer.invoke(VAULT_OPEN_BY_PATH_CHANNEL, rootPath) as Promise<VaultInfo>,
    createVault: () => ipcRenderer.invoke(VAULT_CREATE_CHANNEL) as Promise<CreateVaultResult>,
    getDroppedFilePath: (file: File): string | null => {
      try {
        return webUtils.getPathForFile(file);
      } catch {
        return null;
      }
    },
    resolvePreviewAssetUrl: (vaultId: string, noteRelativePath: string, assetPath: string) =>
      ipcRenderer.invoke(
        VAULT_RESOLVE_ASSET_URL_CHANNEL,
        vaultId,
        noteRelativePath,
        assetPath,
      ) as Promise<string>,
    scanVault: (vaultId: string) =>
      ipcRenderer.invoke(VAULT_SCAN_CHANNEL, vaultId) as Promise<readonly FileEntry[]>,
    listImageAssets: (vaultId: string) =>
      ipcRenderer.invoke(VAULT_LIST_IMAGE_ASSETS_CHANNEL, vaultId) as Promise<
        readonly ImageAsset[]
      >,
    getRecentVaults: () =>
      ipcRenderer.invoke(VAULT_GET_RECENT_CHANNEL) as Promise<readonly VaultInfo[]>,
    closeVault: (vaultId: string) =>
      ipcRenderer.invoke(VAULT_CLOSE_CHANNEL, vaultId) as Promise<void>,
    onFileEvent: (callback: (events: readonly VaultFileEvent[]) => void): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        events: readonly VaultFileEvent[],
      ): void => {
        callback(events);
      };
      ipcRenderer.on(VAULT_FILE_EVENT_CHANNEL, handler);
      return () => {
        ipcRenderer.removeListener(VAULT_FILE_EVENT_CHANNEL, handler);
      };
    },
    syncFileEvents: (vaultId: string, events: readonly VaultFileEvent[]) =>
      ipcRenderer.invoke(
        INDEX_SYNC_FILE_EVENTS_CHANNEL,
        vaultId,
        events,
      ) as Promise<IndexSyncResult>,
  }),
  note: Object.freeze({
    readNote: (vaultId: string, relativePath: string) =>
      ipcRenderer.invoke(NOTE_READ_CHANNEL, vaultId, relativePath) as Promise<NoteContent>,
    saveNote: (
      vaultId: string,
      relativePath: string,
      content: string,
      expectedHash: string | null,
    ) =>
      ipcRenderer.invoke(
        NOTE_SAVE_CHANNEL,
        vaultId,
        relativePath,
        content,
        expectedHash,
      ) as Promise<SaveNoteResult>,
    createNote: (vaultId: string, input: CreateNoteInput) =>
      ipcRenderer.invoke(NOTE_CREATE_CHANNEL, vaultId, input) as Promise<CreateNoteResult>,
    createFolder: (vaultId: string, input: CreateFolderInput) =>
      ipcRenderer.invoke(FOLDER_CREATE_CHANNEL, vaultId, input) as Promise<CreateFolderResult>,
    renameNote: (vaultId: string, input: RenameEntryInput) =>
      ipcRenderer.invoke(NOTE_RENAME_CHANNEL, vaultId, input) as Promise<RenameNoteResult>,
    renameFolder: (vaultId: string, input: RenameEntryInput) =>
      ipcRenderer.invoke(FOLDER_RENAME_CHANNEL, vaultId, input) as Promise<RenameFolderResult>,
    deleteNote: (vaultId: string, input: DeleteEntryInput) =>
      ipcRenderer.invoke(NOTE_DELETE_CHANNEL, vaultId, input) as Promise<DeleteNoteOutcome>,
    deleteNotePermanent: (vaultId: string, input: DeleteEntryInput) =>
      ipcRenderer.invoke(
        NOTE_DELETE_PERMANENT_CHANNEL,
        vaultId,
        input,
      ) as Promise<DeleteNoteOutcome>,
    deleteFolder: (vaultId: string, input: DeleteEntryInput) =>
      ipcRenderer.invoke(FOLDER_DELETE_CHANNEL, vaultId, input) as Promise<DeleteFolderOutcome>,
    deleteFolderPermanent: (vaultId: string, input: DeleteEntryInput) =>
      ipcRenderer.invoke(
        FOLDER_DELETE_PERMANENT_CHANNEL,
        vaultId,
        input,
      ) as Promise<DeleteFolderOutcome>,
    moveNote: (vaultId: string, input: MoveEntryInput) =>
      ipcRenderer.invoke(NOTE_MOVE_CHANNEL, vaultId, input) as Promise<MoveNoteResult>,
    moveFolder: (vaultId: string, input: MoveEntryInput) =>
      ipcRenderer.invoke(FOLDER_MOVE_CHANNEL, vaultId, input) as Promise<MoveFolderResult>,
  }),
  wiki: Object.freeze({
    getBacklinks: (vaultId: string, relativePath: string) =>
      ipcRenderer.invoke(
        WIKI_GET_BACKLINKS_CHANNEL,
        vaultId,
        relativePath,
      ) as Promise<GetBacklinksResult>,
    getOutgoingLinks: (vaultId: string, relativePath: string) =>
      ipcRenderer.invoke(
        WIKI_GET_OUTGOING_LINKS_CHANNEL,
        vaultId,
        relativePath,
      ) as Promise<GetOutgoingResult>,
    getUnresolvedLinks: (vaultId: string, relativePath: string) =>
      ipcRenderer.invoke(
        WIKI_GET_UNRESOLVED_LINKS_CHANNEL,
        vaultId,
        relativePath,
      ) as Promise<GetUnresolvedResult>,
  }),
  search: Object.freeze({
    query: (vaultId: string, query: string) =>
      ipcRenderer.invoke(SEARCH_QUERY_CHANNEL, vaultId, query) as Promise<SearchQueryResult>,
  }),
  index: Object.freeze({
    getStatus: (vaultId: string) =>
      ipcRenderer.invoke(INDEX_GET_STATUS_CHANNEL, vaultId) as Promise<IndexStatus>,
    rebuild: (vaultId: string) =>
      ipcRenderer.invoke(INDEX_REBUILD_CHANNEL, vaultId) as Promise<IndexRebuildResult>,
  }),
  graph: Object.freeze({
    getVaultGraph: (input: GetVaultGraphInput) =>
      ipcRenderer.invoke(
        GRAPH_GET_VAULT_GRAPH_CHANNEL,
        input.vaultId,
        input.options ?? {},
      ) as Promise<GetVaultGraphResult>,
  }),
  import: Object.freeze({
    selectSource: (input?: SelectImportSourceInput) =>
      ipcRenderer.invoke(IMPORT_SELECT_SOURCE_CHANNEL, input) as Promise<SelectImportSourceResult>,
    createJob: (input: CreateImportJobInput) =>
      ipcRenderer.invoke(IMPORT_CREATE_JOB_CHANNEL, input) as Promise<CreateImportJobOutcome>,
    getJobStatus: (vaultId: string, jobId: string) =>
      ipcRenderer.invoke(
        IMPORT_GET_JOB_STATUS_CHANNEL,
        vaultId,
        jobId,
      ) as Promise<GetImportJobStatusResult>,
    listJobs: (vaultId: string) =>
      ipcRenderer.invoke(IMPORT_LIST_JOBS_CHANNEL, vaultId) as Promise<ListImportJobsResult>,
    cancelJob: (vaultId: string, jobId: string) =>
      ipcRenderer.invoke(
        IMPORT_CANCEL_JOB_CHANNEL,
        vaultId,
        jobId,
      ) as Promise<CancelImportJobResult>,
    getAvailableModes: () =>
      ipcRenderer.invoke(IMPORT_GET_AVAILABLE_MODES_CHANNEL) as Promise<GetAvailableModesResult>,
    openOriginalFile: (vaultId: string, originalFileRef: string) =>
      ipcRenderer.invoke(
        IMPORT_OPEN_ORIGINAL_FILE_CHANNEL,
        vaultId,
        originalFileRef,
      ) as Promise<OpenOriginalImportFileResult>,
    revealOriginalFile: (vaultId: string, originalFileRef: string) =>
      ipcRenderer.invoke(
        IMPORT_REVEAL_ORIGINAL_FILE_CHANNEL,
        vaultId,
        originalFileRef,
      ) as Promise<RevealOriginalImportFileResult>,
  }),
  export: Object.freeze({
    createJob: (input: CreateExportJobInput) =>
      ipcRenderer.invoke(EXPORT_CREATE_JOB_CHANNEL, input) as Promise<CreateExportJobOutcome>,
    getJobStatus: (vaultId: string, jobId: string) =>
      ipcRenderer.invoke(
        EXPORT_GET_JOB_STATUS_CHANNEL,
        vaultId,
        jobId,
      ) as Promise<GetExportJobStatusResult>,
    listJobs: (vaultId: string) =>
      ipcRenderer.invoke(EXPORT_LIST_JOBS_CHANNEL, vaultId) as Promise<ListExportJobsResult>,
    cancelJob: (vaultId: string, jobId: string) =>
      ipcRenderer.invoke(
        EXPORT_CANCEL_JOB_CHANNEL,
        vaultId,
        jobId,
      ) as Promise<CancelExportJobResult>,
  }),
  artifact: Object.freeze({
    openGeneratedMarkdown: (vaultId: string, relativePath: string) =>
      ipcRenderer.invoke(
        ARTIFACT_OPEN_GENERATED_MARKDOWN_CHANNEL,
        vaultId,
        relativePath,
      ) as Promise<ArtifactOpenResult>,
    revealGeneratedMarkdown: (vaultId: string, relativePath: string) =>
      ipcRenderer.invoke(
        ARTIFACT_REVEAL_GENERATED_MARKDOWN_CHANNEL,
        vaultId,
        relativePath,
      ) as Promise<ArtifactOpenResult>,
    openExportArtifact: (vaultId: string, relativePath: string) =>
      ipcRenderer.invoke(
        ARTIFACT_OPEN_EXPORT_ARTIFACT_CHANNEL,
        vaultId,
        relativePath,
      ) as Promise<ArtifactOpenResult>,
    revealExportArtifact: (vaultId: string, relativePath: string) =>
      ipcRenderer.invoke(
        ARTIFACT_REVEAL_EXPORT_ARTIFACT_CHANNEL,
        vaultId,
        relativePath,
      ) as Promise<ArtifactOpenResult>,
  }),
  // Phase 4-0-CODE-QUALITY-IMP-1: Runtime Pack disabled stubs.
  // IPC handlers not registered — all calls return safe failure.
  // Re-evaluate when Plugin Manager design phase begins (Phase 4-0-D).
  runtime: Object.freeze({
    listPacks: () => Promise.resolve({ ok: true, packs: [] }) as Promise<ListRuntimePacksResult>,
    getStatus: () => Promise.resolve({ ok: false, status: null }),
    install: () =>
      Promise.resolve({
        ok: false,
        message: 'Runtime Pack 已暂停。后续版本开放。',
      } as InstallRuntimePackResult),
    cancelInstall: () => Promise.resolve({ ok: false } as CancelInstallRuntimePackResult),
    uninstall: () => Promise.resolve({ ok: false } as UninstallRuntimePackResult),
    enable: () => Promise.resolve({ ok: false } as ToggleRuntimePackResult),
    disable: () => Promise.resolve({ ok: false } as ToggleRuntimePackResult),
    probe: () => Promise.resolve({ ok: false, available: false } as ProbeRuntimePackResult),
    diagnose: () => Promise.resolve({ ok: false, checks: [] } as DiagnoseRuntimePackResult),
    clearCache: () => Promise.resolve({ ok: false, freedDiskMb: 0 } as ClearRuntimePackCacheResult),
    exportDiagnostics: () =>
      Promise.resolve({ ok: false, saved: false } as ExportDiagnosticsResult),
  }),
  previewExport: Object.freeze({
    exportHtml: (input: PreviewExportInput) =>
      ipcRenderer.invoke(PREVIEW_EXPORT_HTML_CHANNEL, input) as Promise<PreviewExportResult>,
    exportPdf: (input: PreviewExportInput) =>
      ipcRenderer.invoke(PREVIEW_EXPORT_PDF_CHANNEL, input) as Promise<PreviewExportResult>,
  }),
  resource: Object.freeze({
    readPdf: (input: ReadPdfResourceInput) =>
      ipcRenderer.invoke(RESOURCE_READ_PDF_CHANNEL, input) as Promise<ReadPdfResourceResult>,
    readHtml: (input: ReadHtmlResourceInput) =>
      ipcRenderer.invoke(RESOURCE_READ_HTML_CHANNEL, input) as Promise<ReadHtmlResourceResult>,
    importResource: (input: ImportResourceInput) =>
      ipcRenderer.invoke(RESOURCE_IMPORT_CHANNEL, input) as Promise<ImportResourceResult>,
    readTextPreview: (input: ReadTextPreviewInput) =>
      ipcRenderer.invoke(
        RESOURCE_READ_TEXT_PREVIEW_CHANNEL,
        input,
      ) as Promise<ReadTextPreviewResult>,
    readDocxPreview: (input: ReadDocxPreviewInput) =>
      ipcRenderer.invoke(
        RESOURCE_READ_DOCX_PREVIEW_CHANNEL,
        input,
      ) as Promise<ReadDocxPreviewResult>,
    readXlsxPreview: (input: ReadXlsxPreviewInput) =>
      ipcRenderer.invoke(
        RESOURCE_READ_XLSX_PREVIEW_CHANNEL,
        input,
      ) as Promise<ReadXlsxPreviewResult>,
    readXlsPreview: (input: ReadXlsPreviewInput) =>
      ipcRenderer.invoke(RESOURCE_READ_XLS_PREVIEW_CHANNEL, input) as Promise<ReadXlsPreviewResult>,
    readDocPreview: (input: ReadDocPreviewInput) =>
      ipcRenderer.invoke(RESOURCE_READ_DOC_PREVIEW_CHANNEL, input) as Promise<ReadDocPreviewResult>,
  }),
  aiResearch: Object.freeze<ScholaAIResearchApi>({
    getProviderReadiness: (providerId?: string) =>
      ipcRenderer.invoke(AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL, providerId ?? null) as Promise<
        readonly ProviderReadiness[]
      >,
    buildContextPack: (input: BuildContextPackInput) =>
      ipcRenderer.invoke(
        AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL,
        input,
      ) as Promise<ResearchContextPreview>,
    previewContextPack: (contextPackId: string) =>
      ipcRenderer.invoke(
        AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL,
        contextPackId,
      ) as Promise<ResearchContextPreview>,
    confirmContextPack: (input: ConfirmContextPackInput) =>
      ipcRenderer.invoke(
        AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL,
        input,
      ) as Promise<ContextConfirmationSnapshot>,
    createTaskDraft: (input: CreateTaskDraftInput) =>
      ipcRenderer.invoke(
        AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL,
        input,
      ) as Promise<AIResearchTaskStatus>,
    runConfirmedTask: (input: RunConfirmedTaskInput) =>
      ipcRenderer.invoke(
        AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
        input,
      ) as Promise<AIResearchTaskStatus>,
    cancelTask: (input: CancelTaskInput) =>
      ipcRenderer.invoke(AI_RESEARCH_CANCEL_TASK_CHANNEL, input) as Promise<AIResearchTaskStatus>,
    getTaskStatus: (taskId: string) =>
      ipcRenderer.invoke(
        AI_RESEARCH_GET_TASK_STATUS_CHANNEL,
        taskId,
      ) as Promise<AIResearchTaskStatus>,
    getTaskResult: (taskId: string) =>
      ipcRenderer.invoke(
        AI_RESEARCH_GET_TASK_RESULT_CHANNEL,
        taskId,
      ) as Promise<AIResearchTaskResult>,
    clearTaskResult: (taskId: string) =>
      ipcRenderer.invoke(AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL, taskId) as Promise<void>,
    discardArtifact: (artifactId: string) =>
      ipcRenderer.invoke(AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL, artifactId) as Promise<void>,
    saveArtifactDraft: (input: SaveArtifactDraftInput) =>
      ipcRenderer.invoke(
        AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL,
        input,
      ) as Promise<SaveArtifactDraftResult>,
    subscribeTask: (taskId: string, callbacks: SubscribeTaskCallbacks): (() => void) => {
      const safeTaskId = String(taskId);
      const chunkHandler = (_event: Electron.IpcRendererEvent, chunk: ChatChunk): void => {
        if (chunk.taskId !== safeTaskId || chunk.type !== 'content') return;
        callbacks.onChunk?.(chunk);
      };
      const doneHandler = (_event: Electron.IpcRendererEvent, chunk: ChatChunk): void => {
        if (chunk.taskId !== safeTaskId || chunk.type !== 'done') return;
        callbacks.onDone?.(chunk);
      };
      const errorHandler = (_event: Electron.IpcRendererEvent, chunk: ChatChunk): void => {
        if (chunk.taskId !== safeTaskId || chunk.type !== 'error') return;
        callbacks.onError?.(chunk);
      };

      ipcRenderer.on(AI_RESEARCH_TASK_CHUNK_EVENT, chunkHandler);
      ipcRenderer.on(AI_RESEARCH_TASK_DONE_EVENT, doneHandler);
      ipcRenderer.on(AI_RESEARCH_TASK_ERROR_EVENT, errorHandler);

      return () => {
        ipcRenderer.removeListener(AI_RESEARCH_TASK_CHUNK_EVENT, chunkHandler);
        ipcRenderer.removeListener(AI_RESEARCH_TASK_DONE_EVENT, doneHandler);
        ipcRenderer.removeListener(AI_RESEARCH_TASK_ERROR_EVENT, errorHandler);
      };
    },
  }),
  settings: Object.freeze<ScholaSettingsApi>({
    getProviderPresets: () =>
      ipcRenderer.invoke(SETTINGS_GET_PROVIDER_PRESETS_CHANNEL) as Promise<
        readonly ProviderPreset[]
      >,
    getProviderConfigs: () =>
      ipcRenderer.invoke(SETTINGS_GET_PROVIDER_CONFIGS_CHANNEL) as Promise<
        readonly ProviderConfig[]
      >,
    setProviderConfig: (providerId: string, config: Partial<ProviderConfig>) =>
      ipcRenderer.invoke(
        SETTINGS_SET_PROVIDER_CONFIG_CHANNEL,
        providerId,
        config,
      ) as Promise<ProviderConfig>,
    getProviderModels: (providerId: string) =>
      ipcRenderer.invoke(SETTINGS_GET_PROVIDER_MODELS_CHANNEL, providerId) as Promise<
        readonly AIModelInfo[]
      >,
    fetchProviderModels: (input: FetchProviderModelsInput) =>
      ipcRenderer.invoke(
        SETTINGS_FETCH_PROVIDER_MODELS_CHANNEL,
        input,
      ) as Promise<FetchProviderModelsResult>,
    testProviderLatency: (input: TestProviderLatencyInput) =>
      ipcRenderer.invoke(
        SETTINGS_TEST_PROVIDER_LATENCY_CHANNEL,
        input,
      ) as Promise<TestProviderLatencyResult>,
    getApiKeyStatus: (providerId?: string) =>
      ipcRenderer.invoke(SETTINGS_GET_API_KEY_STATUS_CHANNEL, providerId ?? null) as Promise<
        readonly MaskedSecretStatus[]
      >,
    setApiKey: (providerId: string, key: string) =>
      ipcRenderer.invoke(
        SETTINGS_SET_API_KEY_CHANNEL,
        providerId,
        key,
      ) as Promise<MaskedSecretStatus>,
    clearApiKey: (providerId: string) =>
      ipcRenderer.invoke(SETTINGS_CLEAR_API_KEY_CHANNEL, providerId) as Promise<MaskedSecretStatus>,
    getPrivacyConsent: () =>
      ipcRenderer.invoke(
        SETTINGS_GET_PRIVACY_CONSENT_CHANNEL,
      ) as Promise<PrivacyConsentState | null>,
    setPrivacyConsent: (consent: PrivacyConsentState) =>
      ipcRenderer.invoke(
        SETTINGS_SET_PRIVACY_CONSENT_CHANNEL,
        consent,
      ) as Promise<PrivacyConsentState>,
    getContextSendPolicy: () =>
      ipcRenderer.invoke(SETTINGS_GET_CONTEXT_SEND_POLICY_CHANNEL) as Promise<ContextSendPolicy>,
    setContextSendPolicy: (policy: ContextSendPolicy) =>
      ipcRenderer.invoke(
        SETTINGS_SET_CONTEXT_SEND_POLICY_CHANNEL,
        policy,
      ) as Promise<ContextSendPolicy>,
    getAIPreferences: () =>
      ipcRenderer.invoke(SETTINGS_GET_AI_PREFERENCES_CHANNEL) as Promise<AIPreferences>,
    setAIPreferences: (prefs: Partial<AIPreferences>) =>
      ipcRenderer.invoke(SETTINGS_SET_AI_PREFERENCES_CHANNEL, prefs) as Promise<AIPreferences>,
    getConfirmationLog: (limit?: number) =>
      ipcRenderer.invoke(SETTINGS_GET_CONFIRMATION_LOG_CHANNEL, limit ?? null) as Promise<
        readonly ConfirmationLogEntry[]
      >,
  }),
  // Phase 5-3-IMP: Menu IPC listener API — fixed-function, no generic invoke
  menu: Object.freeze({
    onNavigate: (callback: (payload: ScholaMenuPayload) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: ScholaMenuPayload): void => {
        callback(payload);
      };
      ipcRenderer.on('schola:navigate', handler);
      ipcRenderer.on('schola:action', handler);
      ipcRenderer.on('schola:view:toggle', handler);
      ipcRenderer.on('schola:graph:scope', handler);
      ipcRenderer.on('schola:graph:layout', handler);
      ipcRenderer.on('schola:graph:action', handler);
      return () => {
        ipcRenderer.removeListener('schola:navigate', handler);
        ipcRenderer.removeListener('schola:action', handler);
        ipcRenderer.removeListener('schola:view:toggle', handler);
        ipcRenderer.removeListener('schola:graph:scope', handler);
        ipcRenderer.removeListener('schola:graph:layout', handler);
        ipcRenderer.removeListener('schola:graph:action', handler);
      };
    },
  }),
});

contextBridge.exposeInMainWorld('schola', scholaApi);
