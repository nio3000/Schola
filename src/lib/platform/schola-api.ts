import type { AppInfo, HelpOpenResult } from '../contracts/app.types';
import type {
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
  NoteContent,
  RenameEntryInput,
  RenameFolderResult,
  RenameNoteResult,
  SaveNoteResult,
} from '../contracts/note.types';
import type { CreateVaultResult, FileEntry, ImageAsset, IndexSyncResult, VaultFileEvent, VaultInfo } from '../contracts/vault.types';
import type { IndexStatus, IndexRebuildResult } from '../contracts/index-status.types';

export async function getAppInfo(): Promise<AppInfo> {
  return window.schola.app.getInfo();
}

export async function openVault(): Promise<VaultInfo | null> {
  return window.schola.vault.openVault();
}

export async function createVault(): Promise<CreateVaultResult> {
  return window.schola.vault.createVault();
}

export async function openHelp(): Promise<HelpOpenResult> {
  return window.schola.app.openHelp();
}

export function notifyRendererReady(): void {
  window.schola.app.notifyRendererReady();
}

export function perfLogMessage(message: string): void {
  window.schola.app.perfLog(message);
}

export async function minimizeWindow(): Promise<void> {
  return window.schola.windowControls.minimize();
}

export async function toggleMaximizeWindow(): Promise<boolean> {
  return window.schola.windowControls.toggleMaximize();
}

export async function closeWindow(): Promise<void> {
  return window.schola.windowControls.close();
}

export async function isWindowMaximized(): Promise<boolean> {
  return window.schola.windowControls.isMaximized();
}

export async function openVaultByPath(rootPath: string): Promise<VaultInfo> {
  return window.schola.vault.openVaultByPath(rootPath);
}

export function getDroppedFilePath(file: File): string | null {
  return window.schola.vault.getDroppedFilePath(file);
}

export async function resolvePreviewAssetUrl(
  vaultId: string,
  noteRelativePath: string,
  assetPath: string,
): Promise<string> {
  return window.schola.vault.resolvePreviewAssetUrl(vaultId, noteRelativePath, assetPath);
}

export async function listImageAssets(vaultId: string): Promise<readonly ImageAsset[]> {
  return window.schola.vault.listImageAssets(vaultId);
}

export async function scanVault(vaultId: string): Promise<readonly FileEntry[]> {
  return window.schola.vault.scanVault(vaultId);
}

export async function getRecentVaults(): Promise<readonly VaultInfo[]> {
  return window.schola.vault.getRecentVaults();
}

export async function closeVault(vaultId: string): Promise<void> {
  return window.schola.vault.closeVault(vaultId);
}

export function onVaultFileEvent(
  callback: (events: readonly VaultFileEvent[]) => void,
): () => void {
  if (typeof window.schola?.vault?.onFileEvent !== 'function') {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[schola-api] onFileEvent is not available — preload may be outdated.');
    }
    return () => {};
  }
  return window.schola.vault.onFileEvent(callback);
}

export async function readNote(vaultId: string, relativePath: string): Promise<NoteContent> {
  return window.schola.note.readNote(vaultId, relativePath);
}

export async function saveNote(
  vaultId: string,
  relativePath: string,
  content: string,
  expectedHash: string | null,
): Promise<SaveNoteResult> {
  return window.schola.note.saveNote(vaultId, relativePath, content, expectedHash);
}

export async function createNote(vaultId: string, input: CreateNoteInput): Promise<CreateNoteResult> {
  return window.schola.note.createNote(vaultId, input);
}

export async function createFolder(vaultId: string, input: CreateFolderInput): Promise<CreateFolderResult> {
  return window.schola.note.createFolder(vaultId, input);
}

export async function renameNote(vaultId: string, input: RenameEntryInput): Promise<RenameNoteResult> {
  return window.schola.note.renameNote(vaultId, input);
}

export async function renameFolder(vaultId: string, input: RenameEntryInput): Promise<RenameFolderResult> {
  return window.schola.note.renameFolder(vaultId, input);
}

export async function deleteNote(vaultId: string, input: DeleteEntryInput): Promise<DeleteNoteOutcome> {
  return window.schola.note.deleteNote(vaultId, input);
}

export async function deleteNotePermanent(vaultId: string, input: DeleteEntryInput): Promise<DeleteNoteOutcome> {
  return window.schola.note.deleteNotePermanent(vaultId, input);
}

