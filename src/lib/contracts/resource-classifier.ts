/**
 * Resource classifier — Phase 5-4A-IMP-1.
 *
 * Pure functions for classifying file extensions into ResourceKind
 * and mapping kinds to viewer types and import subdirectories.
 *
 * ⚠️  All functions are pure — no file I/O, no network, no system paths.
 */

import type { ResourceKind, ResourceViewerKind } from './resource.types';

// ── Extension → Kind Map ────────────────────────

/**
 * Whitelist of supported file extensions mapped to ResourceKind.
 * Only safe, document-type extensions are included.
 * Extensions like .exe, .js, .bat, .cmd are intentionally absent.
 */
export const EXTENSION_KIND_MAP = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.pdf': 'pdf',
  '.html': 'html',
  '.htm': 'html',
  '.docx': 'docx',
  '.doc': 'doc',
  '.pptx': 'pptx',
  '.xlsx': 'xlsx',
  '.xls': 'xls',
  '.csv': 'csv',
  '.txt': 'txt',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
} as const satisfies Record<string, ResourceKind>;

type KnownExtension = keyof typeof EXTENSION_KIND_MAP;

// ── Safe Resource Name ──────────────────────────

/**
 * Sanitize a filename for safe filesystem storage.
 * Strips control characters, path separators, and other unsafe chars.
 * Truncates to max 200 characters. Falls back to 'resource' for empty results.
 */
export function safeResourceName(original: string): string {
  return original.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 200) || 'resource';
}

// ── Kind → Subdirectory Map ─────────────────────

/**
 * Maps ResourceKind to the import target subdirectory.
 * markdown stays in notes/; all others go to resources/<kind>/.
 */
export const RESOURCE_KIND_SUBDIR_MAP = {
  markdown: 'notes',
  pdf: 'resources/pdf',
  html: 'resources/html',
  docx: 'resources/docx',
  doc: 'resources/doc',
  pptx: 'resources/pptx',
  xlsx: 'resources/xlsx',
  xls: 'resources/xls',
  csv: 'resources/csv',
  txt: 'resources/txt',
  image: 'resources/images',
  other: 'resources/other',
} as const satisfies Record<ResourceKind, string>;

// ── Extension Normalization ─────────────────────

/**
 * Normalize a file extension string.
 * - Trims whitespace
 * - Lowercases
 * - Adds leading dot if missing
 * - Extracts the last extension for multi-dot filenames
 *
 * Returns empty string for empty input or files with no extension.
 */
export function normalizeResourceExtension(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return '';

  const lower = trimmed.toLowerCase();

  // Handle cases like "PDF" → ".pdf"
  if (!lower.startsWith('.')) {
    return '.' + lower;
  }

  // For multi-dot paths like "archive.tar.gz", take the last component
  // This is called with a filename, so "paper.v1.final.pdf" → ".pdf"
  // The path parsing is done separately in getResourceKindByPath
  return lower;
}

// ── Kind Classification ─────────────────────────

/**
 * Get ResourceKind from a normalized extension string.
 * Falls back to 'other' for unknown extensions.
 */
export function getResourceKindByExtension(extension: string): ResourceKind {
  const normalized = normalizeResourceExtension(extension);
  if (normalized === '') return 'other';
  if (normalized in EXTENSION_KIND_MAP) {
    return EXTENSION_KIND_MAP[normalized as KnownExtension];
  }
  return 'other';
}

/**
 * Get ResourceKind from a vault-relative file path.
 * Extracts the extension from the last path segment.
 * Hidden files (starting with dot, no secondary extension) return 'other'.
 */
export function getResourceKindByPath(relativePath: string): ResourceKind {
  if (!relativePath || relativePath.trim().length === 0) return 'other';

  const segments = relativePath.replace(/\\/g, '/').split('/');
  const fileName = segments[segments.length - 1] ?? '';

  if (fileName.length === 0) return 'other';

  // Hidden files like ".env" or ".gitignore" — no secondary extension
  if (fileName.startsWith('.') && fileName.lastIndexOf('.') === 0) {
    return 'other';
  }

  const lastDot = fileName.lastIndexOf('.');
  if (lastDot < 0) return 'other'; // no extension

  const ext = fileName.slice(lastDot).toLowerCase();
  return getResourceKindByExtension(ext);
}

// ── Viewer Kind ─────────────────────────────────

/**
 * Map ResourceKind to the default viewer type.
 */
export function viewerKindForResourceKind(kind: ResourceKind): ResourceViewerKind {
  switch (kind) {
    case 'markdown': return 'markdown-editor';
    case 'pdf':      return 'pdf-viewer';
    case 'html':     return 'html-viewer';
    case 'image':    return 'image-viewer';
    case 'txt':
    case 'csv':      return 'text-viewer';
    case 'docx':
    case 'pptx':
    case 'xlsx':     return 'metadata-viewer';
    default:         return 'unsupported';
  }
}

// ── Supported Check ─────────────────────────────

/**
 * Check if an extension is in the supported whitelist.
 * 'other' is NOT considered supported — it means unknown.
 */
export function isSupportedResourceExtension(extension: string): boolean {
  const normalized = normalizeResourceExtension(extension);
  return normalized in EXTENSION_KIND_MAP;
}

// ── Subdirectory ────────────────────────────────

/**
 * Get the vault-relative import subdirectory for a ResourceKind.
 * Returns a vault-relative path, never a system absolute path.
 */
export function getResourceSubdir(kind: ResourceKind): string {
  return RESOURCE_KIND_SUBDIR_MAP[kind];
}
