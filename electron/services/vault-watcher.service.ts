import type { WebContents } from 'electron';
import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import fs from 'node:fs';
import path from 'node:path';
import { VAULT_FILE_EVENT_CHANNEL, type FileEntry, type FileKind, type VaultFileEvent } from '../../src/lib/contracts/vault.types';
import { toVaultRelativePath } from '../security/path-guard';
import { getIndexDbForVault } from './index-db.service';
import { scanVault } from './vault.service';

// Excluded system directories (Phase 3-1-A): shared with path-guard and vault.service.
// Hard-coded patterns here because chokidar's `ignored` accepts RegExp, not Set<string>.
const EXCLUDED_DIR_PATTERNS: RegExp[] = [
  /(^|[\/\\])\./,           // hidden files/dirs (.git, .schola, etc.)
  /node_modules/,
  /dist-electron/,
  /dist/,
  /test-results/,
  /\.sisyphus/,
  /\.opencode/,
  /\.playwright-mcp/,
  /(^|[\/\\])_exports([\/\\]|$)/,   // Phase 3-1-A: export artifacts
  /(^|[\/\\])_trash([\/\\]|$)/,     // Phase 3-1-A: soft-delete recycle bin
];

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp']);

const DEBOUNCE_MS = 300;
const MAX_PENDING_EVENTS = 500;

interface ActiveWatcher {
  readonly vaultId: string;
  readonly rootPath: string;
  readonly watcher: FSWatcher;
  readonly webContents: WebContents;
  readonly fileKindCache: Map<string, FileKind>;
  pendingEvents: VaultFileEvent[];
  flushTimer: ReturnType<typeof setTimeout> | null;
  // Phase 4-4-B: cached fileTree for incremental index updates.
  // Populated on first full rebuild; refreshed on structural changes.
  cachedFileTree: readonly FileEntry[] | null;
}

const watchers = new Map<string, ActiveWatcher>();

/** Look up the vault root path (needed by the index-sync IPC handler). */
export function getVaultRootPath(vaultId: string): string | null {
  return watchers.get(vaultId)?.rootPath ?? null;
}

function classifyFile(fileName: string): FileKind {
  const ext = path.posix.extname(fileName).toLowerCase();
  if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return 'other';
}

function isTemporaryFile(name: string): boolean {
  return (
    name.endsWith('~') ||
    name.endsWith('.tmp') ||
    name.endsWith('.swp') ||
    name.endsWith('.swo') ||
    name === '.DS_Store' ||
    name === 'Thumbs.db' ||
    name === 'desktop.ini'
  );
}

