/**
 * Index status and rebuild IPC contract types (SQLite Retrofit-5-A).
 *
 * All queries are fixed-function — renderer cannot pass raw SQL,
 * table names, or file paths.
 */

// ── Channels ───────────────────────────────────

export const INDEX_GET_STATUS_CHANNEL = 'index:get-status';
export const INDEX_REBUILD_CHANNEL = 'index:rebuild';

// ── Status ─────────────────────────────────────

export type IndexStatusState = 'ready' | 'rebuilding' | 'missing' | 'error' | 'corrupted';

export interface IndexStatus {
  readonly vaultId: string;
  readonly state: IndexStatusState;
  readonly schemaVersion: number | null;
  readonly fileCount: number;
  readonly linkCount: number;
  readonly unresolvedLinkCount: number;
  readonly headingCount: number;
  readonly searchItemCount: number;
  readonly errorMessage: string | null;
}

// ── Rebuild ────────────────────────────────────

export interface IndexRebuildResult {
  readonly ok: boolean;
  readonly status: IndexStatus;
  readonly indexedFiles: number;
  readonly linkCount: number;
  readonly searchItemCount: number;
  readonly errorMessage: string | null;
}

// ── Renderer API ───────────────────────────────

export interface ScholaIndexApi {
  readonly getStatus: (vaultId: string) => Promise<IndexStatus>;
  readonly rebuild: (vaultId: string) => Promise<IndexRebuildResult>;
}
