/**
 * SQLite index database service for Schola.
 *
 * Manages per-vault SQLite databases stored at <vault_root>/.schola/index.db.
 *
 * Uses Node.js built-in sqlite module (node:sqlite, available in Node 22.5+)
 * — no native compilation needed, compatible with Electron 42's V8 ABI.
 *
 * Phase: Retrofit-1 — DB infrastructure + writing + querying.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { EXPECTED_SCHEMA_VERSION, SCHEMA_V1_STATEMENTS } from '../db/schema';
import { extractWikilinks, extractHeadings, resolveWikilinkPathEnhanced } from '../../src/lib/wiki-parsers';
import { getMarkdownPaths } from '../../src/lib/fileTreeUtils';
import type { FileEntry } from '../../src/lib/contracts/vault.types';
import type { SqliteSearchMatchType } from '../../src/lib/contracts/search-query.types';
import { GRAPH_MAX_NODES, type GraphNode, type GraphEdge } from '../../src/lib/contracts/graph-query.types';
import { isExcludedSystemPath } from '../security/path-guard';

// ── Types ─────────────────────────────────────

export interface IndexDbStatus {
  readonly vaultId: string;
  readonly isOpen: boolean;
  readonly schemaVersion: number;
  readonly dbRelativePath: string;
  readonly lastError?: string;
}

// ── Internal ───────────────────────────────────

const DB_RELATIVE_PATH = '.schola/index.db';
const indexDbs = new Map<string, IndexDbService>();

// ── heading helper ─────────────────────────────

interface ParsedHeadingForDb {
  readonly level: number;
  readonly text: string;
  readonly slug: string | null;
  readonly orderIndex: number;
}

function parseHeadingsForDb(content: string): readonly ParsedHeadingForDb[] {
  const headingRe = /^(#{1,6})\s+(.+)$/gm;
  const result: ParsedHeadingForDb[] = [];
  let match: RegExpExecArray | null;
  let orderIndex = 0;
  while ((match = headingRe.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const slug = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/(^-|-$)/g, '');
    result.push({ level, text, slug: slug.length > 0 ? slug : null, orderIndex });
    orderIndex += 1;
  }
  return result;
}

// ── Public API ─────────────────────────────────

export function openIndexDbForVault(vaultId: string, rootPath: string): void {
  if (indexDbs.has(vaultId)) return;
  const service = new IndexDbService(vaultId, rootPath);
  try {
    service.open();
    indexDbs.set(vaultId, service);
    console.log(`[schola:db] Opened index DB for vault ${vaultId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[schola:db] Failed to open index DB for vault ${vaultId}: ${message}`);
  }
}

export function closeIndexDbForVault(vaultId: string): void {
  const service = indexDbs.get(vaultId);
  if (!service) return;
  try { service.close(); } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[schola:db] Error closing index DB for vault ${vaultId}: ${message}`);
  } finally {
    indexDbs.delete(vaultId);
    console.log(`[schola:db] Closed index DB for vault ${vaultId}`);
  }
}

export function closeAllIndexDbs(): void {
  for (const vaultId of indexDbs.keys()) closeIndexDbForVault(vaultId);
  console.log('[schola:db] All index databases closed');
}

export function getIndexDbForVault(vaultId: string): IndexDbService | null {
  return indexDbs.get(vaultId) ?? null;
}

export function withIndexDb<T>(vaultId: string, fn: (svc: IndexDbService) => T): T | undefined {
  const svc = indexDbs.get(vaultId);
  if (!svc) return undefined;
  try { return fn(svc); } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[schola:db] withIndexDb error (vault=${vaultId}): ${message}`);
    return undefined;
  }
}

// ── Service class ──────────────────────────────

export class IndexDbService {
  readonly vaultId: string;
  private readonly rootPath: string;
  private db: DatabaseSync | null = null;
  private lastError: string | undefined;

  constructor(vaultId: string, rootPath: string) {
    this.vaultId = vaultId;
    this.rootPath = rootPath;
  }

  open(): void {
    const dbDir = path.join(this.rootPath, '.schola');
    fs.mkdirSync(dbDir, { recursive: true });
    const dbPath = path.join(dbDir, 'index.db');
    this.db = new DatabaseSync(dbPath);

    // Apply PRAGMAs
    const pragmas = ['PRAGMA journal_mode = WAL', 'PRAGMA synchronous = NORMAL', 'PRAGMA foreign_keys = ON', 'PRAGMA busy_timeout = 5000'];
    for (const pragma of pragmas) {
      try { this.db.exec(pragma); } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[schola:db] PRAGMA warning (vault=${this.vaultId}): ${pragma} — ${message}`);
      }
    }
    this.runMigrations();
  }

  close(): void {
    if (this.db) { try { this.db.close(); } catch { /* */ } this.db = null; }
  }

  /**
   * Phase 4-4-B TD: Proper index freshness check.
   *
   * Compares the current fileTree against the DB to detect staleness from:
   *  - schema version mismatch
   *  - new/missing files (DB file count differs from Vault file count)
   *  - mtime or size changes on indexed files
   *  - orphan records (DB has files no longer in Vault)
   *  - partial index (DB has records but total file_metadata count ≠ expected)
   *
   * Only reads file metadata (mtime/size/relativePath) from the fileTree —
   * does NOT read any Markdown file content.
   *
   * Returns true if the index is up-to-date and a full rebuild can be skipped.
   */
  isIndexFresh(fileTree: readonly FileEntry[]): boolean {
    const db = this.db;
    if (!db) return false;

    try {
      // 1. Schema version must match
      const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number | null } | undefined;
      if (!row?.version || row.version < EXPECTED_SCHEMA_VERSION) return false;

      // 2. Get current Markdown files (skipping _exports/, _trash/, .schola/)
      const currentPaths = getMarkdownPaths(fileTree);

      // 3. Get DB file_metadata where exists_flag=1
      const dbRows = db.prepare('SELECT relative_path AS relativePath, mtime_ms AS mtimeMs, size_bytes AS sizeBytes FROM file_metadata WHERE exists_flag = 1').all() as { relativePath: string; mtimeMs: number | null; sizeBytes: number | null }[];

      // 4. Compare file count
      if (currentPaths.length !== dbRows.length) return false;

      // 5. Build lookup from DB rows
      const dbLookup = new Map<string, { mtimeMs: number | null; sizeBytes: number | null }>();
      for (const r of dbRows) {
        dbLookup.set(r.relativePath, { mtimeMs: r.mtimeMs, sizeBytes: r.sizeBytes });
      }

      // 6. Compare every current path against DB
      for (const rp of currentPaths) {
        const dbMeta = dbLookup.get(rp);
        // DB has no record for this file → stale
        if (!dbMeta) {
          // Also check: does the DB have this file but with exists_flag=0?
          const orphan = db.prepare('SELECT 1 FROM file_metadata WHERE relative_path = ? AND exists_flag = 0').get(rp);
          if (orphan) return false; // existed before but was deleted — stale
          return false;
        }

        // Build expected metadata from fileTree entry
        const absPath = path.join(this.rootPath, rp);
        let stat: { mtimeMs: number; size: number } | null = null;
        try {
          stat = fs.statSync(absPath);
        } catch {
          // File disappeared between scan and now — treat as stale
          return false;
        }

        // Compare mtime (allow 1s tolerance for filesystem granularity)
        if (dbMeta.mtimeMs === null || Math.abs(stat.mtimeMs - dbMeta.mtimeMs) > 1000) {
          return false;
        }

        // Compare size
        if (dbMeta.sizeBytes === null || dbMeta.sizeBytes !== stat.size) {
          return false;
        }
      }

      // 7. Check for orphan records (DB has files not in current Vault)
      if (dbLookup.size > currentPaths.length) return false;

      return true;
    } catch {
      return false;
    }
  }

  runMigrations(): void {
    const db = this.db;
    if (!db) return;
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`);
      const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number | null } | undefined;
      if (!row?.version || row.version < 1) {
        for (const stmt of SCHEMA_V1_STATEMENTS) db.exec(stmt);
        db.prepare('INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());
      }
      console.log(`[schola:db] Migrations complete for vault ${this.vaultId} (version=${EXPECTED_SCHEMA_VERSION})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.lastError = message;
      console.error(`[schola:db] Migration failed for vault ${this.vaultId}: ${message}`);
      try { this.close(); } catch { /* */ }
    }
  }

  // ── Wiki writes ──

  indexWikiFile(relativePath: string, content: string, fileTree: readonly FileEntry[], metadata?: { readonly mtimeMs?: number; readonly sizeBytes?: number; readonly contentHash?: string }): void {
    if (isExcludedSystemPath(relativePath)) return;
    const db = this.db; if (!db) return;
    const fileName = relativePath.split('/').pop() ?? relativePath;
    const slashIdx = relativePath.lastIndexOf('/');
    const directory = slashIdx >= 0 ? relativePath.slice(0, slashIdx) : '';
    const ext = path.extname(fileName).toLowerCase();
    const indexedAt = new Date().toISOString();
    const links = extractWikilinks(content);
    try {
      db.exec('BEGIN');
      db.prepare('INSERT OR REPLACE INTO file_metadata (relative_path,file_name,directory,extension,content_hash,mtime_ms,size_bytes,indexed_at,exists_flag) VALUES (?,?,?,?,?,?,?,?,1)').run(relativePath, fileName, directory, ext, metadata?.contentHash ?? null, metadata?.mtimeMs ?? null, metadata?.sizeBytes ?? null, indexedAt);
      db.prepare('DELETE FROM links WHERE source_path = ?').run(relativePath);
      db.prepare('DELETE FROM unresolved_links WHERE source_path = ?').run(relativePath);
      db.prepare('DELETE FROM headings WHERE relative_path = ?').run(relativePath);
      const insLink = db.prepare('INSERT OR IGNORE INTO links (source_path,raw_target,target_path,alias) VALUES (?,?,?,?)');
      const insUnres = db.prepare('INSERT OR IGNORE INTO unresolved_links (source_path,raw_target,alias) VALUES (?,?,?)');
      for (const link of links) {
        const rp = resolveWikilinkPathEnhanced(link.target, fileTree);
        if (rp) insLink.run(relativePath, link.target, rp, link.alias);
        else insUnres.run(relativePath, link.target, link.alias);
      }
      const insHeading = db.prepare('INSERT INTO headings (relative_path,level,text,slug,order_index) VALUES (?,?,?,?,?)');
      for (const h of parseHeadingsForDb(content)) insHeading.run(relativePath, h.level, h.text, h.slug, h.orderIndex);
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* */ }
      const message = err instanceof Error ? err.message : String(err);
      this.lastError = message;
      console.error(`[schola:db] indexWikiFile failed (vault=${this.vaultId}, file=${relativePath}): ${message}`);
    }
  }

  removeWikiFile(relativePath: string): void {
    const db = this.db; if (!db) return;
    try {
      db.exec('BEGIN');
      db.prepare('DELETE FROM links WHERE source_path = ?').run(relativePath);
      db.prepare('DELETE FROM unresolved_links WHERE source_path = ?').run(relativePath);
      db.prepare('DELETE FROM headings WHERE relative_path = ?').run(relativePath);
      db.prepare("UPDATE file_metadata SET exists_flag=0,indexed_at=? WHERE relative_path=?").run(new Date().toISOString(), relativePath);
      db.exec('COMMIT');
    } catch { try { db.exec('ROLLBACK'); } catch { /* */ } }
  }
 
  removeWikiFolder(folderRelativePath: string): void {
    const db = this.db; if (!db) return;
    const prefix = `${folderRelativePath}/`;
    try {
      db.exec('BEGIN');
      db.prepare('DELETE FROM links WHERE source_path LIKE ?').run(`${prefix}%`);
      db.prepare('DELETE FROM unresolved_links WHERE source_path LIKE ?').run(`${prefix}%`);
      db.prepare('DELETE FROM headings WHERE relative_path LIKE ?').run(`${prefix}%`);
      db.prepare("UPDATE file_metadata SET exists_flag=0,indexed_at=? WHERE relative_path LIKE ?").run(new Date().toISOString(), `${prefix}%`);
      db.exec('COMMIT');
    } catch { try { db.exec('ROLLBACK'); } catch { /* */ } }
  }

  async rebuildWikiIndex(fileTree: readonly FileEntry[], readNote: (relativePath: string) => Promise<string>): Promise<void> {
    const db = this.db; if (!db) return;
    try { db.exec('DELETE FROM links'); db.exec('DELETE FROM unresolved_links'); db.exec('DELETE FROM headings'); db.exec('DELETE FROM file_metadata'); } catch { return; }
    for (const rp of getMarkdownPaths(fileTree)) {
      try { this.indexWikiFile(rp, await readNote(rp), fileTree, { mtimeMs: fs.statSync(path.join(this.rootPath, rp)).mtimeMs, sizeBytes: fs.statSync(path.join(this.rootPath, rp)).size }); } catch { /* skip */ }
    }
    console.log(`[schola:db] rebuildWikiIndex complete (vault=${this.vaultId}, files=${getMarkdownPaths(fileTree).length})`);
  }

  // ── Search writes ──

  indexSearchFile(relativePath: string, content: string): void {
    if (isExcludedSystemPath(relativePath)) return;
    const db = this.db; if (!db) return;
    const fileName = relativePath.split('/').pop() ?? relativePath;
    const slashIdx = relativePath.lastIndexOf('/');
    const directory = slashIdx >= 0 ? relativePath.slice(0, slashIdx) : '';
    const headings = extractHeadings(content);
    const targets = [...new Set(extractWikilinks(content).map(l => l.target))];
    try {
      db.prepare("INSERT OR REPLACE INTO search_index (relative_path,file_name,directory,title,headings_text,wikilink_targets_text,updated_at) VALUES (?,?,?,?,?,?,datetime('now'))").run(relativePath, fileName, directory, headings[0] ?? fileName, headings.join('\n'), targets.join('\n'));
    } catch { /* log */ }
  }

  removeSearchFile(relativePath: string): void {
    const db = this.db; if (!db) return;
    try { db.prepare('DELETE FROM search_index WHERE relative_path = ?').run(relativePath); } catch { /* */ }
  }

  removeSearchFolder(folderRelativePath: string): void {
    const db = this.db; if (!db) return;
    try { db.prepare('DELETE FROM search_index WHERE relative_path LIKE ?').run(`${folderRelativePath}/%`); } catch { /* */ }
  }

  async rebuildSearchIndex(fileTree: readonly FileEntry[], readNote: (relativePath: string) => Promise<string>): Promise<void> {
    const db = this.db; if (!db) return;
    try { db.exec('DELETE FROM search_index'); } catch { return; }
    for (const rp of getMarkdownPaths(fileTree)) { try { this.indexSearchFile(rp, await readNote(rp)); } catch { /* */ } }
    console.log(`[schola:db] rebuildSearchIndex complete (vault=${this.vaultId})`);
  }

  /**
   * Phase 4-4-B: Merged single-pass rebuild.
   * Reads each Markdown file ONCE and writes to both wiki and search indices.
   * Eliminates the duplicate full-file reads of separate rebuildWikiIndex + rebuildSearchIndex.
   */
  async rebuildAllIndices(fileTree: readonly FileEntry[], readNote: (relativePath: string) => Promise<string>): Promise<void> {
    const db = this.db; if (!db) return;
    const paths = getMarkdownPaths(fileTree);
    const startMs = Date.now();

    // Clear all index tables
    try {
      db.exec('DELETE FROM links');
      db.exec('DELETE FROM unresolved_links');
      db.exec('DELETE FROM headings');
      db.exec('DELETE FROM file_metadata');
      db.exec('DELETE FROM search_index');
    } catch { return; }

    let indexed = 0;
    for (const rp of paths) {
      try {
        const content = await readNote(rp);
        const absPath = path.join(this.rootPath, rp);
        const stat = fs.statSync(absPath);
        this.indexWikiFile(rp, content, fileTree, { mtimeMs: stat.mtimeMs, sizeBytes: stat.size });
        this.indexSearchFile(rp, content);
        indexed += 1;
      } catch { /* skip individual file failures */ }
    }

    const elapsed = Date.now() - startMs;
    console.log(`[schola:db] rebuildAllIndices complete (vault=${this.vaultId}, files=${indexed}/${paths.length}, ${elapsed}ms)`);
  }

  // ── Queries ──

  getBacklinks(relativePath: string): readonly { sourcePath: string; rawTarget: string; targetPath: string; alias: string | null }[] {
    const db = this.db; if (!db) return [];
    return db.prepare('SELECT source_path AS sourcePath,raw_target AS rawTarget,target_path AS targetPath,alias FROM links WHERE target_path=? ORDER BY source_path,raw_target').all(relativePath) as { sourcePath: string; rawTarget: string; targetPath: string; alias: string | null }[];
  }

  getOutgoingLinks(relativePath: string): readonly { sourcePath: string; rawTarget: string; targetPath: string; alias: string | null }[] {
    const db = this.db; if (!db) return [];
    return db.prepare('SELECT source_path AS sourcePath,raw_target AS rawTarget,target_path AS targetPath,alias FROM links WHERE source_path=? ORDER BY raw_target,target_path').all(relativePath) as { sourcePath: string; rawTarget: string; targetPath: string; alias: string | null }[];
  }

  getUnresolvedLinks(relativePath: string): readonly { sourcePath: string; rawTarget: string; alias: string | null }[] {
    const db = this.db; if (!db) return [];
    return db.prepare('SELECT source_path AS sourcePath,raw_target AS rawTarget,alias FROM unresolved_links WHERE source_path=? ORDER BY raw_target').all(relativePath) as { sourcePath: string; rawTarget: string; alias: string | null }[];
  }

  search(query: string, options?: { readonly limit?: number }): readonly { relativePath: string; fileName: string; directory: string; title: string | null; matchedText: string; matchType: SqliteSearchMatchType }[] {
    const db = this.db; if (!db) return [];
    const trimmed = query.trim();
    if (trimmed.length === 0) return [];
    const limit = Math.min(options?.limit ?? 50, 100);
    const esc = trimmed.replace(/[\\%_]/g, '\\$&');
    const lowerEsc = esc.toLowerCase();
    const q = `%${lowerEsc}%`;
    const starts = `${lowerEsc}%`;
    return db.prepare(`SELECT relative_path AS relativePath,file_name AS fileName,directory,title,CASE WHEN lower(file_name)=@exact THEN file_name WHEN lower(file_name) LIKE @starts ESCAPE '\\' THEN file_name WHEN lower(file_name) LIKE @q ESCAPE '\\' THEN file_name WHEN lower(relative_path) LIKE @q ESCAPE '\\' THEN relative_path WHEN lower(directory) LIKE @q ESCAPE '\\' THEN directory WHEN lower(title) LIKE @q ESCAPE '\\' THEN title WHEN lower(headings_text) LIKE @q ESCAPE '\\' THEN headings_text WHEN lower(wikilink_targets_text) LIKE @q ESCAPE '\\' THEN wikilink_targets_text ELSE relative_path END AS matchedText,CASE WHEN lower(file_name)=@exact THEN 'fileName' WHEN lower(file_name) LIKE @starts ESCAPE '\\' THEN 'fileName' WHEN lower(file_name) LIKE @q ESCAPE '\\' THEN 'fileName' WHEN lower(relative_path) LIKE @q ESCAPE '\\' THEN 'path' WHEN lower(directory) LIKE @q ESCAPE '\\' THEN 'directory' WHEN lower(title) LIKE @q ESCAPE '\\' THEN 'title' WHEN lower(headings_text) LIKE @q ESCAPE '\\' THEN 'heading' WHEN lower(wikilink_targets_text) LIKE @q ESCAPE '\\' THEN 'wikilink' ELSE 'path' END AS matchType FROM search_index WHERE lower(relative_path) LIKE @q ESCAPE '\\' OR lower(file_name) LIKE @q ESCAPE '\\' OR lower(directory) LIKE @q ESCAPE '\\' OR lower(title) LIKE @q ESCAPE '\\' OR lower(headings_text) LIKE @q ESCAPE '\\' OR lower(wikilink_targets_text) LIKE @q ESCAPE '\\' ORDER BY CASE WHEN lower(file_name)=@exact THEN 1 WHEN lower(file_name) LIKE @starts ESCAPE '\\' THEN 2 WHEN lower(file_name) LIKE @q ESCAPE '\\' THEN 3 WHEN lower(relative_path) LIKE @q ESCAPE '\\' THEN 4 WHEN lower(directory) LIKE @q ESCAPE '\\' THEN 5 WHEN lower(title) LIKE @q ESCAPE '\\' THEN 6 WHEN lower(headings_text) LIKE @q ESCAPE '\\' THEN 7 WHEN lower(wikilink_targets_text) LIKE @q ESCAPE '\\' THEN 8 ELSE 99 END,relative_path ASC LIMIT @limit`).all({ q, starts, exact: lowerEsc, limit }) as { relativePath: string; fileName: string; directory: string; title: string | null; matchedText: string; matchType: SqliteSearchMatchType }[];
  }

  // ── Graph query (Phase 2-D-1) ──

  getGraphData(maxNodes: number): { nodes: GraphNode[]; edges: GraphEdge[]; truncated: boolean; totalNodes: number } {
    const db = this.db;
    if (!db) return { nodes: [], edges: [], truncated: false, totalNodes: 0 };

    const limit = Math.min(maxNodes, GRAPH_MAX_NODES);

    // ── File nodes from file_metadata ──
    const fileRows = db.prepare(
      'SELECT relative_path, file_name FROM file_metadata WHERE exists_flag = 1',
    ).all() as { relative_path: string; file_name: string }[];

    // ── Batch backlink counts ──
    const backlinkMap = new Map<string, number>();
    const blRows = db.prepare(
      'SELECT target_path, COUNT(*) AS cnt FROM links WHERE target_path IS NOT NULL GROUP BY target_path',
    ).all() as { target_path: string; cnt: number }[];
    for (const r of blRows) backlinkMap.set(r.target_path, r.cnt);

    // ── Batch link counts ──
    const linkMap = new Map<string, number>();
    const lkRows = db.prepare(
      'SELECT source_path, COUNT(*) AS cnt FROM (SELECT source_path FROM links UNION ALL SELECT source_path FROM unresolved_links) GROUP BY source_path',
    ).all() as { source_path: string; cnt: number }[];
    for (const r of lkRows) linkMap.set(r.source_path, r.cnt);

    // ── Titles from headings ──
    const titleMap = new Map<string, string>();
    const hRows = db.prepare(
      'SELECT relative_path, text FROM headings WHERE level = 1 ORDER BY relative_path, order_index',
    ).all() as { relative_path: string; text: string }[];
    for (const r of hRows) {
      if (!titleMap.has(r.relative_path)) titleMap.set(r.relative_path, r.text);
    }

    // ── Titles from search_index (fallback) ──
    try {
      const siRows = db.prepare(
        'SELECT relative_path, title FROM search_index WHERE title IS NOT NULL',
      ).all() as { relative_path: string; title: string }[];
      for (const r of siRows) {
        if (!titleMap.has(r.relative_path)) titleMap.set(r.relative_path, r.title);
      }
    } catch { /* search_index may not exist in corrupted DB */ }

    // ── Build file nodes ──
    const basename = (p: string): string => {
      const name = p.split('/').pop() ?? p;
      const dot = name.lastIndexOf('.');
      return dot > 0 ? name.slice(0, dot) : name;
    };

    const allFileNodes: GraphNode[] = fileRows.map((r) => {
      const bc = backlinkMap.get(r.relative_path) ?? 0;
      const lc = linkMap.get(r.relative_path) ?? 0;
      const title = titleMap.get(r.relative_path) ?? null;
      return {
        id: r.relative_path,
        kind: 'file',
        label: title ?? basename(r.relative_path),
        relativePath: r.relative_path,
        title,
        linkCount: lc,
        backlinkCount: bc,
        isOrphan: lc === 0 && bc === 0,
      };
    });

    // ── Unresolved nodes ──
    const unresRows = db.prepare(
      'SELECT DISTINCT raw_target FROM unresolved_links',
    ).all() as { raw_target: string }[];

    const unresNodes: GraphNode[] = unresRows.map((r) => {
      const bc = backlinkMap.get(r.raw_target) ?? 0;
      return {
        id: `unresolved:${r.raw_target}`,
        kind: 'unresolved',
        label: r.raw_target,
        relativePath: null,
        title: null,
        linkCount: 0,
        backlinkCount: bc,
        isOrphan: false,
      };
    });

    // ── Merge and sort ──
    const allNodes = [...allFileNodes, ...unresNodes].sort((a, b) => {
      // Sort: backlinkCount DESC, linkCount DESC, label ASC
      if (b.backlinkCount !== a.backlinkCount) return b.backlinkCount - a.backlinkCount;
      if (b.linkCount !== a.linkCount) return b.linkCount - a.linkCount;
      return a.label.localeCompare(b.label);
    });

    const totalNodes = allNodes.length;
    const selectedNodes = allNodes.slice(0, limit);
    const selectedIds = new Set(selectedNodes.map((n) => n.id));

    // ── Resolved edges ──
    const resolvedEdgeRows = db.prepare(
      'SELECT DISTINCT source_path, target_path, raw_target FROM links',
    ).all() as { source_path: string; target_path: string; raw_target: string }[];

    const resolvedEdges: GraphEdge[] = [];
    for (const r of resolvedEdgeRows) {
      if (selectedIds.has(r.source_path) && selectedIds.has(r.target_path)) {
        resolvedEdges.push({
          source: r.source_path,
          target: r.target_path,
          kind: 'wikilink',
          label: r.raw_target,
        });
      }
    }

    // ── Unresolved edges ──
    const unresEdgeRows = db.prepare(
      'SELECT DISTINCT source_path, raw_target FROM unresolved_links',
    ).all() as { source_path: string; raw_target: string }[];

    const unresEdges: GraphEdge[] = [];
    for (const r of unresEdgeRows) {
      const targetId = `unresolved:${r.raw_target}`;
      if (selectedIds.has(r.source_path) && selectedIds.has(targetId)) {
        unresEdges.push({
          source: r.source_path,
          target: targetId,
          kind: 'unresolved',
          label: r.raw_target,
        });
      }
    }

    return {
      nodes: selectedNodes,
      edges: [...resolvedEdges, ...unresEdges],
      truncated: totalNodes > limit,
      totalNodes,
    };
  }

  getStatus(): IndexDbStatus {
    return { vaultId: this.vaultId, isOpen: this.db !== null, schemaVersion: EXPECTED_SCHEMA_VERSION, dbRelativePath: DB_RELATIVE_PATH, lastError: this.lastError };
  }

  /** Full status with row counts for Retrofit-5-A. */
  getFullStatus(): {
    fileCount: number; linkCount: number; unresolvedLinkCount: number;
    headingCount: number; searchItemCount: number;
    isCorrupted: boolean; corruptedReason: string | null;
  } {
    const db = this.db;
    if (!db) return {
      fileCount: 0, linkCount: 0, unresolvedLinkCount: 0,
      headingCount: 0, searchItemCount: 0,
      isCorrupted: false, corruptedReason: null,
    };

    // ── Corruption detection (Retrofit-6-A) ──
    let isCorrupted = false;
    let corruptedReason: string | null = null;

    // Check schema version from migrations table
    try {
      const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number | null } | undefined;
      const actualVersion = row?.version ?? 0;
      if (actualVersion !== EXPECTED_SCHEMA_VERSION) {
        isCorrupted = true;
        corruptedReason = `Schema version mismatch: expected ${EXPECTED_SCHEMA_VERSION}, got ${actualVersion}`;
      }
    } catch {
      isCorrupted = true;
      corruptedReason = 'Cannot read schema_migrations table';
    }

    // Check core tables exist (only if schema version OK)
    if (!isCorrupted) {
      const tables = ['file_metadata', 'links', 'unresolved_links', 'headings', 'search_index'];
      for (const table of tables) {
        try {
          db.prepare(`SELECT 1 FROM ${table} LIMIT 0`).get();
        } catch {
          isCorrupted = true;
          corruptedReason = `Table '${table}' is missing or unreadable`;
          break;
        }
      }
    }

    const count = (sql: string): number => {
      try {
        const row = db.prepare(sql).get() as { cnt: number } | undefined;
        return row?.cnt ?? 0;
      } catch { return 0; }
    };
    return {
      fileCount: count("SELECT COUNT(*) AS cnt FROM file_metadata WHERE exists_flag = 1"),
      linkCount: count('SELECT COUNT(*) AS cnt FROM links'),
      unresolvedLinkCount: count('SELECT COUNT(*) AS cnt FROM unresolved_links'),
      headingCount: count('SELECT COUNT(*) AS cnt FROM headings'),
      searchItemCount: count('SELECT COUNT(*) AS cnt FROM search_index'),
      isCorrupted,
      corruptedReason,
    };
  }

  /** Full rebuild of wiki and search indices for Retrofit-5-A. */
  async rebuildFullIndex(fileTree: readonly FileEntry[], readNote: (relativePath: string) => Promise<string>): Promise<void> {
    const db = this.db;
    if (!db) throw new Error('Database not open');
    this.lastError = undefined;

    // Clear all derived tables
    try {
      db.exec('DELETE FROM links');
      db.exec('DELETE FROM unresolved_links');
      db.exec('DELETE FROM headings');
      db.exec('DELETE FROM file_metadata');
      db.exec('DELETE FROM search_index');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.lastError = message;
      throw err;
    }

    // Rebuild wiki index
    const markdownPaths = getMarkdownPaths(fileTree);
    for (const rp of markdownPaths) {
      try {
        const content = await readNote(rp);
        const absPath = path.join(this.rootPath, rp);
        const stat = fs.statSync(absPath);
        this.indexWikiFile(rp, content, fileTree, { mtimeMs: stat.mtimeMs, sizeBytes: stat.size });
      } catch { /* skip unreadable files */ }
    }

    // Rebuild search index
    for (const rp of markdownPaths) {
      try {
        const content = await readNote(rp);
        this.indexSearchFile(rp, content);
      } catch { /* skip */ }
    }

    console.log(`[schola:db] rebuildFullIndex complete (vault=${this.vaultId}, files=${markdownPaths.length})`);
  }

  /** Expose rootPath for IPC handlers that need filesystem access. */
  getRootPath(): string {
    return this.rootPath;
  }

  getDatabase(): DatabaseSync | null { return this.db; }
}
