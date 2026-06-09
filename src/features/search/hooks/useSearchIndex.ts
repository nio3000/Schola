/**
 * React hook for managing the search index lifecycle.
 *
 * Rebuilds the index when the vault changes, and exposes a manual
 * rebuild function for use after save / create operations.
 *
 * Phase 2-C-4 adds incremental index updates for single-file
 * content changes so that the watcher does not trigger a full
 * vault re-read on every external edit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileEntry, VaultFileEvent } from '../../../lib/contracts/vault.types';
import { readNote } from '../../../lib/platform/schola-api';
import {
  buildSearchIndex,
  EMPTY_SEARCH_INDEX,
  searchIndex as doSearch,
  updateSearchIndexForFile as doUpdateSearchIndexForFile,
  removeSearchIndexForFile as doRemoveSearchIndexForFile,
  removeSearchIndexForFolder as doRemoveSearchIndexForFolder,
  type SearchIndexSnapshot,
  type SearchMatch,
} from '../lib/searchIndex';

export interface UseSearchIndexInput {
  readonly vaultId: string | null;
  readonly fileTree: readonly FileEntry[];
}

interface HandleSearchFileEventsInput {
  /** The raw watcher event batch */
  readonly events: readonly VaultFileEvent[];
  /** Files with unsaved (dirty) editor content */
  readonly dirtyFiles: ReadonlySet<string>;
  /** Active external conflict entries keyed by relativePath */
  readonly externalConflicts: ReadonlyMap<string, { readonly kind: 'modified' | 'deleted' }>;
}

export interface UseSearchIndexOutput {
  readonly searchIndex: SearchIndexSnapshot;
  /** Full rebuild (fallback for structural changes and safety) */
  readonly rebuildSearchIndex: () => Promise<void>;
  /**
   * Process a batch of watcher events and update the SearchIndex
   * incrementally where safe, falling back to a full rebuild
   * for complex batches.
   */
  readonly handleSearchFileEvents: (input: HandleSearchFileEventsInput) => Promise<void>;
  /**
   * Incrementally update the SearchIndex for a single file by reading
   * its current disk content.  Used after internal save / external reload.
   */
  readonly updateSearchIndexForFile: (relativePath: string) => Promise<void>;
  /** Run a search query against the index. Returns empty array if index not ready. */
  readonly query: (q: string) => SearchMatch[];
}

