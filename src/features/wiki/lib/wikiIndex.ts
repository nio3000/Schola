/**
 * WikiIndex — in-memory wikilink index for a vault.
 *
 * Built entirely in the frontend using existing readNote + scanVault APIs.
 * No backend, no IPC, no SQLite, no persistence.
 */

import type { FileEntry } from '../../../lib/contracts/vault.types';
import { extractWikilinks } from '../../../lib/wiki-parsers';
import { resolveWikilinkPathEnhanced } from '../../../lib/wiki-parsers';
import { extractHeadings } from '../../../lib/wiki-parsers';
import { getMarkdownPaths } from '../../../lib/fileTreeUtils';

/** Extract heading texts from a Markdown content string */
export { extractHeadings } from '../../../lib/wiki-parsers';


export interface WikiIndexData {
  /** Source file → list of resolved target file paths it links to */
  readonly outgoingByPath: Record<string, string[]>;
  /** Target file → list of source files that link to it (backlinks) */
  readonly incomingByPath: Record<string, string[]>;
  /** Source file → list of wikilink targets that could not be resolved */
  readonly unresolvedByPath: Record<string, string[]>;
}

export type WikiIndexStatus = 'idle' | 'indexing' | 'ready' | 'error';

export interface WikiIndexSnapshot {
  readonly data: WikiIndexData;
  readonly status: WikiIndexStatus;
  readonly error: string | null;
}

export const EMPTY_INDEX_DATA: WikiIndexData = {
  outgoingByPath: {},
  incomingByPath: {},
  unresolvedByPath: {},
};

export const EMPTY_INDEX: WikiIndexSnapshot = {
  data: EMPTY_INDEX_DATA,
  status: 'idle',
  error: null,
};

/** Result of reading a single file for index building */
export interface FileReadResult {
  readonly relativePath: string;
  readonly links: readonly { readonly target: string; readonly alias: string | null }[];
  /** All heading texts extracted from the file (without # prefix, trimmed) */
  readonly headings: readonly string[];
}


/**
 * Build a complete WikiIndex by reading ALL markdown files in the vault.
 *
 * Uses the provided readNote function to fetch content, then extracts
 * wikilinks and resolves them against the file tree.
 *
 * Reading failures on individual files are tolerated — the index is built
 * from whatever files could be read successfully.
 */
export async function buildWikiIndex(
  vaultId: string,
  fileTree: readonly FileEntry[],
  readNote: (vaultId: string, relativePath: string) => Promise<{ readonly content: string }>,
): Promise<WikiIndexData> {
  const mdPaths = getMarkdownPaths(fileTree);

  // Read all markdown files in parallel (6 concurrent batches)
  const BATCH_SIZE = 6;
  const results: FileReadResult[] = [];

  for (let i = 0; i < mdPaths.length; i += BATCH_SIZE) {
    const batch = mdPaths.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (relativePath) => {
        const note = await readNote(vaultId, relativePath);
        const links = extractWikilinks(note.content);
        const headings = extractHeadings(note.content);
        return { relativePath, links, headings };
      }),
    );

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
      // Rejected reads are silently skipped — the file may be unreadable
    }
  }

  // Build outgoing, incoming, and unresolved maps
  const outgoingByPath: Record<string, string[]> = {};
  const incomingByPath: Record<string, string[]> = {};
  const unresolvedByPath: Record<string, string[]> = {};

  for (const { relativePath, links } of results) {
    const resolved: string[] = [];
    const unresolved: string[] = [];

    for (const link of links) {
      const resolvedPath = resolveWikilinkPathEnhanced(link.target, fileTree);
      if (resolvedPath) {
        resolved.push(resolvedPath);
      } else {
        unresolved.push(link.target);
      }
    }

    outgoingByPath[relativePath] = resolved;

    if (unresolved.length > 0) {
      unresolvedByPath[relativePath] = unresolved;
    }

    // Build reverse index (incoming / backlinks)
    for (const target of resolved) {
      if (!incomingByPath[target]) {
        incomingByPath[target] = [];
      }
      if (!incomingByPath[target].includes(relativePath)) {
        incomingByPath[target].push(relativePath);
      }
    }
  }

  return { outgoingByPath, incomingByPath, unresolvedByPath };
}

