/**
 * Graph query IPC handlers (Phase 2-D-1).
 *
 * Registers a fixed-function ipcMain.handle channel for reading
 * SQLite-derived graph data.  Renderer cannot pass raw SQL,
 * table names, or file paths.
 */

import { ipcMain } from 'electron';
import {
  GRAPH_GET_VAULT_GRAPH_CHANNEL,
  GRAPH_MAX_NODES,
  type GetVaultGraphResult,
} from '../../src/lib/contracts/graph-query.types';
import { getIndexDbForVault } from '../services/index-db.service';
import { assertVaultId } from '../lib/ipc-validation';

export function registerGraphQueryIpc(): void {
  ipcMain.handle(
    GRAPH_GET_VAULT_GRAPH_CHANNEL,
    async (_event, vaultId: unknown, options: unknown): Promise<GetVaultGraphResult> => {
      try {
        const id = assertVaultId(vaultId);

        const svc = getIndexDbForVault(id);
        if (!svc) {
          return {
            ok: false,
            code: 'DB_MISSING',
            message: 'SQLite index is missing.',
          };
        }

        if (!svc.getDatabase()) {
          return {
            ok: false,
            code: 'DB_ERROR',
            message: 'Failed to query graph data.',
          };
        }

        // Check for corruption
        const status = svc.getFullStatus();
        if (status.isCorrupted) {
          return {
            ok: false,
            code: 'DB_CORRUPTED',
            message: `SQLite index is corrupted: ${status.corruptedReason ?? 'unknown reason'}`,
          };
        }

        // Parse maxNodes with hard cap
        const opts = (options as { maxNodes?: number } | undefined) ?? {};
        const maxNodes = Math.min(opts.maxNodes ?? GRAPH_MAX_NODES, GRAPH_MAX_NODES);

        const data = svc.getGraphData(maxNodes);

        return {
          ok: true,
          nodes: data.nodes,
          edges: data.edges,
          truncated: data.truncated,
          nodeLimit: maxNodes,
          totalNodes: data.totalNodes,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, code: 'NO_VAULT', message: 'Vault is not available.' };
        }
        console.warn(`[schola:ipc] graph:get-vault-graph failed: ${message}`);
        return { ok: false, code: 'DB_ERROR', message: 'Failed to query graph data.' };
      }
    },
  );
}
