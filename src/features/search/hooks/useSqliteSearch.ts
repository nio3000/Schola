/**
 * Hook for querying SQLite search with memory fallback.
 *
 * Prioritises SQLite search results; falls back to the in-memory
 * SearchIndex when SQLite is unavailable, dirty/conflict state exists,
 * the memory index is still building, or results diverge from the
 * memory index.
 *
 * Phase: Retrofit-4-C / P1 — memoryReady guard
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { sqliteSearch } from '../../../lib/platform/schola-api';
import type { SqliteSearchMatchType } from '../../../lib/contracts/search-query.types';
import type { SearchMatch } from '../lib/searchIndex';

type SearchDataSource = 'sqlite' | 'memory';

type SearchFallbackReason =
  | 'none'
  | 'no-vault'
  | 'empty-query'
  | 'dirty'
  | 'conflict'
  | 'indexing'
  | 'query-error'
  | 'mismatch';

interface UseSqliteSearchInput {
  readonly vaultId: string | null;
  readonly query: string;
  readonly memoryMatches: readonly SearchMatch[];
  /** Whether the in-memory SearchIndex has finished building. */
  readonly memoryReady: boolean;
  readonly dirtyFiles: ReadonlySet<string>;
  readonly externalConflicts: ReadonlyMap<string, unknown>;
  /** Bumped after watcher sync / rebuild so the hook re-queries SQLite. */
  readonly sqliteIndexVersion: number;
}

interface UseSqliteSearchResult {
  readonly matches: readonly SearchMatch[];
  readonly source: SearchDataSource;
  readonly fallbackReason: SearchFallbackReason;
}

/**
 * Convert a SQLite search result to the memory SearchMatch format
 * so that SearchPanel does not need to change.
 */
function toSearchMatches(
  results: readonly { relativePath: string; fileName: string; title: string | null; matchedText: string; matchType: SqliteSearchMatchType }[],
  query: string,
): SearchMatch[] {
  // Map SQLite matchType to memory SearchMatchType
  const typeMap: Record<SqliteSearchMatchType, SearchMatch['matchType']> = {
    fileName: 'fileName',
    path: 'path',
    directory: 'path',  // directory matches map to 'path' for SearchPanel
    title: 'heading',
    heading: 'heading',
    wikilink: 'wikilink',
  };

  const lowerQuery = query.toLowerCase().trim();

  return results.map((r, i) => {
    let matchedText = r.matchedText;
    if (r.matchType === 'directory') {
      matchedText = r.relativePath;
    } else if (r.matchType === 'heading' || r.matchType === 'wikilink') {
      matchedText = r.matchedText
        .split('\n')
        .find((part) => part.toLowerCase().includes(lowerQuery)) ?? r.matchedText;
    }

    return {
      relativePath: r.relativePath,
      matchedText,
      matchType: typeMap[r.matchType],
      rank: i + 1,  // SQLite result order is the ranking
    };
  });
}

/** Normalize a SearchMatch for field-level comparison (stable keys). */
function normalizeMatch(m: SearchMatch): { relativePath: string; matchedText: string; matchType: string } {
  return { relativePath: m.relativePath, matchedText: m.matchedText, matchType: m.matchType };
}

/** Compare two result sets by relativePath, matchedText, and matchType (order-independent). */
function sameResultSets(
  a: readonly SearchMatch[],
  b: readonly SearchMatch[],
): boolean {
  if (a.length !== b.length) return false;

  const cmp = (x: ReturnType<typeof normalizeMatch>, y: ReturnType<typeof normalizeMatch>) => {
    const c = x.relativePath.localeCompare(y.relativePath, 'zh-CN');
    if (c !== 0) return c;
    const d = x.matchedText.localeCompare(y.matchedText, 'zh-CN');
    if (d !== 0) return d;
    return x.matchType.localeCompare(y.matchType, 'zh-CN');
  };

  const normA = a.map(normalizeMatch).sort(cmp);
  const normB = b.map(normalizeMatch).sort(cmp);

  for (let i = 0; i < normA.length; i++) {
    if (
      normA[i].relativePath !== normB[i].relativePath ||
      normA[i].matchedText !== normB[i].matchedText ||
      normA[i].matchType !== normB[i].matchType
    ) {
      return false;
    }
  }

  return true;
}

export function useSqliteSearch({
  vaultId,
  query,
  memoryMatches,
  memoryReady,
  dirtyFiles,
  externalConflicts,
  sqliteIndexVersion,
}: UseSqliteSearchInput): UseSqliteSearchResult {
  const [source, setSource] = useState<SearchDataSource>('memory');
  const [fallbackReason, setFallbackReason] = useState<SearchFallbackReason>('none');
  const [matches, setMatches] = useState<readonly SearchMatch[]>(memoryMatches);
  const generationRef = useRef(0);

  const fetchSqlite = useCallback(async () => {
    if (!vaultId || query.trim().length === 0) return;

    const gen = ++generationRef.current;

    try {
      const result = await sqliteSearch(vaultId, query);

      if (generationRef.current !== gen) return;

      if (result.ok) {
        const sqliteMatches = toSearchMatches(result.matches, query);

        if (sameResultSets(sqliteMatches, memoryMatches)) {
          setMatches(sqliteMatches);
          setSource('sqlite');
          setFallbackReason('none');
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              '[schola:sqlite] Search mismatch; falling back to memory index.',
              { sqliteCount: sqliteMatches.length, memoryCount: memoryMatches.length },
            );
          }
          setMatches(memoryMatches);
          setSource('memory');
          setFallbackReason('mismatch');
        }
      } else {
        setMatches(memoryMatches);
        setSource('memory');
        setFallbackReason('query-error');
      }
    } catch {
      if (generationRef.current === gen) {
        setMatches(memoryMatches);
        setSource('memory');
        setFallbackReason('query-error');
      }
    }
  }, [vaultId, query, memoryMatches]);

  useEffect(() => {
    if (!vaultId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatches(memoryMatches);
      setSource('memory');
      setFallbackReason('no-vault');
      return;
    }
    if (query.trim().length === 0) {
      setMatches(memoryMatches);
      setSource('memory');
      setFallbackReason('empty-query');
      return;
    }
    if (dirtyFiles.size > 0) {
      // Any dirty file could affect search results; fall back globally
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatches(memoryMatches);
      setSource('memory');
      setFallbackReason('dirty');
      return;
    }
    if (externalConflicts.size > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatches(memoryMatches);
      setSource('memory');
      setFallbackReason('conflict');
      return;
    }
    if (!memoryReady) {
      setMatches(memoryMatches);
      setSource('memory');
      setFallbackReason('indexing');
      return;
    }

    void fetchSqlite();

    return () => {
      ++generationRef.current;
    };
  }, [vaultId, query, memoryMatches, memoryReady, dirtyFiles, externalConflicts, fetchSqlite, sqliteIndexVersion]);

  return { matches, source, fallbackReason };
}
