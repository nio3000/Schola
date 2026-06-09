/**
 * SearchIndex — in-memory search index for a vault.
 *
 * Built from the same FileReadResult batch as WikiIndex, so both
 * indexes share one file-reading pass with zero extra IPC overhead.
 * No backend, no IPC, no SQLite, no persistence.
 */

import type { FileEntry } from '../../../lib/contracts/vault.types';
import { getMarkdownPaths } from '../../../lib/fileTreeUtils';
import { extractWikilinks } from '../../../lib/wiki-parsers';
import { extractHeadings } from '../../../lib/wiki-parsers';

// ── Types ─────────────────────────────────────

export interface SearchIndexItem {
  /** Vault-relative path, e.g. "docs/design/intro.md" */
  readonly relativePath: string;
  /** File name without directory, e.g. "intro.md" */
  readonly fileName: string;
  /** Directory portion, e.g. "docs/design" */
  readonly directory: string;
  /** All heading texts (without # prefix, trimmed) */
  readonly headings: readonly string[];
  /** All unique wikilink targets found in this file */
  readonly wikilinkTargets: readonly string[];
}

export type SearchMatchType = 'fileName' | 'path' | 'heading' | 'wikilink';

export interface SearchMatch {
  readonly relativePath: string;
  readonly matchType: SearchMatchType;
  readonly matchedText: string;
  /** Lower = higher priority */
  readonly rank: number;
}

export type SearchIndexStatus = 'idle' | 'building' | 'ready' | 'error';

export interface SearchIndexSnapshot {
  readonly items: readonly SearchIndexItem[];
  readonly status: SearchIndexStatus;
  readonly error: string | null;
}

// ── Constants ─────────────────────────────────

export const EMPTY_SEARCH_INDEX: SearchIndexSnapshot = {
  items: [],
  status: 'idle',
  error: null,
};

const MAX_RESULTS = 50;

// ── Item builder ──────────────────────────────

/**
 * Parse a single Markdown file's raw content into a SearchIndexItem.
 * Pure function — no side effects.
 */
export function parseSearchItem(
  relativePath: string,
  content: string,
): SearchIndexItem {
  const fileName = relativePath.split('/').pop() ?? relativePath;
  const slashIdx = relativePath.lastIndexOf('/');
  const directory = slashIdx >= 0 ? relativePath.slice(0, slashIdx) : '';

  const headings = extractHeadings(content);
  const links = extractWikilinks(content);
  const wikilinkTargets = [...new Set(links.map((link) => link.target))] as string[];

  return {
    relativePath,
    fileName,
    directory,
    headings,
    wikilinkTargets,
  };
}

/**
 * Build a SearchIndex by reading ALL markdown files in the vault.
 *
 * Uses the same readNote function as WikiIndex; failure is tolerant.
 */
export async function buildSearchIndex(
  vaultId: string,
  fileTree: readonly FileEntry[],
  readNote: (vaultId: string, relativePath: string) => Promise<{ readonly content: string }>,
): Promise<readonly SearchIndexItem[]> {
  const mdPaths = getMarkdownPaths(fileTree);
  const items: SearchIndexItem[] = [];

  const BATCH_SIZE = 6;
  for (let i = 0; i < mdPaths.length; i += BATCH_SIZE) {
    const batch = mdPaths.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (relativePath) => {
        const note = await readNote(vaultId, relativePath);
        return parseSearchItem(relativePath, note.content);
      }),
    );

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        items.push(result.value);
      }
    }
  }

  return items;
}

// ── Phase 2-C-4: incremental index operations ──

/**
 * Incrementally update the SearchIndex for a single file.
 *
 * Parses the file's content into a new SearchIndexItem, removes any
 * existing item for the same relativePath, and appends the new one.
 *
 * Returns a new array; does not mutate `items`.
 */
