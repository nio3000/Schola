/**
 * Wiki and Search query IPC handlers (SQLite Retrofit-4-A).
 *
 * Registers fixed-function ipcMain.handle channels for reading
 * SQLite-derived index data.  Renderer cannot pass raw SQL,
 * table names, or arbitrary WHERE / ORDER BY clauses.
 */

import { ipcMain } from 'electron';
import {
  WIKI_GET_BACKLINKS_CHANNEL,
  WIKI_GET_OUTGOING_LINKS_CHANNEL,
  WIKI_GET_UNRESOLVED_LINKS_CHANNEL,
  type GetBacklinksResult,
  type GetOutgoingResult,
  type GetUnresolvedResult,
} from '../../src/lib/contracts/wiki-query.types';
import {
  SEARCH_QUERY_CHANNEL,
  type SearchQueryResult,
} from '../../src/lib/contracts/search-query.types';
import {
  INDEX_SYNC_FILE_EVENTS_CHANNEL,
  type IndexSyncResult,
  type VaultFileEvent,
} from '../../src/lib/contracts/vault.types';
import {
  INDEX_GET_STATUS_CHANNEL,
  INDEX_REBUILD_CHANNEL,
  type IndexStatus,
  type IndexRebuildResult,
} from '../../src/lib/contracts/index-status.types';
import { getIndexDbForVault } from '../services/index-db.service';
import { EXPECTED_SCHEMA_VERSION } from '../db/schema';
import { syncFileEventsToSqlite, getVaultRootPath } from '../services/vault-watcher.service';
import { scanVault } from '../services/vault.service';
import { resolveVaultPath } from '../security/path-guard';
import fs from 'node:fs';
import { assertVaultId, assertRelativePath } from '../lib/ipc-validation';

// ── Input validation ───────────────────────────

function assertQuery(input: unknown): string {
  if (typeof input !== 'string') {
    throw new Error('INVALID_INPUT: query must be a string.');
  }
  return input.trim();
}

function assertLimit(input: unknown): number {
  if (input === undefined || input === null) return 50;
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(Math.floor(n), 100);
}

// ── Registration ───────────────────────────────

/** Concurrent rebuild protection (Retrofit-5-A). */
const rebuildLocks = new Map<string, Promise<IndexRebuildResult>>();