export async function deleteFolder(vaultId: string, input: DeleteEntryInput): Promise<DeleteFolderOutcome> {
  return window.schola.note.deleteFolder(vaultId, input);
}

export async function deleteFolderPermanent(vaultId: string, input: DeleteEntryInput): Promise<DeleteFolderOutcome> {
  return window.schola.note.deleteFolderPermanent(vaultId, input);
}

export async function moveNote(vaultId: string, input: MoveEntryInput): Promise<MoveNoteResult> {
  return window.schola.note.moveNote(vaultId, input);
}

export async function moveFolder(vaultId: string, input: MoveEntryInput): Promise<MoveFolderResult> {
  return window.schola.note.moveFolder(vaultId, input);
}

// ── SQLite query wrappers (Retrofit-4-A) ──

import type { GetBacklinksResult, GetOutgoingResult, GetUnresolvedResult } from '../contracts/wiki-query.types';
import type { SearchQueryResult } from '../contracts/search-query.types';

declare global {
  interface Window {
    __scholaSearchQueryOverride__?: (vaultId: string, query: string) => Promise<SearchQueryResult>;
    __scholaGetBacklinksOverride__?: (vaultId: string, relativePath: string) => Promise<GetBacklinksResult>;
    __scholaGetOutgoingLinksOverride__?: (vaultId: string, relativePath: string) => Promise<GetOutgoingResult>;
    __scholaGetUnresolvedLinksOverride__?: (vaultId: string, relativePath: string) => Promise<GetUnresolvedResult>;
    __scholaRebuildOverride__?: (vaultId: string) => Promise<IndexRebuildResult>;
    /** E2E probe: true when override seam is active (non-production builds). */
    readonly __scholaE2EOverrideEnabled__?: true;
  }
}

/**
 * E2E override seam: gated to non-production modes.
 * `import.meta.env.MODE` is set by Vite at build time:
 *   - `vite` (dev server)      → MODE === 'development'
 *   - `vite build --mode development` → MODE === 'development'
 *   - `vite build`              → MODE === 'production'
 * In production builds the override stubs are ignored.
 */
const allowE2EOverride = import.meta.env.MODE !== 'production';

// Set the E2E probe so tests can assert override availability before patching.
if (allowE2EOverride) {
  (window as unknown as Record<string, unknown>).__scholaE2EOverrideEnabled__ = true;
}

export async function getSqliteBacklinks(vaultId: string, relativePath: string): Promise<GetBacklinksResult> {
  if (allowE2EOverride && window.__scholaGetBacklinksOverride__) {
    return window.__scholaGetBacklinksOverride__(vaultId, relativePath);
  }
  return window.schola.wiki.getBacklinks(vaultId, relativePath);
}

export async function getSqliteOutgoingLinks(vaultId: string, relativePath: string): Promise<GetOutgoingResult> {
  if (allowE2EOverride && window.__scholaGetOutgoingLinksOverride__) {
    return window.__scholaGetOutgoingLinksOverride__(vaultId, relativePath);
  }
  return window.schola.wiki.getOutgoingLinks(vaultId, relativePath);
}

export async function getSqliteUnresolvedLinks(vaultId: string, relativePath: string): Promise<GetUnresolvedResult> {
  if (allowE2EOverride && window.__scholaGetUnresolvedLinksOverride__) {
    return window.__scholaGetUnresolvedLinksOverride__(vaultId, relativePath);
  }
  return window.schola.wiki.getUnresolvedLinks(vaultId, relativePath);
}

export async function sqliteSearch(vaultId: string, query: string): Promise<SearchQueryResult> {
  if (allowE2EOverride && window.__scholaSearchQueryOverride__) {
    return window.__scholaSearchQueryOverride__(vaultId, query);
  }

  return window.schola.search.query(vaultId, query);
}

/** Sync watcher file events to SQLite index (Retrofit-4-D-P1-QA3). */
export async function syncFileEvents(
  vaultId: string,
  events: readonly VaultFileEvent[],
): Promise<IndexSyncResult> {
  return window.schola.vault.syncFileEvents(vaultId, events);
}

// ── Index status & rebuild (Retrofit-5-A) ──

export async function getIndexStatus(vaultId: string): Promise<IndexStatus> {
  return window.schola.index.getStatus(vaultId);
}

