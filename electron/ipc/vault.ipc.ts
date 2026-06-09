import { ipcMain } from 'electron';
import { readFile } from 'node:fs/promises';
import {
  VAULT_CLOSE_CHANNEL,
  VAULT_CREATE_CHANNEL,
  VAULT_GET_RECENT_CHANNEL,
  VAULT_LIST_IMAGE_ASSETS_CHANNEL,
  VAULT_OPEN_BY_PATH_CHANNEL,
  VAULT_OPEN_CHANNEL,
  VAULT_RESOLVE_ASSET_URL_CHANNEL,
  VAULT_SCAN_CHANNEL,
} from '../../src/lib/contracts/vault.types';
import type { CreateVaultResult, FileEntry, ImageAsset, VaultInfo } from '../../src/lib/contracts/vault.types';
import {
  closeVault,
  createVault,
  getRecentVaults,
  listImageAssets,
  openVault,
  openVaultByPath,
  resolvePreviewAssetUrl,
  scanVault,
} from '../services/vault.service';
import { startWatching, stopWatching, setCachedFileTree } from '../services/vault-watcher.service';
import { openIndexDbForVault, closeIndexDbForVault, getIndexDbForVault } from '../services/index-db.service';
import { resolveVaultPath } from '../security/path-guard';
import { assertVaultId, assertString } from '../lib/ipc-validation';

/**
 * Rebuild SQLite wiki and search indices for a newly opened vault.
 *
 * Fire-and-forget — failures are logged but never block the vault open
 * or surface to the renderer.
 *
 * Phase 4-4-B: Uses rebuildAllIndices (single-pass) instead of separate
 * rebuildWikiIndex + rebuildSearchIndex (two-pass).  Adds PERFORMANCE LOG
 * under SCHOLA_PERF_LOG=1 env flag.
 */
