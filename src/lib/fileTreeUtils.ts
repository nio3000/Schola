/**
 * Shared file-tree utilities for wikilink resolution and index building.
 *
 * Located in src/lib/ so both the renderer (src/features/) and the
 * Electron main process (electron/services/) can import them.
 * No fs/path, no Electron, no backend dependencies.
 */

import type { FileEntry } from './contracts/vault.types';

/** Recursively flatten a file tree into a flat list of file entries (directories excluded) */
export function flattenFiles(entries: readonly FileEntry[]): readonly FileEntry[] {
  const result: FileEntry[] = [];
  for (const entry of entries) {
    if (entry.type === 'file') {
      result.push(entry);
    }
    if (entry.children) {
      result.push(...flattenFiles(entry.children));
    }
  }
  return result;
}

/** Check if a file name ends with .md or .markdown (case-insensitive) */
export function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown)$/i.test(name);
}

/** Strip .md or .markdown extension from a filename */
export function stripExtension(name: string): string {
  return name.replace(/\.(md|markdown)$/i, '');
}

/** Return all .md / .markdown file relative paths from a file tree */
export function getMarkdownPaths(fileTree: readonly FileEntry[]): readonly string[] {
  return flattenFiles(fileTree)
    .filter((f) => isMarkdownFile(f.name))
    .map((f) => f.relativePath);
}
