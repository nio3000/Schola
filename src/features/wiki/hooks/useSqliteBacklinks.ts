/**
 * Hook for querying SQLite backlinks with memory fallback.
 *
 * Prioritises SQLite getBacklinks results; falls back to the in-memory
 * WikiIndex when SQLite is unavailable, ANY file is dirty or has an
 * external conflict (global check — a dirty source file may link to
 * the current file), or results diverge from the memory index.
 *
 * Phase: Retrofit-4-D-P1-QA2 — restored global dirty/conflict fallback
 *
 * Phase: Retrofit-4-B
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSqliteBacklinks } from '../../../lib/platform/schola-api';

type BacklinksDataSource = 'sqlite' | 'memory';

type BacklinksFallbackReason =
  | 'none'
  | 'no-vault'
  | 'no-file'
  | 'dirty'
  | 'conflict'
  | 'query-error'
  | 'mismatch';

interface UseSqliteBacklinksInput {
  readonly vaultId: string | null;
  readonly currentFilePath: string | null;
  /** The in-memory backlinks to fall back to. */
  readonly memoryBacklinks: readonly string[];
  readonly dirtyFiles: ReadonlySet<string>;
  readonly externalConflicts: ReadonlyMap<string, unknown>;
  /** Bumped after each watcher-driven SQLite sync so the hook re-queries. */
  readonly sqliteIndexVersion: number;
}

interface UseSqliteBacklinksResult {
  readonly backlinks: readonly string[];
  readonly source: BacklinksDataSource;
  readonly fallbackReason: BacklinksFallbackReason;
  readonly isLoading: boolean;
}

/** Compare two path arrays as sets (order-independent). */
function samePathSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((p) => setA.has(p));
}

export function useSqliteBacklinks({
  vaultId,
  currentFilePath,
  memoryBacklinks,
  dirtyFiles,
  externalConflicts,
  sqliteIndexVersion,
}: UseSqliteBacklinksInput): UseSqliteBacklinksResult {
  const [source, setSource] = useState<BacklinksDataSource>('memory');
  const [fallbackReason, setFallbackReason] = useState<BacklinksFallbackReason>('none');
  const [backlinks, setBacklinks] = useState<readonly string[]>(memoryBacklinks);
  const [isLoading, setIsLoading] = useState(false);
  const generationRef = useRef(0);

  const fetchSqlite = useCallback(async () => {
    if (!vaultId || !currentFilePath) return;

    const gen = ++generationRef.current;
    setIsLoading(true);

    try {
      const result = await getSqliteBacklinks(vaultId, currentFilePath);

      // Guard against stale responses
      if (generationRef.current !== gen) return;

      if (result.ok) {
        const sqlitePaths = result.backlinks.map((b) => b.sourcePath).sort();
        const memoryPaths = [...memoryBacklinks].sort();

        if (samePathSet(sqlitePaths, memoryPaths)) {
          setBacklinks(sqlitePaths);
          setSource('sqlite');
          setFallbackReason('none');
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              '[schola:sqlite] Backlinks mismatch; falling back to memory index.',
              { sqliteCount: sqlitePaths.length, memoryCount: memoryPaths.length },
            );
          }
          setBacklinks(memoryPaths);
          setSource('memory');
          setFallbackReason('mismatch');
        }
      } else {
        setBacklinks(memoryBacklinks);
        setSource('memory');
        setFallbackReason('query-error');
      }
    } catch {
      if (generationRef.current === gen) {
        setBacklinks(memoryBacklinks);
        setSource('memory');
        setFallbackReason('query-error');
      }
    } finally {
      if (generationRef.current === gen) {
        setIsLoading(false);
      }
    }
  }, [vaultId, currentFilePath, memoryBacklinks]);

  useEffect(() => {
    // Always start from memory
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBacklinks(memoryBacklinks);

    if (!vaultId) {
      setSource('memory');
      setFallbackReason('no-vault');
      setIsLoading(false);
      return;
    }
    if (!currentFilePath) {
      setSource('memory');
      setFallbackReason('no-file');
      setIsLoading(false);
      return;
    }
    // Global dirty check: any dirty source file could link to currentFilePath
    if (dirtyFiles.size > 0) {
      setSource('memory');
      setFallbackReason('dirty');
      setIsLoading(false);
      return;
    }
    // Global conflict check: any external conflict could affect incoming links
    if (externalConflicts.size > 0) {
      setSource('memory');
      setFallbackReason('conflict');
      setIsLoading(false);
      return;
    }

    void fetchSqlite();

    return () => {
      ++generationRef.current; // cancel in-flight
    };
  }, [vaultId, currentFilePath, memoryBacklinks, dirtyFiles, externalConflicts, fetchSqlite, sqliteIndexVersion]);

  return { backlinks, source, fallbackReason, isLoading };
}