export function registerIndexQueryIpc(): void {
  // ── wiki:get-backlinks ──
  ipcMain.handle(
    WIKI_GET_BACKLINKS_CHANNEL,
    async (_event, vaultId: unknown, relativePath: unknown): Promise<GetBacklinksResult> => {
      try {
        const id = assertVaultId(vaultId);
        const rp = assertRelativePath(relativePath);
        const svc = getIndexDbForVault(id);
        if (!svc || !svc.getDatabase()) {
          return { ok: false, code: 'DB_NOT_READY', message: 'Index database is not open.' };
        }
        const backlinks = svc.getBacklinks(rp);
        return { ok: true, backlinks, source: 'sqlite' };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, code: 'INVALID_INPUT', message };
        }
        console.warn(`[schola:ipc] wiki:get-backlinks failed: ${message}`);
        return { ok: false, code: 'DB_QUERY_FAILED', message: 'Query failed.' };
      }
    },
  );

  // ── wiki:get-outgoing-links ──
  ipcMain.handle(
    WIKI_GET_OUTGOING_LINKS_CHANNEL,
    async (_event, vaultId: unknown, relativePath: unknown): Promise<GetOutgoingResult> => {
      try {
        const id = assertVaultId(vaultId);
        const rp = assertRelativePath(relativePath);
        const svc = getIndexDbForVault(id);
        if (!svc || !svc.getDatabase()) {
          return { ok: false, code: 'DB_NOT_READY', message: 'Index database is not open.' };
        }
        const links = svc.getOutgoingLinks(rp);
        return { ok: true, links, source: 'sqlite' };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, code: 'INVALID_INPUT', message };
        }
        console.warn(`[schola:ipc] wiki:get-outgoing-links failed: ${message}`);
        return { ok: false, code: 'DB_QUERY_FAILED', message: 'Query failed.' };
      }
    },
  );

  // ── wiki:get-unresolved-links ──
  ipcMain.handle(
    WIKI_GET_UNRESOLVED_LINKS_CHANNEL,
    async (_event, vaultId: unknown, relativePath: unknown): Promise<GetUnresolvedResult> => {
      try {
        const id = assertVaultId(vaultId);
        const rp = assertRelativePath(relativePath);
        const svc = getIndexDbForVault(id);
        if (!svc || !svc.getDatabase()) {
          return { ok: false, code: 'DB_NOT_READY', message: 'Index database is not open.' };
        }
        const links = svc.getUnresolvedLinks(rp);
        return { ok: true, links, source: 'sqlite' };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, code: 'INVALID_INPUT', message };
        }
        console.warn(`[schola:ipc] wiki:get-unresolved-links failed: ${message}`);
        return { ok: false, code: 'DB_QUERY_FAILED', message: 'Query failed.' };
      }
    },
  );

  // ── search:query ──
  ipcMain.handle(
    SEARCH_QUERY_CHANNEL,
    async (_event, vaultId: unknown, query: unknown, options: unknown): Promise<SearchQueryResult> => {
      try {
        const id = assertVaultId(vaultId);
        const q = assertQuery(query);
        if (q.length === 0) {
          return { ok: true, matches: [], source: 'sqlite' };
        }
        const svc = getIndexDbForVault(id);
        if (!svc || !svc.getDatabase()) {
          return { ok: false, code: 'DB_NOT_READY', message: 'Index database is not open.' };
        }
        const limit = assertLimit((options as { limit?: number } | undefined)?.limit);
        const matches = svc.search(q, { limit });
        return { ok: true, matches, source: 'sqlite' };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, code: 'INVALID_INPUT', message };
        }
        console.warn(`[schola:ipc] search:query failed: ${message}`);
        return { ok: false, code: 'DB_QUERY_FAILED', message: 'Query failed.' };
      }
    },
  );

  // ── index:sync-file-events (Retrofit-4-D-P1-QA3) ──
  ipcMain.handle(
    INDEX_SYNC_FILE_EVENTS_CHANNEL,
    async (_event, vaultId: unknown, events: unknown): Promise<IndexSyncResult> => {
      try {
        const id = assertVaultId(vaultId);
        if (!Array.isArray(events)) {
          return { ok: false, syncedCount: 0, errorCount: 0 };
        }
        const rootPath = getVaultRootPath(id);
        if (!rootPath) {
          return { ok: false, syncedCount: 0, errorCount: 0 };
        }
        const result = await syncFileEventsToSqlite(
          id,
          rootPath,
          events as VaultFileEvent[],
        );
        return { ok: true, ...result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[schola:ipc] index:sync-file-events failed: ${message}`);
        return { ok: false, syncedCount: 0, errorCount: 0 };
      }
    },
  );

  // ── index:get-status (Retrofit-5-A / 6-A) ──
  ipcMain.handle(
    INDEX_GET_STATUS_CHANNEL,
    async (_event, vaultId: unknown): Promise<IndexStatus> => {
      try {
        const id = assertVaultId(vaultId);
        const svc = getIndexDbForVault(id);

        if (!svc) {
          return {
            vaultId: id, state: 'missing', schemaVersion: null,
            fileCount: 0, linkCount: 0, unresolvedLinkCount: 0,
            headingCount: 0, searchItemCount: 0, errorMessage: null,
          };
        }

        if (!svc.getDatabase()) {
          return {
            vaultId: id, state: 'error', schemaVersion: null,
            fileCount: 0, linkCount: 0, unresolvedLinkCount: 0,
            headingCount: 0, searchItemCount: 0,
            errorMessage: svc.getStatus().lastError ?? 'Database not open',
          };
        }

        const counts = svc.getFullStatus();
        if (counts.isCorrupted) {
          return {
            vaultId: id, state: 'corrupted',
            schemaVersion: EXPECTED_SCHEMA_VERSION,
            fileCount: counts.fileCount, linkCount: counts.linkCount,
            unresolvedLinkCount: counts.unresolvedLinkCount,
            headingCount: counts.headingCount,
            searchItemCount: counts.searchItemCount,
            errorMessage: counts.corruptedReason,
          };
        }

        return {
          vaultId: id, state: 'ready',
          schemaVersion: EXPECTED_SCHEMA_VERSION,
          fileCount: counts.fileCount, linkCount: counts.linkCount,
          unresolvedLinkCount: counts.unresolvedLinkCount,
          headingCount: counts.headingCount,
          searchItemCount: counts.searchItemCount,
          errorMessage: null,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[schola:ipc] index:get-status failed: ${message}`);
        return {
          vaultId: typeof vaultId === 'string' ? vaultId : '', state: 'error',
          schemaVersion: null, fileCount: 0, linkCount: 0,
          unresolvedLinkCount: 0, headingCount: 0, searchItemCount: 0,
          errorMessage: message,
        };
      }
    },
  );

  // ── index:rebuild (Retrofit-5-A) ──
  ipcMain.handle(
    INDEX_REBUILD_CHANNEL,
    async (_event, vaultId: unknown): Promise<IndexRebuildResult> => {
      const id = assertVaultId(vaultId);

      // Concurrent protection: reuse in-flight promise
      const existing = rebuildLocks.get(id);
      if (existing) {
        console.log(`[schola:ipc] index:rebuild — already in progress for vault ${id}, reusing promise`);
        return existing;
      }

      const promise = (async (): Promise<IndexRebuildResult> => {
        try {
          const svc = getIndexDbForVault(id);
          if (!svc) {
            return {
              ok: false, status: { vaultId: id, state: 'missing', schemaVersion: null, fileCount: 0, linkCount: 0, unresolvedLinkCount: 0, headingCount: 0, searchItemCount: 0, errorMessage: 'Index database not available' },
              indexedFiles: 0, linkCount: 0, searchItemCount: 0, errorMessage: 'Index database not available',
            };
          }

          const rootPath = svc.getRootPath();

          const fileTree = await scanVault(id);
          const readNote = async (rp: string): Promise<string> => {
            const absPath = resolveVaultPath(rootPath, rp);
            return fs.readFileSync(absPath, 'utf-8');
          };

          // If DB not open, try opening
          if (!svc.getDatabase()) {
            try { svc.open(); } catch { /* will fail below */ }
            if (!svc.getDatabase()) {
              return {
                ok: false,
                status: {
                  vaultId: id, state: 'error', schemaVersion: null,
                  fileCount: 0, linkCount: 0, unresolvedLinkCount: 0,
                  headingCount: 0, searchItemCount: 0,
                  errorMessage: 'Cannot open index database',
                },
                indexedFiles: 0, linkCount: 0, searchItemCount: 0,
                errorMessage: 'Cannot open index database',
              };
            }
          }

          await svc.rebuildFullIndex(fileTree, readNote);

          const counts = svc.getFullStatus();
          return {
            ok: true,
            status: {
              vaultId: id, state: 'ready',
              schemaVersion: EXPECTED_SCHEMA_VERSION,
              fileCount: counts.fileCount,
              linkCount: counts.linkCount,
              unresolvedLinkCount: counts.unresolvedLinkCount,
              headingCount: counts.headingCount,
              searchItemCount: counts.searchItemCount,
              errorMessage: null,
            },
            indexedFiles: counts.fileCount,
            linkCount: counts.linkCount,
            searchItemCount: counts.searchItemCount,
            errorMessage: null,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[schola:ipc] index:rebuild failed for vault ${id}: ${message}`);
          return {
            ok: false,
            status: {
              vaultId: id, state: 'error', schemaVersion: null,
              fileCount: 0, linkCount: 0, unresolvedLinkCount: 0,
              headingCount: 0, searchItemCount: 0, errorMessage: message,
            },
            indexedFiles: 0, linkCount: 0, searchItemCount: 0,
            errorMessage: message,
          };
        } finally {
          rebuildLocks.delete(id);
        }
      })();

      rebuildLocks.set(id, promise);
      return promise;
    },
  );
}