async function rebuildSqliteIndexForVault(vaultId: string, rootPath: string): Promise<void> {
  const svc = getIndexDbForVault(vaultId);
  if (!svc || !svc.getDatabase()) {
    console.warn(`[schola:db] Skipping SQLite index rebuild — DB not ready for vault ${vaultId}`);
    return;
  }

  const rebuildStart = Date.now();

  // Phase 4-4-B TD: Scan vault ONCE and use for both freshness check and rebuild.
  let fileTree: readonly FileEntry[];
  try {
    fileTree = await scanVault(vaultId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[schola:db] Failed to scan vault ${vaultId} for SQLite index: ${message}`);
    return;
  }

  if (process.env.SCHOLA_PERF_LOG === '1') {
    const scanElapsed = Date.now() - rebuildStart;
    console.log(`[perf:vault-open] scanVault=${scanElapsed}ms files=${fileTree.length} vault=${vaultId}`);
  }

  const freshnessCheckStart = Date.now();

  // Phase 4-4-B TD: Proper freshness check — compares file count, mtime, size
  // against DB.  Skips rebuild if all metadata matches (no stale files).
  if (svc.isIndexFresh(fileTree)) {
    // Still populate the watcher cache so incremental events work
    setCachedFileTree(vaultId, fileTree);
    if (process.env.SCHOLA_PERF_LOG === '1') {
      const freshElapsed = Date.now() - freshnessCheckStart;
      console.log(`[perf:vault-open] indexFreshCheck=${freshElapsed}ms status=fresh vault=${vaultId}`);
      console.log(`[perf:vault-open] rebuildSqliteIndex skipped (index fresh) vault=${vaultId}`);
    }
    return;
  }

  if (process.env.SCHOLA_PERF_LOG === '1') {
    const freshElapsed = Date.now() - freshnessCheckStart;
    console.log(`[perf:vault-open] indexFreshCheck=${freshElapsed}ms status=stale vault=${vaultId}`);
  }

  const rebuildPhaseStart = Date.now();

  const readNoteContent = async (relativePath: string): Promise<string> => {
    const absPath = resolveVaultPath(rootPath, relativePath);
    return readFile(absPath, 'utf-8');
  };

  console.log(`[schola:db] Rebuilding SQLite index for vault ${vaultId}`);

  try {
    // Phase 4-4-B: single-pass rebuild — reads each file once for both indices
    await svc.rebuildAllIndices(fileTree, readNoteContent);
    // Populate the watcher's fileTree cache so incremental events don't need full rescans
    setCachedFileTree(vaultId, fileTree);
    const elapsed = Date.now() - rebuildStart;
    const rebuildPhaseElapsed = Date.now() - rebuildPhaseStart;
    if (process.env.SCHOLA_PERF_LOG === '1') {
      console.log(`[perf:vault-open] rebuildAllIndices=${rebuildPhaseElapsed}ms files=${fileTree.length} vault=${vaultId}`);
      console.log(`[perf:vault-open] rebuildSqliteIndex done vault=${vaultId} elapsed=${elapsed}ms files=${fileTree.length}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[schola:db] Failed to rebuild indices for vault ${vaultId}: ${message}`);
  }

  console.log(`[schola:db] SQLite wiki/search index rebuilt for vault ${vaultId}`);
}

export function registerVaultIpc(): void {
  ipcMain.handle(VAULT_OPEN_CHANNEL, async (event): Promise<VaultInfo | null> => {
    const openStart = Date.now();
    const info = await openVault();
    if (info) {
      const watchStart = Date.now();
      startWatching(info.id, info.rootPath, event.sender);
      openIndexDbForVault(info.id, info.rootPath);
      void rebuildSqliteIndexForVault(info.id, info.rootPath).catch((err) => {
        console.error(`[schola:db] Index rebuild failed for vault ${info.id}:`, err);
      });
      if (process.env.SCHOLA_PERF_LOG === '1') {
        const openElapsed = openStart > 0 ? Date.now() - openStart : 0;
        console.log(`[perf:vault-open] openVault=${openElapsed}ms vault=${info.id}`);
      }
    }
    return info;
  });

  ipcMain.handle(VAULT_OPEN_BY_PATH_CHANNEL, async (event, rootPath: unknown): Promise<VaultInfo> => {
    const openStart = Date.now();
    const info = await openVaultByPath(assertString(rootPath, 'rootPath'));
    startWatching(info.id, info.rootPath, event.sender);
    openIndexDbForVault(info.id, info.rootPath);
    void rebuildSqliteIndexForVault(info.id, info.rootPath).catch((err) => {
      console.error(`[schola:db] Index rebuild failed for vault ${info.id}:`, err);
    });
    if (process.env.SCHOLA_PERF_LOG === '1') {
      const openElapsed = openStart > 0 ? Date.now() - openStart : 0;
      console.log(`[perf:vault-open] openVaultByPath=${openElapsed}ms vault=${info.id}`);
    }
    return info;
  });

  ipcMain.handle(VAULT_CREATE_CHANNEL, async (event): Promise<CreateVaultResult> => {
    const result = await createVault();
    if (result.ok && result.vault) {
      const vault = result.vault;
      startWatching(vault.id, vault.rootPath, event.sender);
      openIndexDbForVault(vault.id, vault.rootPath);
      void rebuildSqliteIndexForVault(vault.id, vault.rootPath).catch((err) => {
        console.error(`[schola:db] Index rebuild failed for vault ${vault.id}:`, err);
      });
    }
    return result;
  });

  ipcMain.handle(VAULT_SCAN_CHANNEL, async (_event, vaultId: unknown): Promise<readonly FileEntry[]> => {
    return scanVault(assertVaultId(vaultId));
  });

  ipcMain.handle(VAULT_GET_RECENT_CHANNEL, (): readonly VaultInfo[] => getRecentVaults());

  ipcMain.handle(VAULT_CLOSE_CHANNEL, (_event, vaultId: unknown): void => {
    const id = assertVaultId(vaultId);
    stopWatching(id);
    closeIndexDbForVault(id);
    closeVault(id);
  });

  ipcMain.handle(
    VAULT_RESOLVE_ASSET_URL_CHANNEL,
    async (_event, vaultId: unknown, noteRelativePath: unknown, assetPath: unknown): Promise<string> => {
      return resolvePreviewAssetUrl(
        assertVaultId(vaultId),
    assertString(noteRelativePath, 'noteRelativePath'),
    assertString(assetPath, 'assetPath'),
      );
    },
  );

  ipcMain.handle(
    VAULT_LIST_IMAGE_ASSETS_CHANNEL,
    async (_event, vaultId: unknown): Promise<readonly ImageAsset[]> => {
      return listImageAssets(assertVaultId(vaultId));
    },
  );
}