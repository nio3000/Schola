/**
 * Search query IPC contract types (SQLite Retrofit-4).
 *
 * All queries are fixed-function — renderer cannot pass raw SQL
 * or arbitrary WHERE / ORDER BY clauses.
 */

// ── Channels ───────────────────────────────────

export const SEARCH_QUERY_CHANNEL = 'search:query';

// ── Types ──────────────────────────────────────

export type SqliteSearchMatchType =
  | 'fileName'
  | 'path'
  | 'directory'
  | 'title'
  | 'heading'
  | 'wikilink';

export interface SqliteSearchMatch {
  readonly relativePath: string;
  readonly fileName: string;
  readonly directory: string;
  readonly title: string | null;
  readonly matchedText: string;
  readonly matchType: SqliteSearchMatchType;
}

export type SearchQueryErrorCode =
  | 'DB_NOT_READY'
  | 'DB_QUERY_FAILED'
  | 'VAULT_NOT_FOUND'
  | 'INVALID_INPUT';

export interface SearchQueryOk {
  readonly ok: true;
  readonly matches: readonly SqliteSearchMatch[];
  readonly source: 'sqlite';
}

export interface SearchQueryErr {
  readonly ok: false;
  readonly code: SearchQueryErrorCode;
  readonly message: string;
}

export type SearchQueryResult = SearchQueryOk | SearchQueryErr;

// ── Renderer API ───────────────────────────────

export interface ScholaSearchQueryApi {
  readonly query: (vaultId: string, query: string) => Promise<SearchQueryResult>;
}
