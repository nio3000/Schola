/**
 * SQLite schema for the Schola index database.
 *
 * All tables are "CREATE TABLE IF NOT EXISTS" so the schema can be
 * applied to a fresh database (first open) or an existing one (migration).
 *
 * The database is a pure derivative index layer — Markdown files remain
 * the authoritative data source.  The entire database can be deleted and
 * rebuilt from vault contents at any time.
 */

/** Current expected schema version. Bump when adding tables or columns. */
export const EXPECTED_SCHEMA_VERSION = 1;

/**
 * SQL statements that create the v1 schema.
 *
 * Statements are ordered to satisfy foreign-key relationships and are
 * idempotent (IF NOT EXISTS).
 */
export const SCHEMA_V1_STATEMENTS = [
  // ── Migration tracking ──
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    applied_at  TEXT NOT NULL
  )`,

  // ── File metadata (rebuildable) ──
  `CREATE TABLE IF NOT EXISTS file_metadata (
    relative_path TEXT PRIMARY KEY,
    file_name     TEXT NOT NULL,
    directory     TEXT NOT NULL,
    extension     TEXT NOT NULL,
    content_hash  TEXT,
    mtime_ms      INTEGER,
    size_bytes    INTEGER,
    indexed_at    TEXT NOT NULL,
    exists_flag   INTEGER NOT NULL DEFAULT 1
  )`,

  // ── Resolved wikilinks ──
  `CREATE TABLE IF NOT EXISTS links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path TEXT NOT NULL,
    raw_target  TEXT NOT NULL,
    target_path TEXT NOT NULL,
    alias       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_path, raw_target, target_path)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_path)`,
  `CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_path)`,

  // ── Unresolved wikilinks ──
  `CREATE TABLE IF NOT EXISTS unresolved_links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path TEXT NOT NULL,
    raw_target  TEXT NOT NULL,
    alias       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_path, raw_target)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_unresolved_source ON unresolved_links(source_path)`,
  `CREATE INDEX IF NOT EXISTS idx_unresolved_target ON unresolved_links(raw_target)`,

  // ── Headings ──
  `CREATE TABLE IF NOT EXISTS headings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    relative_path TEXT NOT NULL,
    level         INTEGER NOT NULL,
    text          TEXT NOT NULL,
    slug          TEXT,
    order_index   INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_headings_path ON headings(relative_path)`,
  `CREATE INDEX IF NOT EXISTS idx_headings_text ON headings(text)`,

  // ── Search index ──
  `CREATE TABLE IF NOT EXISTS search_index (
    relative_path        TEXT PRIMARY KEY,
    file_name            TEXT NOT NULL,
    directory            TEXT NOT NULL,
    title                TEXT,
    headings_text        TEXT,
    wikilink_targets_text TEXT,
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_search_file_name ON search_index(file_name)`,
  `CREATE INDEX IF NOT EXISTS idx_search_directory ON search_index(directory)`,
];