export function useSearchIndex({ vaultId, fileTree }: UseSearchIndexInput): UseSearchIndexOutput {
  const [searchIndex, setSearchIndex] = useState<SearchIndexSnapshot>(EMPTY_SEARCH_INDEX);
  const generationRef = useRef(0);

  const rebuildSearchIndex = useCallback(async (): Promise<void> => {
    if (!vaultId) {
      setSearchIndex(EMPTY_SEARCH_INDEX);
      return;
    }

    const gen = ++generationRef.current;
    setSearchIndex((prev) => ({ ...prev, status: 'building', error: null }));

    try {
      const items = await buildSearchIndex(vaultId, fileTree, readNote);

      if (generationRef.current === gen) {
        setSearchIndex({ items, status: 'ready', error: null });
      }
    } catch (err) {
      if (generationRef.current === gen) {
        setSearchIndex({
          items: [],
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to build search index.',
        });
      }
    }
  }, [vaultId, fileTree]);

  // Phase 4-4-B TD: Make the in-memory SearchIndex lazy.
  // SQLite (useSqliteSearch) is the primary search data source;
  // the in-memory index is a fallback.  Do NOT auto-rebuild on
  // vault open — build on-demand via explicit rebuildSearchIndex() or
  // when the index is first queried while empty.
  //
  // Only reset when vault is closed (vaultId → null).
  useEffect(() => {
    if (!vaultId) setSearchIndex(EMPTY_SEARCH_INDEX);
  }, [vaultId]);

  /**
   * Incrementally update the SearchIndex for a single file by reading
   * its current disk content.  Skips silently if the file cannot be
   * read (e.g. it was deleted between the event and this call).
   */
  const updateSearchIndexForFile = useCallback(
    async (relativePath: string): Promise<void> => {
      if (!vaultId) return;

      try {
        const { content } = await readNote(vaultId, relativePath);

        setSearchIndex((prev) => {
          // Only mutate a ready index — ignore race with a full rebuild
          if (prev.status !== 'ready') return prev;

          const newItems = doUpdateSearchIndexForFile(
            prev.items,
            relativePath,
            content,
          );

          return { ...prev, items: newItems };
        });
      } catch {
        // File may be unreadable / deleted — skip this update
      }
    },
    [vaultId],
  );

  /**
   * Process a batch of watcher events and decide which SearchIndex
   * updates to apply.
   *
   * Strategy (Phase 2-C-4):
   * - file-added / file-changed + markdown: read and update incrementally,
   *   UNLESS the file is dirty or has an active external conflict.
   * - file-deleted + markdown: remove from index, UNLESS the file is
   *   dirty (preserve the old item to avoid search disappearing while
   *   the user still sees the content in the editor).
   * - folder-deleted: remove all items under that folder prefix from
   *   the index.
   * - Complex / oversized batches fall back to full rebuild.
   */
  const handleSearchFileEvents = useCallback(
    async (input: HandleSearchFileEventsInput): Promise<void> => {
      if (!vaultId) return;

      const { events, dirtyFiles, externalConflicts } = input;

      // Separate events by type for batch handling
      const addUpdatePaths = new Set<string>();
      const removePaths = new Set<string>();
      const removePrefixes = new Set<string>();

      for (const event of events) {
        if (event.type === 'file-added' || event.type === 'file-changed') {
          if (!('fileKind' in event) || event.fileKind !== 'markdown') continue;

          const { relativePath } = event;

          // Skip files with unsaved changes or active external conflicts.
          if (dirtyFiles.has(relativePath)) continue;
          if (externalConflicts.get(relativePath)?.kind === 'modified') continue;
          if (externalConflicts.get(relativePath)?.kind === 'deleted') continue;

          addUpdatePaths.add(relativePath);
        } else if (event.type === 'file-deleted') {
          if (!('fileKind' in event) || event.fileKind !== 'markdown') continue;

          const { relativePath } = event;

          // Keep dirty deleted files in the index so search results
          // don't vanish while the user still sees content in the editor.
          if (dirtyFiles.has(relativePath)) continue;

          removePaths.add(relativePath);
        } else if (event.type === 'folder-deleted') {
          removePrefixes.add(event.relativePath);
        }
        // folder-added / image / other — no SearchIndex change
      }

      // If the batch is large or too complex, fall back to full rebuild
      const totalOps = addUpdatePaths.size + removePaths.size + removePrefixes.size;
      if (totalOps > 20) {
        void rebuildSearchIndex();
        return;
      }

      if (totalOps === 0) return;

      // Read and update files in parallel
      await Promise.allSettled(
        [...addUpdatePaths].map((rp) => updateSearchIndexForFile(rp)),
      );

      // Apply removes via functional setState
      if (removePaths.size > 0 || removePrefixes.size > 0) {
        setSearchIndex((prev) => {
          if (prev.status !== 'ready') return prev;
          let items = prev.items;
          for (const rp of removePaths) {
            items = doRemoveSearchIndexForFile(items, rp);
          }
          for (const prefix of removePrefixes) {
            items = doRemoveSearchIndexForFolder(items, prefix);
          }
          return { ...prev, items };
        });
      }
    },
    [vaultId, updateSearchIndexForFile, rebuildSearchIndex],
  );

  const query = useCallback(
    (q: string): SearchMatch[] => {
      if (searchIndex.status !== 'ready') return [];
      return doSearch(q, searchIndex.items);
    },
    [searchIndex],
  );

  return { searchIndex, rebuildSearchIndex, handleSearchFileEvents, updateSearchIndexForFile, query };
}