function deduplicateEvents(events: readonly VaultFileEvent[]): VaultFileEvent[] {
  const byKey = new Map<string, VaultFileEvent>();

  for (const event of events) {
    const key =
      'fileKind' in event
        ? `${event.type}:${event.relativePath}`
        : `${event.type}:${event.relativePath}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, event);
      continue;
    }

    // Merge rules: same (type, path) pair
    if (existing.type === event.type) {
      continue; // duplicate — keep first
    }

    // add + change → keep add
    if (existing.type === 'file-added' && event.type === 'file-changed') {
      continue;
    }
    if (existing.type === 'file-changed' && event.type === 'file-added') {
      byKey.set(key, event);
      continue;
    }

    // add + delete → cancel both
    if (
      (existing.type === 'file-added' && event.type === 'file-deleted') ||
      (existing.type === 'file-deleted' && event.type === 'file-added')
    ) {
      byKey.delete(key);
      continue;
    }

    // delete + add → replace with file-changed
    if (existing.type === 'file-deleted' && event.type === 'file-added') {
      if ('fileKind' in existing && 'fileKind' in event) {
        byKey.set(key, {
          type: 'file-changed' as const,
          relativePath: event.relativePath,
          fileKind: event.fileKind,
        });
      }
      continue;
    }
  }

  // If a folder-deleted event exists, remove all file events under that directory
  const deletedFolders = [...byKey.values()].filter((e) => e.type === 'folder-deleted');
  for (const folderEvent of deletedFolders) {
    const prefix = `${folderEvent.relativePath}/`;
    for (const [key, event] of byKey) {
      if ('relativePath' in event && event.relativePath.startsWith(prefix)) {
        byKey.delete(key);
      }
    }
  }

  return [...byKey.values()];
}

/**
 * Phase 4-4-B: Set the cached fileTree for a vault.
 * Called after initial SQLite index rebuild to populate the cache,
 * so subsequent incremental watcher events don't need full rescans.
 */
export function setCachedFileTree(vaultId: string, fileTree: readonly FileEntry[]): void {
  const entry = watchers.get(vaultId);
  if (entry) {
    entry.cachedFileTree = fileTree;
  }
}

/**
 * Apply a batch of markdown file events to the SQLite index.
 * Shared by both the awaitable frontend sync IPC path and the
 * fire-and-forget backend watcher path.
 *
 * Phase 4-4-B: Uses cached fileTree from the initial rebuild instead of
 * scanning the full vault on every event batch. Falls back to scanVault
 * only when the cache is not yet populated (first use).
 *
 * Phase: Retrofit-4-D / 6-B (dedup)
 */
async function applyMarkdownEventsToSqliteIndex(
  vaultId: string,
  rootPath: string,
  events: readonly VaultFileEvent[],
): Promise<{ syncedCount: number; errorCount: number }> {
  const svc = getIndexDbForVault(vaultId);
  if (!svc) return { syncedCount: 0, errorCount: 0 };

  // Phase 4-4-B: use cached fileTree from initial rebuild.
  // Only fall back to full scanVault when cache is missing.
  const entry = watchers.get(vaultId);
  let fileTree = entry?.cachedFileTree ?? null;

  if (!fileTree) {
    try {
      fileTree = await scanVault(vaultId);
      // Populate cache for future use
      if (entry) entry.cachedFileTree = fileTree;
    } catch {
      return { syncedCount: 0, errorCount: 0 };
    }
  }

  let synced = 0;
  let errors = 0;

  for (const event of events) {
    if (event.type === 'folder-deleted') {
      try {
        svc.removeWikiFolder(event.relativePath);
        svc.removeSearchFolder(event.relativePath);
        synced += 1;
      } catch { errors += 1; }
      continue;
    }

    if (!('fileKind' in event) || event.fileKind !== 'markdown') continue;

    const { relativePath } = event;

    if (event.type === 'file-changed' || event.type === 'file-added') {
      try {
        const absPath = path.join(rootPath, relativePath);
        const content = fs.readFileSync(absPath, 'utf-8');
        const stat = fs.statSync(absPath);
        svc.indexWikiFile(relativePath, content, fileTree, { mtimeMs: stat.mtimeMs, sizeBytes: stat.size });
        svc.indexSearchFile(relativePath, content);
        synced += 1;
      } catch { errors += 1; }
    } else if (event.type === 'file-deleted') {
      try {
        svc.removeWikiFile(relativePath);
        svc.removeSearchFile(relativePath);
        synced += 1;
      } catch { errors += 1; }
    }
    // folder-added — no action needed
  }

  return { syncedCount: synced, errorCount: errors };
}

/**
 * Synchronise watcher file events to SQLite (awaitable, for frontend IPC).
 */
export async function syncFileEventsToSqlite(
  vaultId: string,
  rootPath: string,
  events: readonly VaultFileEvent[],
): Promise<{ syncedCount: number; errorCount: number }> {
  return applyMarkdownEventsToSqliteIndex(vaultId, rootPath, events);
}

/**
 * Process watcher file events for SQLite (fire-and-forget, for backend watcher).
 */
function processWikiEventsForSqlite(
  vaultId: string,
  rootPath: string,
  events: readonly VaultFileEvent[],
): void {
  // Fire-and-forget async — we do not await this.
  void applyMarkdownEventsToSqliteIndex(vaultId, rootPath, events);
}

function flushEvents(entry: ActiveWatcher): void {
  entry.flushTimer = null;

  if (entry.webContents.isDestroyed()) {
    stopWatching(entry.vaultId);
    return;
  }

  const events = entry.pendingEvents;
  entry.pendingEvents = [];

  if (events.length === 0) return;

  const deduped = deduplicateEvents(events);
  if (deduped.length === 0) return;

  entry.webContents.send(VAULT_FILE_EVENT_CHANNEL, deduped);

  // ── Phase Retrofit-2: parallel SQLite wiki index writes ──
  // Fire-and-forget — failures are logged, never block the watcher.
  processWikiEventsForSqlite(entry.vaultId, entry.rootPath, deduped);
}

function scheduleFlush(entry: ActiveWatcher): void {
  if (entry.flushTimer) clearTimeout(entry.flushTimer);
  entry.flushTimer = setTimeout(() => flushEvents(entry), DEBOUNCE_MS);
}

function enqueueEvent(entry: ActiveWatcher, event: VaultFileEvent): void {
  entry.pendingEvents.push(event);
  if (entry.pendingEvents.length > MAX_PENDING_EVENTS) {
    console.warn(
      `[schola:watcher] Pending events exceeded ${MAX_PENDING_EVENTS} — ` +
      `flushing immediately for vault ${entry.vaultId}`,
    );
    if (entry.flushTimer) {
      clearTimeout(entry.flushTimer);
      entry.flushTimer = null;
    }
    flushEvents(entry);
    return;
  }
  scheduleFlush(entry);
}

export function startWatching(
  vaultId: string,
  rootPath: string,
  webContents: WebContents,
): void {
  // Stop any existing watcher for this vault
  stopWatching(vaultId);

  const fileKindCache = new Map<string, FileKind>();

  const watcher = chokidar.watch(rootPath, {
    ignored: EXCLUDED_DIR_PATTERNS,
    ignoreInitial: true,
    persistent: true,
    depth: 20,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 50,
    },
  });

  const entry: ActiveWatcher = {
    vaultId,
    rootPath,
    watcher,
    webContents,
    fileKindCache,
    pendingEvents: [],
    flushTimer: null,
    cachedFileTree: null,
  };

  watcher.on('add', (absolutePath: string) => {
    try {
      const relativePath = toVaultRelativePath(rootPath, absolutePath);
      if (!relativePath) return;

      const name = path.posix.basename(relativePath);
      if (isTemporaryFile(name)) return;

      const fileKind = classifyFile(name);
      fileKindCache.set(relativePath, fileKind);

      enqueueEvent(entry, {
        type: 'file-added',
        relativePath,
        fileKind,
      });
    } catch {
      // Path outside vault — silently ignored
    }
  });

  watcher.on('change', (absolutePath: string) => {
    try {
      const relativePath = toVaultRelativePath(rootPath, absolutePath);
      if (!relativePath) return;

      const name = path.posix.basename(relativePath);
      if (isTemporaryFile(name)) return;

      const fileKind = fileKindCache.get(relativePath) ?? classifyFile(name);
      fileKindCache.set(relativePath, fileKind);

      enqueueEvent(entry, {
        type: 'file-changed',
        relativePath,
        fileKind,
      });
    } catch {
      // Path outside vault — silently ignored
    }
  });

  watcher.on('unlink', (absolutePath: string) => {
    try {
      const relativePath = toVaultRelativePath(rootPath, absolutePath);
      if (!relativePath) return;

      const name = path.posix.basename(relativePath);
      if (isTemporaryFile(name)) return;

      // Fall back to extension-based classification if cache miss
      // (e.g. file existed before watcher started)
      const fileKind = fileKindCache.get(relativePath) ?? classifyFile(name);
      fileKindCache.delete(relativePath);

      enqueueEvent(entry, {
        type: 'file-deleted',
        relativePath,
        fileKind,
      });
    } catch {
      // Path outside vault — silently ignored
    }
  });

  watcher.on('addDir', (absolutePath: string) => {
    try {
      const relativePath = toVaultRelativePath(rootPath, absolutePath);
      if (!relativePath) return;

      enqueueEvent(entry, {
        type: 'folder-added',
        relativePath,
      });
    } catch {
      // Path outside vault — silently ignored
    }
  });

  watcher.on('unlinkDir', (absolutePath: string) => {
    try {
      const relativePath = toVaultRelativePath(rootPath, absolutePath);
      if (!relativePath) return;

      enqueueEvent(entry, {
        type: 'folder-deleted',
        relativePath,
      });
    } catch {
      // Path outside vault — silently ignored
    }
  });

  watcher.on('error', (error: Error) => {
    console.error(`[schola:watcher] Error for vault ${vaultId}: ${error.message}`);
  });

  watcher.on('ready', () => {
    console.log(`[schola:watcher] Watcher ready for vault ${vaultId}`);
  });

  watchers.set(vaultId, entry);
  console.log(`[schola:watcher] Started watching vault ${vaultId} at ${rootPath}`);
}

export function stopWatching(vaultId: string): void {
  const entry = watchers.get(vaultId);
  if (!entry) return;

  if (entry.flushTimer) {
    clearTimeout(entry.flushTimer);
    entry.flushTimer = null;
  }

  entry.pendingEvents = [];
  entry.watcher.close().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[schola:watcher] Error closing watcher for vault ${vaultId}: ${message}`);
  });

  entry.fileKindCache.clear();
  watchers.delete(vaultId);
  console.log(`[schola:watcher] Stopped watching vault ${vaultId}`);
}

export function stopAllWatchers(): void {
  for (const vaultId of watchers.keys()) {
    stopWatching(vaultId);
  }
  console.log('[schola:watcher] All watchers stopped');
}