export async function rebuildIndex(vaultId: string): Promise<IndexRebuildResult> {
  if (allowE2EOverride && window.__scholaRebuildOverride__) {
    return window.__scholaRebuildOverride__(vaultId);
  }
  return window.schola.index.rebuild(vaultId);
}

// ── Graph query (Phase 2-D-1) ──

import type { GetVaultGraphInput, GetVaultGraphResult } from '../contracts/graph-query.types';

export async function getVaultGraph(input: GetVaultGraphInput): Promise<GetVaultGraphResult> {
  return window.schola.graph.getVaultGraph(input);
}

// ── Import (Phase 3-1-B) ──

import type {
  CreateImportJobInput,
  CreateImportJobOutcome,
  GetImportJobStatusResult,
  SelectImportSourceResult,
  SelectImportSourceInput,
  GetAvailableModesResult,
  OpenOriginalImportFileResult,
  RevealOriginalImportFileResult,
} from '../contracts/import-job.types';

export async function selectImportSource(input?: SelectImportSourceInput): Promise<SelectImportSourceResult> {
  return window.schola.import.selectSource(input);
}

export async function createImportJob(input: CreateImportJobInput): Promise<CreateImportJobOutcome> {
  return window.schola.import.createJob(input);
}

export async function getImportJobStatus(vaultId: string, jobId: string): Promise<GetImportJobStatusResult> {
  return window.schola.import.getJobStatus(vaultId, jobId);
}

export async function getAvailableImportModes(): Promise<GetAvailableModesResult> {
  return window.schola.import.getAvailableModes();
}

export async function openOriginalImportFile(vaultId: string, originalFileRef: string): Promise<OpenOriginalImportFileResult> {
  return window.schola.import.openOriginalFile(vaultId, originalFileRef);
}

export async function revealOriginalImportFile(vaultId: string, originalFileRef: string): Promise<RevealOriginalImportFileResult> {
  return window.schola.import.revealOriginalFile(vaultId, originalFileRef);
}

// ── Export (Phase 3-1-C) ──

import type {
  CreateExportJobInput,
  CreateExportJobOutcome,
  GetExportJobStatusResult,
} from '../contracts/export-job.types';

export async function createExportJob(input: CreateExportJobInput): Promise<CreateExportJobOutcome> {
  return window.schola.export.createJob(input);
}

export async function getExportJobStatus(vaultId: string, jobId: string): Promise<GetExportJobStatusResult> {
  return window.schola.export.getJobStatus(vaultId, jobId);
}

// ── Artifact open/reveal (Phase 3-2) ──

import type { ArtifactOpenResult } from '../contracts/artifact.types';

export async function openGeneratedMarkdown(vaultId: string, relativePath: string): Promise<ArtifactOpenResult> {
  return window.schola.artifact.openGeneratedMarkdown(vaultId, relativePath);
}

export async function revealGeneratedMarkdown(vaultId: string, relativePath: string): Promise<ArtifactOpenResult> {
  return window.schola.artifact.revealGeneratedMarkdown(vaultId, relativePath);
}

export async function openExportArtifact(vaultId: string, relativePath: string): Promise<ArtifactOpenResult> {
  return window.schola.artifact.openExportArtifact(vaultId, relativePath);
}

export async function revealExportArtifact(vaultId: string, relativePath: string): Promise<ArtifactOpenResult> {
  return window.schola.artifact.revealExportArtifact(vaultId, relativePath);
}

// ── Runtime Pack API (Phase 3-4-G3-C) ───────────

import type {
  ListRuntimePacksResult,
  GetRuntimePackStatusResult,
  InstallRuntimePackInput,
  InstallRuntimePackResult,
  CancelInstallRuntimePackResult,
  UninstallRuntimePackInput,
  UninstallRuntimePackResult,
  ToggleRuntimePackResult,
  ProbeRuntimePackResult,
  DiagnoseRuntimePackInput,
  DiagnoseRuntimePackResult,
  ClearRuntimePackCacheResult,
  ExportDiagnosticsInput,
  ExportDiagnosticsResult,
  RuntimePackId,
} from '../contracts/runtime-pack.types';

function getRuntime(): typeof window.schola.runtime {
  if (!window.schola?.runtime) {
    throw new Error('Runtime Pack API is not available');
  }
  return window.schola.runtime;
}

export async function listRuntimePacks(): Promise<ListRuntimePacksResult> {
  return getRuntime().listPacks();
}