// ── Phase 2-C-3: incremental index operations ──

/**
 * Derive the incoming (backlinks) map from a complete outgoing map.
 *
 * Pure function — does not mutate inputs.
 */
export function deriveIncomingFromOutgoing(
  outgoingByPath: Record<string, string[]>,
): Record<string, string[]> {
  const incoming: Record<string, string[]> = {};

  for (const [source, targets] of Object.entries(outgoingByPath)) {
    for (const target of targets) {
      if (!incoming[target]) {
        incoming[target] = [];
      }
      if (!incoming[target].includes(source)) {
        incoming[target].push(source);
      }
    }
  }

  return incoming;
}

/**
 * Incrementally update the WikiIndex for a single file.
 *
 * Reads the file's wikilinks from `content`, resolves them against
 * `fileTree`, and replaces the file's entries in outgoing / incoming /
 * unresolved maps.  Incoming is fully re-derived from the new outgoing
 * map — this is safer than patching incoming incrementally.
 *
 * Returns a new WikiIndexData; does not mutate `currentIndex`.
 */
export function updateWikiIndexForFile(
  currentIndex: WikiIndexData,
  fileTree: readonly FileEntry[],
  relativePath: string,
  content: string,
): WikiIndexData {
  // 1. Clone outgoing — remove old entry for this source
  const newOutgoing: Record<string, string[]> = { ...currentIndex.outgoingByPath };
  delete newOutgoing[relativePath];

  // 2. Clone unresolved — remove old entry for this source
  const newUnresolved: Record<string, string[]> = { ...currentIndex.unresolvedByPath };
  delete newUnresolved[relativePath];

  // 3. Extract wikilinks from the new content
  const links = extractWikilinks(content);
  const resolved: string[] = [];
  const unresolved: string[] = [];

  for (const link of links) {
    const resolvedPath = resolveWikilinkPathEnhanced(link.target, fileTree);
    if (resolvedPath) {
      resolved.push(resolvedPath);
    } else {
      unresolved.push(link.target);
    }
  }

  // 4. Write new outgoing
  if (resolved.length > 0) {
    newOutgoing[relativePath] = resolved;
  }

  // 5. Write new unresolved
  if (unresolved.length > 0) {
    newUnresolved[relativePath] = unresolved;
  }

  // 6. Re-derive incoming from the complete outgoing map
  const newIncoming = deriveIncomingFromOutgoing(newOutgoing);

  return {
    outgoingByPath: newOutgoing,
    incomingByPath: newIncoming,
    unresolvedByPath: newUnresolved,
  };
}

/**
 * Remove a file from the WikiIndex.
 *
 * Clears the file's outgoing and unresolved entries, then re-derives
 * incoming from the remaining outgoing map.
 *
 * NOTE: This only removes the file as a *source*.  If other files
 * had wikilinks that resolved to this file (i.e. this file was a
 * *target*), those are NOT recalculated here — callers should
 * follow up with a full rebuild or a re-resolve pass.
 *
 * Returns a new WikiIndexData; does not mutate `currentIndex`.
 */
export function removeWikiIndexForFile(
  currentIndex: WikiIndexData,
  relativePath: string,
): WikiIndexData {
  const newOutgoing = { ...currentIndex.outgoingByPath };
  delete newOutgoing[relativePath];

  const newUnresolved = { ...currentIndex.unresolvedByPath };
  delete newUnresolved[relativePath];

  const newIncoming = deriveIncomingFromOutgoing(newOutgoing);

  return {
    outgoingByPath: newOutgoing,
    incomingByPath: newIncoming,
    unresolvedByPath: newUnresolved,
  };
}