export function updateSearchIndexForFile(
  items: readonly SearchIndexItem[],
  relativePath: string,
  content: string,
): readonly SearchIndexItem[] {
  const nextItem = parseSearchItem(relativePath, content);
  return [
    ...items.filter((item) => item.relativePath !== relativePath),
    nextItem,
  ];
}

/**
 * Remove a single file from the SearchIndex.
 *
 * Returns a new array; does not mutate `items`.
 */
export function removeSearchIndexForFile(
  items: readonly SearchIndexItem[],
  relativePath: string,
): readonly SearchIndexItem[] {
  return items.filter((item) => item.relativePath !== relativePath);
}

/**
 * Remove all files under a folder from the SearchIndex.
 *
 * Matches any item whose relativePath starts with `folderRelativePath/`.
 * Returns a new array; does not mutate `items`.
 */
export function removeSearchIndexForFolder(
  items: readonly SearchIndexItem[],
  folderRelativePath: string,
): readonly SearchIndexItem[] {
  const prefix = `${folderRelativePath}/`;
  return items.filter((item) => !item.relativePath.startsWith(prefix));
}

// ── Matcher ───────────────────────────────────

const RANK_EXACT_FILE = 1;
const RANK_STARTS_FILE = 2;
const RANK_CONTAINS_FILE = 3;
const RANK_PATH = 4;
const RANK_HEADING = 5;
const RANK_WIKILINK = 6;

function rankFileName(fileName: string, lowerQuery: string): number | null {
  const lower = fileName.toLowerCase();
  const withoutExt = lower.replace(/\.(md|markdown)$/i, '');
  if (withoutExt === lowerQuery) return RANK_EXACT_FILE;
  if (withoutExt.startsWith(lowerQuery)) return RANK_STARTS_FILE;
  if (lower.includes(lowerQuery)) return RANK_CONTAINS_FILE;
  return null;
}

function rankToMatchType(rank: number): SearchMatchType {
  if (rank <= RANK_CONTAINS_FILE) return 'fileName';
  if (rank === RANK_PATH) return 'path';
  if (rank === RANK_HEADING) return 'heading';
  return 'wikilink';
}

/**
 * Search the index and return ranked matches (max 50).
 *
 * Case-insensitive substring matching across fileName, path, headings,
 * and wikilink targets. Each file appears at most once.
 */
export function searchIndex(
  query: string,
  index: readonly SearchIndexItem[],
): SearchMatch[] {
  const lowerQuery = query.toLowerCase().trim();
  if (lowerQuery.length === 0) return [];

  const matches: SearchMatch[] = [];

  for (const item of index) {
    let bestRank = Number.MAX_SAFE_INTEGER;
    let bestText = '';

    // 1. File name
    const fnRank = rankFileName(item.fileName, lowerQuery);
    if (fnRank !== null && fnRank < bestRank) {
      bestRank = fnRank;
      bestText = item.fileName;
    }

    // 2. Path
    if (item.relativePath.toLowerCase().includes(lowerQuery) && RANK_PATH < bestRank) {
      bestRank = RANK_PATH;
      bestText = item.relativePath;
    }

    // 3. Headings
    for (const h of item.headings) {
      if (h.toLowerCase().includes(lowerQuery) && RANK_HEADING < bestRank) {
        bestRank = RANK_HEADING;
        bestText = h;
        break;
      }
    }

    // 4. Wikilink targets
    for (const t of item.wikilinkTargets) {
      if (t.toLowerCase().includes(lowerQuery) && RANK_WIKILINK < bestRank) {
        bestRank = RANK_WIKILINK;
        bestText = t;
        break;
      }
    }

    if (bestRank <= RANK_WIKILINK) {
      matches.push({
        relativePath: item.relativePath,
        matchType: rankToMatchType(bestRank),
        matchedText: bestText,
        rank: bestRank,
      });
    }
  }

  // Stable sort: rank ASC, then relativePath ASC
  matches.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.relativePath.localeCompare(b.relativePath, 'zh-CN');
  });

  return matches.slice(0, MAX_RESULTS);
}