export async function getRuntimePackStatus(packId: RuntimePackId): Promise<GetRuntimePackStatusResult> {
  return getRuntime().getStatus(packId);
}

export async function installRuntimePack(input: InstallRuntimePackInput): Promise<InstallRuntimePackResult> {
  return getRuntime().install(input);
}

export async function cancelInstallRuntimePack(packId: RuntimePackId): Promise<CancelInstallRuntimePackResult> {
  return getRuntime().cancelInstall(packId);
}

export async function uninstallRuntimePack(input: UninstallRuntimePackInput): Promise<UninstallRuntimePackResult> {
  return getRuntime().uninstall(input);
}

export async function enableRuntimePack(packId: RuntimePackId): Promise<ToggleRuntimePackResult> {
  return getRuntime().enable(packId);
}

export async function disableRuntimePack(packId: RuntimePackId): Promise<ToggleRuntimePackResult> {
  return getRuntime().disable(packId);
}

export async function probeRuntimePack(packId: RuntimePackId): Promise<ProbeRuntimePackResult> {
  return getRuntime().probe(packId);
}

export async function diagnoseRuntimePack(input: DiagnoseRuntimePackInput): Promise<DiagnoseRuntimePackResult> {
  return getRuntime().diagnose(input);
}

export async function clearRuntimePackCache(packId: RuntimePackId): Promise<ClearRuntimePackCacheResult> {
  return getRuntime().clearCache(packId);
}

export async function exportRuntimePackDiagnostics(input: ExportDiagnosticsInput): Promise<ExportDiagnosticsResult> {
  return getRuntime().exportDiagnostics(input);
}

// ── Preview Export (Phase 4-0-P0-UI-EXPORT) ─────

import type { PreviewExportInput, PreviewExportResult } from '../contracts/preview-export.types';

function getPreviewExport(): typeof window.schola.previewExport {
  if (!window.schola?.previewExport) {
    throw new Error('Preview export API not available');
  }
  return window.schola.previewExport;
}

export async function previewExportHtml(input: PreviewExportInput): Promise<PreviewExportResult> {
  return getPreviewExport().exportHtml(input);
}

export async function previewExportPdf(input: PreviewExportInput): Promise<PreviewExportResult> {
  return getPreviewExport().exportPdf(input);
}

// ── Resource API (Phase 5-4A-IMP-3) ──

import type { ReadPdfResourceInput, ReadPdfResourceResult, ReadHtmlResourceInput, ReadHtmlResourceResult, ImportResourceInput, ImportResourceResult, ReadTextPreviewInput, ReadTextPreviewResult, ReadDocxPreviewInput, ReadDocxPreviewResult, ReadXlsxPreviewInput, ReadXlsxPreviewResult, ReadXlsPreviewInput, ReadXlsPreviewResult, ReadDocPreviewInput, ReadDocPreviewResult } from '../contracts/resource.types';

function getResourceApi(): typeof window.schola.resource {
  if (!window.schola?.resource) {
    throw new Error('Resource API not available');
  }
  return window.schola.resource;
}

export async function readPdfResource(input: ReadPdfResourceInput): Promise<ReadPdfResourceResult> {
  return getResourceApi().readPdf(input);
}

export async function readHtmlResource(input: ReadHtmlResourceInput): Promise<ReadHtmlResourceResult> {
  return getResourceApi().readHtml(input);
}

export async function importResource(input: ImportResourceInput): Promise<ImportResourceResult> {
  return getResourceApi().importResource(input);
}

export async function readTextPreview(input: ReadTextPreviewInput): Promise<ReadTextPreviewResult> {
  return getResourceApi().readTextPreview(input);
}

export async function readDocxPreview(input: ReadDocxPreviewInput): Promise<ReadDocxPreviewResult> {
  return getResourceApi().readDocxPreview(input);
}

export async function readXlsxPreview(input: ReadXlsxPreviewInput): Promise<ReadXlsxPreviewResult> {
  return getResourceApi().readXlsxPreview(input);
}

export async function readXlsPreview(input: ReadXlsPreviewInput): Promise<ReadXlsPreviewResult> {
  return getResourceApi().readXlsPreview(input);
}

export async function readDocPreview(input: ReadDocPreviewInput): Promise<ReadDocPreviewResult> {
  return getResourceApi().readDocPreview(input);
}
