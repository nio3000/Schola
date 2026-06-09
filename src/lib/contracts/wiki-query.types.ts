/**
 * Wiki query IPC contract types (SQLite Retrofit-4).
 *
 * All queries are fixed-function — renderer cannot pass raw SQL,
 * table names, or arbitrary WHERE clauses.
 */

// ── Channels ───────────────────────────────────

export const WIKI_GET_BACKLINKS_CHANNEL = 'wiki:get-backlinks';
export const WIKI_GET_OUTGOING_LINKS_CHANNEL = 'wiki:get-outgoing-links';
export const WIKI_GET_UNRESOLVED_LINKS_CHANNEL = 'wiki:get-unresolved-links';

// ── Types ──────────────────────────────────────

export interface SqliteBacklink {
  readonly sourcePath: string;
  readonly rawTarget: string;
  readonly targetPath: string;
  readonly alias: string | null;
}

export interface SqliteOutgoingLink {
  readonly sourcePath: string;
  readonly rawTarget: string;
  readonly targetPath: string;
  readonly alias: string | null;
}

export interface SqliteUnresolvedLink {
  readonly sourcePath: string;
  readonly rawTarget: string;
  readonly alias: string | null;
}

export type WikiQueryErrorCode =
  | 'DB_NOT_READY'
  | 'DB_QUERY_FAILED'
  | 'VAULT_NOT_FOUND'
  | 'INVALID_INPUT';

export interface GetBacklinksOk {
  readonly ok: true;
  readonly backlinks: readonly SqliteBacklink[];
  readonly source: 'sqlite';
}

export interface GetBacklinksErr {
  readonly ok: false;
  readonly code: WikiQueryErrorCode;
  readonly message: string;
}

export type GetBacklinksResult = GetBacklinksOk | GetBacklinksErr;

export interface GetOutgoingOk {
  readonly ok: true;
  readonly links: readonly SqliteOutgoingLink[];
  readonly source: 'sqlite';
}

export interface GetOutgoingErr {
  readonly ok: false;
  readonly code: WikiQueryErrorCode;
  readonly message: string;
}

export type GetOutgoingResult = GetOutgoingOk | GetOutgoingErr;

export interface GetUnresolvedOk {
  readonly ok: true;
  readonly links: readonly SqliteUnresolvedLink[];
  readonly source: 'sqlite';
}

export interface GetUnresolvedErr {
  readonly ok: false;
  readonly code: WikiQueryErrorCode;
  readonly message: string;
}

export type GetUnresolvedResult = GetUnresolvedOk | GetUnresolvedErr;

// ── Renderer API ───────────────────────────────

export interface ScholaWikiQueryApi {
  readonly getBacklinks: (vaultId: string, relativePath: string) => Promise<GetBacklinksResult>;
  readonly getOutgoingLinks: (vaultId: string, relativePath: string) => Promise<GetOutgoingResult>;
  readonly getUnresolvedLinks: (vaultId: string, relativePath: string) => Promise<GetUnresolvedResult>;
}
