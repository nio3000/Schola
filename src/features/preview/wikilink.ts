import type { FileEntry } from '../../lib/contracts/vault.types';
import { flattenFiles, stripExtension } from '../../lib/fileTreeUtils';
import { extractWikilinks } from '../../lib/wiki-parsers';
import { WIKILINK_REGEX } from '../../lib/wiki-parsers';
import { resolveWikilinkPathEnhanced } from '../../lib/wiki-parsers';

export type { WikilinkRaw } from '../../lib/wiki-parsers';

export interface WikilinkMatch {
  readonly target: string;
  readonly alias: string | null;
  readonly exists: boolean;
  readonly relativePath: string | null;
}

export { extractWikilinks };

export function resolveWikilinkPath(target: string, fileTree: readonly FileEntry[]): string | null {
  const normalized = target.toLowerCase();
  const files = flattenFiles(fileTree);

  for (const file of files) {
    if (stripExtension(file.name).toLowerCase() === normalized) {
      return file.relativePath;
    }
  }

  return null;
}

export function resolveWikilinkMatches(
  content: string,
  fileTree: readonly FileEntry[],
): readonly WikilinkMatch[] {
  const raws = extractWikilinks(content);

  return raws.map((raw) => {
    const resolved = resolveWikilinkPathEnhanced(raw.target, fileTree);

    return {
      target: raw.target,
      alias: raw.alias,
      exists: resolved !== null,
      relativePath: resolved,
    };
  });
}

const WIKILINK_HREF_PREFIX = 'schola-wikilink:';

export function replaceWikilinksForRendering(content: string, existingNotes: Set<string>): string {
  return content.replace(WIKILINK_REGEX, (_full, note: string, alias: string | undefined) => {
    const display = (alias ?? note).trim();
    const target = note.trim();
    const encoded = encodeURIComponent(target);
    const exists = existingNotes.has(target.toLowerCase());
    const existsAttr = exists ? '' : ' data-exists="false"';
    const title = exists ? '' : ` title="The note '${target}' has not been created yet"`;

    return `<a href="${WIKILINK_HREF_PREFIX}${encoded}"${existsAttr}${title}>${display}</a>`;
  });
}

export function isWikilinkHref(href: string): boolean {
  return href.startsWith(WIKILINK_HREF_PREFIX);
}

export function parseWikilinkHref(href: string): string | null {
  if (!isWikilinkHref(href)) {
    return null;
  }

  return decodeURIComponent(href.slice(WIKILINK_HREF_PREFIX.length));
}
