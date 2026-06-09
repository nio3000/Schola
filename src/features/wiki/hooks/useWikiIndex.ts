/**
 * React hook for managing the wikilink index lifecycle.
 *
 * Rebuilds the index when the vault changes, and exposes a manual
 * rebuild function for use after save / create operations.
 *
 * Phase 2-C-3 adds incremental index updates for single-file
 * content changes so that the watcher does not trigger a full
 * vault re-read on every external edit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileEntry, VaultFileEvent } from '../../../lib/contracts/vault.types';
import { readNote } from '../../../lib/platform/schola-api';
import {
  buildWikiIndex,
  EMPTY_INDEX,
  updateWikiIndexForFile as doUpdateWikiIndexForFile,
  type WikiIndexSnapshot,
} from '../lib/wikiIndex';
import { getMarkdownPaths } from '../lib/fileTreeUtils';

export interface UseWikiIndexInput {
  readonly vaultId: string | null;
  readonly fileTree: readonly FileEntry[];
}

interface HandleWikiFileEventsInput {
  /** The raw watcher event batch */
  readonly events: readonly VaultFileEvent[];
  /** Currently open files (open in tabs) */
  readonly openFiles: readonly string[];
  /** Files with unsaved (dirty) editor content */
  readonly dirtyFiles: ReadonlySet<string>;
  /** Active external conflict entries keyed by relativePath */
  readonly externalConflicts: ReadonlyMap<string, { readonly kind: 'modified' | 'deleted' }>;
}

export interface UseWikiIndexOutput {
  readonly wikiIndex: WikiIndexSnapshot;
  /** Full rebuild (unchanged — kept as safety fallback and for structural changes) */
  readonly rebuildWikiIndex: () => Promise<void>;
  /**
   * Process a batch of watcher events and update the WikiIndex
   * incrementally where safe, falling back to a full rebuild
   * for structural changes.
   */
  readonly handleWikiFileEvents: (input: HandleWikiFileEventsInput) => Promise<void>;
  /**
   * Incrementally update the WikiIndex for a single file by reading
   * its current disk content.  Used after internal save / external reload.
   */
  readonly updateWikiIndexForFile: (relativePath: string) => Promise<void>;
  /** Look up backlinks for a given file */
  readonly getBacklinksForFile: (relativePath: string) => readonly string[];
}

export function useWikiIndex({ vaultId, fileTree }: UseWikiIndexInput): UseWikiIndexOutput {
  const [wikiIndex, setWikiIndex] = useState<WikiIndexSnapshot>(EMPTY_INDEX);

  // Track the rebuild generation to avoid stale updates
  const generationRef = useRef(0);

  // Keep a ref to the latest fileTree so async incremental updates
  // always resolve targets against the current tree snapshot.
  const fileTreeRef = useRef(fileTree);
  useEffect(() => {
    fileTreeRef.current = fileTree;
  }, [fileTree]);

  const rebuildWikiIndex = useCallback(async (): Promise<void> => {
    if (!vaultId) {
      setWikiIndex(EMPTY_INDEX);
      return;
    }

    const gen = ++generationRef.current;

    setWikiIndex((prev) => ({ ...prev, status: 'indexing', error: null }));

    try {
      const data = await buildWikiIndex(vaultId, fileTree, readNote);

      // Only apply if this is still the latest generation
      if (generationRef.current === gen) {
        setWikiIndex({ data, status: 'ready', error: null });
      }
    } catch (err) {
      if (generationRef.current === gen) {
        setWikiIndex({
          data: EMPTY_INDEX.data,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to build wikilink index.',
        });
      }
    }
  }, [vaultId, fileTree]);

  // Phase 4-4-B TD: Make the in-memory WikiIndex lazy.
  // SQLite is the primary data source for backlinks/graph;
  // the in-memory index is a fallback.  Do NOT auto-rebuild on
  // vault open — build on-demand via explicit rebuildWikiIndex() or
  // when the index is first accessed while empty.
  //
  // Only reset when vault is closed (vaultId → null).
  useEffect(() => {
    if (!vaultId) setWikiIndex(EMPTY_INDEX);
  }, [vaultId]);

  /**
   * Incrementally update the WikiIndex for a single file by reading
   * its current disk content.  Skips silently if the file cannot be
   * read (e.g. it was deleted between the event and this call).
   */
  const updateWikiIndexForFile = useCallback(
    async (relativePath: string): Promise<void> => {
      if (!vaultId) return;

      try {
        const { content } = await readNote(vaultId, relativePath);

        setWikiIndex((prev) => {
          // Only mutate a ready index — ignore race with a full rebuild
          if (prev.status !== 'ready') return prev;

          const newData = doUpdateWikiIndexForFile(
            prev.data,
            fileTreeRef.current,
            relativePath,
            content,
          );

          return { ...prev, data: newData };
        });
      } catch {
        // File may be unreadable / deleted — skip this update
      }
    },
    [vaultId],
  );

  /**
   * Process a batch of watcher events and decide which WikiIndex
   * updates to apply.
   *
   * Strategy (Phase 2-C-3):
   * - Structural changes (add / delete / folder) are handled by the
   *   existing useEffects that rebuild on fileTree / mdPathCount change.
   *   We do NOT double-trigger a rebuild here.
   * - Content-only changes (file-changed + markdown) are processed
   *   incrementally: we read only the changed files and update
   *   the index in place — UNLESS the file is dirty or has an
   *   active external conflict (to keep the index consistent with
   *   what the user sees in the editor).
   */
  const handleWikiFileEvents = useCallback(
    async (input: HandleWikiFileEventsInput): Promise<void> => {
      if (!vaultId) return;

      const { events, dirtyFiles, externalConflicts } = input;

      // Deduplicate by relativePath — read each changed file at most once
      const seen = new Set<string>();
      const toUpdate: string[] = [];

      for (const event of events) {
        if (
          !('fileKind' in event) ||
          event.fileKind !== 'markdown' ||
          event.type !== 'file-changed'
        ) {
          continue;
        }

        const { relativePath } = event;
        if (seen.has(relativePath)) continue;
        seen.add(relativePath);

        // Skip files with unsaved changes or active external conflicts.
        // Reading the disk version would make the index disagree with
        // the editor content the user is looking at.
        if (dirtyFiles.has(relativePath)) continue;
        if (externalConflicts.get(relativePath)?.kind === 'modified') continue;
        // Deleted-conflict files don't exist on disk — skip
        if (externalConflicts.get(relativePath)?.kind === 'deleted') continue;

        toUpdate.push(relativePath);
      }

      if (toUpdate.length === 0) return;

      // Read and update each file in parallel
      await Promise.allSettled(
        toUpdate.map((rp) => updateWikiIndexForFile(rp)),
      );
    },
    [vaultId, updateWikiIndexForFile],
  );

  const getBacklinksForFile = useCallback(
    (relativePath: string): readonly string[] => {
      return wikiIndex.data.incomingByPath[relativePath] ?? [];
    },
    [wikiIndex.data.incomingByPath],
  );

  return { wikiIndex, rebuildWikiIndex, handleWikiFileEvents, updateWikiIndexForFile, getBacklinksForFile };
}
