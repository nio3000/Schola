/**
 * Shared wikilink parsing and resolution utilities.
 *
 * Located in src/lib/ so both the renderer (src/features/) and the
 * Electron main process (electron/services/) can import them.
 * No electron / react dependencies.
 */

import type { FileEntry } from './contracts/vault.types';
import { flattenFiles, isMarkdownFile, stripExtension } from './fileTreeUtils';

export interface WikilinkRaw {
  readonly target: string;
  readonly alias: string | null;
}

const WIKILINK_RE = /\[\[([^\]|#]+?)(?:[|#]([^\]]+?))?]]/g;

/** The wikilink regex used for both extraction and replacement. */
export const WIKILINK_REGEX = WIKILINK_RE;

/** Extract all wikilinks from Markdown content. */
export function extractWikilinks(content: string): readonly WikilinkRaw[] {
  const links: WikilinkRaw[] = [];
  let match: RegExpExecArray | null;

  WIKILINK_RE.lastIndex = 0;

  while ((match = WIKILINK_RE.exec(content)) !== null) {
    links.push({
      target: match[1].trim(),
      alias: match[2] ? match[2].trim() : null,
    });
  }

  return links;
}

/** Extract heading texts from a Markdown content string (without # prefix, trimmed). */
export function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  const re = /^#{1,6}\s+(.+)$/gm;
  let match = re.exec(content);
  while (match !== null) {
    headings.push(match[1].trim());
    match = re.exec(content);
  }
  return headings;
}

/**
 * Resolve a wikilink target to a file relativePath.
 *
 * Resolution strategy (in priority order):
 * 1. Exact relative-path match: `folder/B` matches `folder/B.md`
 * 2. Basename match: `B` matches exactly one `B.md` in the vault
 * 3. Multiple basename matches → return null (ambiguous)
 * 4. No match → return null (unresolved)
 */
export function resolveWikilinkPathEnhanced(
  target: string,
  fileTree: readonly FileEntry[],
): string | null {
  const normalizedTarget = target.replace(/\\/g, '/').trim();
  if (!normalizedTarget) return null;

  const files = flattenFiles(fileTree).filter((f) => isMarkdownFile(f.name));
  const lowerTarget = normalizedTarget.toLowerCase();

  // Step 1: Exact relative-path match (no extension)
  const exactMatches: string[] = [];
  for (const file of files) {
    const withoutExt = stripExtension(file.relativePath).replace(/\\/g, '/');
    if (withoutExt.toLowerCase() === lowerTarget) {
      exactMatches.push(file.relativePath);
    }
  }
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }
  if (exactMatches.length > 1) {
    return null;
  }

  // Step 2: If target has a path separator, only exact match is valid
  if (normalizedTarget.includes('/')) {
    return null;
  }

  // Step 3: Basename-only match
  const basenameMatches: string[] = [];
  for (const file of files) {
    const baseLower = stripExtension(file.name).toLowerCase();
    if (baseLower === lowerTarget) {
      basenameMatches.push(file.relativePath);
    }
  }

  if (basenameMatches.length === 1) {
    return basenameMatches[0];
  }

  return null;
}
