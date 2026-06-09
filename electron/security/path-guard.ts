import path from 'node:path';

function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

export function assertPathInsideRoot(rootPath: string, candidatePath: string): void {
  if (!isPathInsideRoot(rootPath, candidatePath)) {
    throw new Error('Path escapes the vault root.');
  }
}

export function normalizeVaultRoot(rootPath: string): string {
  const resolvedRoot = path.resolve(rootPath);

  if (resolvedRoot.trim().length === 0) {
    throw new Error('Vault root path is empty.');
  }

  return resolvedRoot;
}

export function toVaultRelativePath(rootPath: string, absolutePath: string): string {
  const resolvedRoot = normalizeVaultRoot(rootPath);
  const resolvedPath = path.resolve(absolutePath);

  if (!isPathInsideRoot(resolvedRoot, resolvedPath)) {
    throw new Error('Path escapes the vault root.');
  }

  return path.relative(resolvedRoot, resolvedPath).split(path.sep).join('/');
}

export function resolveVaultPath(rootPath: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error('Vault relative path must not be absolute.');
  }

  const resolvedRoot = normalizeVaultRoot(rootPath);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);

  if (!isPathInsideRoot(resolvedRoot, resolvedPath)) {
    throw new Error('Path escapes the vault root.');
  }

  return resolvedPath;
}

/**
 * Directories that must be excluded from vault scanning, file-tree rendering,
 * watcher events, search indexing, wiki indexing, backlinks, and graph.
 *
 * Phase 3-1-A: _exports (export artifacts) and _trash (soft-delete recycle bin).
 */
const EXCLUDED_SYSTEM_DIRECTORIES = new Set(['_exports', '_trash']);

/**
 * Check whether a vault-relative path (POSIX or Windows) belongs to an
 * excluded system directory.  Path-segment based — avoids false positives
 * like "notes/my-exports-note.md".
 */
export function isExcludedSystemPath(relativePath: string): boolean {
  const segments = relativePath.replace(/\\/g, '/').split('/');
  for (const segment of segments) {
    if (EXCLUDED_SYSTEM_DIRECTORIES.has(segment)) {
      return true;
    }
  }
  return false;
}

/** Directory names skipped during vault scan (in addition to dot-prefixed dirs). */
export const SKIP_SCAN_DIRECTORIES = EXCLUDED_SYSTEM_DIRECTORIES;