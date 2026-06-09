/**
 * Runtime Pack security service — Phase 3-4-G3-B.
 *
 * downloadUrl allowlist, publisher verification, packId allowlist,
 * and install.pip constraint enforcement.
 *
 * ⚠️  G3-B: DOWNLOAD_URL_ALLOWLIST is empty — all real downloads are rejected.
 *     Mock downloader is used in tests only. localhost/HTTP/file:// are permanently blocked.
 */

import type {
  RuntimePackManifest,
  RuntimePackPermission,
} from '../../../src/lib/contracts/runtime-pack.types';

// ── Constants ───────────────────────────────────

/**
 * Official pack allowlist.  G3-B: single empty-shell pack ID.
 * Phase 4+ candidates remain commented — do NOT uncomment in G3-B.
 */
export const OFFICIAL_PACK_ALLOWLIST: readonly string[] = [
  'schola.import.quick-plus',
];

/**
 * Allowed permissions set.  Any permission in manifest.permissions
 * must be a subset of this set.
 */
const ALLOWED_PERMISSIONS: ReadonlySet<RuntimePackPermission> = new Set([
  'vault.read.currentFile',
  'vault.read.attachments',
  'vault.write.generatedMarkdown',
  'vault.write.assets',
  'vault.write.metadata',
  'network.downloadRuntime',
  'network.callProvider',
  'settings.readOwn',
  'settings.writeOwn',
  'artifact.create',
  'artifact.preview',
  'diagnostics.writeSanitizedLog',
  'runtime.install.officialOnly',
  'runtime.uninstall.ownPack',
]);

/**
 * downloadUrl allowlist.  G3-B: EMPTY — awaiting production domain confirmation.
 * Any real download attempt returns DOWNLOAD_URL_NOT_ALLOWED.
 */
export const DOWNLOAD_URL_ALLOWLIST: readonly {
  readonly hostname: string;
  readonly protocol: 'https:';
  readonly pathPrefix: string;
}[] = [];

// ⚠️  Permanently blocked URL patterns (test fixtures excluded):
//     http://, file://, localhost, 127.0.0.1, 0.0.0.0,
//     192.168.*, 10.*, 172.16.*-172.31.*, arbitrary third-party domains

// ── pip constraint regex ────────────────────────

/** Allowed pip entry: name[extras] optional version constraint */
const PIP_ENTRY_RE = /^[a-zA-Z0-9_.-]+(\[[a-zA-Z0-9_,.-]*\])?\s*(>=|<=|==|!=|>|<|~=)\s*[\d.*]+$/;

const SIMPLE_PIP_RE = /^[a-zA-Z0-9_.-]+$/;

/** Forbidden patterns in pip entries */
const PIP_FORBIDDEN_RE = /^(--?[-\w]+\s|file:\/\/|git\+)/;

// ── Public API ───────────────────────────────────

export function validatePublisher(manifest: RuntimePackManifest): void {
  if (manifest.publisher !== 'schola-official') {
    throw new Error('PUBLISHER_NOT_OFFICIAL');
  }
}

export function validatePackId(manifest: RuntimePackManifest): void {
  if (!OFFICIAL_PACK_ALLOWLIST.includes(manifest.id)) {
    throw new Error('PACK_NOT_IN_ALLOWLIST');
  }
  if (!manifest.id.startsWith('schola.')) {
    throw new Error('PACK_ID_INVALID');
  }
}

export function validatePermissions(manifest: RuntimePackManifest): void {
  for (const perm of manifest.permissions) {
    if (!ALLOWED_PERMISSIONS.has(perm as RuntimePackPermission)) {
      throw new Error(`FORBIDDEN_PERMISSION: ${sanitizeForError(perm)}`);
    }
  }
}

// ── URL Validation ──────────────────────────────

export function validateDownloadUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DOWNLOAD_URL_NOT_ALLOWED');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('DOWNLOAD_URL_NOT_ALLOWED');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Permanently blocked
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]'
  ) {
    throw new Error('DOWNLOAD_URL_NOT_ALLOWED');
  }

  // Private network ranges
  if (
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    throw new Error('DOWNLOAD_URL_NOT_ALLOWED');
  }

  // Token/signature in query
  if (parsed.searchParams.has('token') || parsed.searchParams.has('signature')) {
    throw new Error('DOWNLOAD_URL_NOT_ALLOWED');
  }

  // Empty allowlist rejects all
  if (DOWNLOAD_URL_ALLOWLIST.length === 0) {
    throw new Error('DOWNLOAD_URL_NOT_ALLOWED');
  }

  // Check against allowlist
  for (const entry of DOWNLOAD_URL_ALLOWLIST) {
    if (
      parsed.protocol === entry.protocol &&
      hostname === entry.hostname &&
      parsed.pathname.startsWith(entry.pathPrefix)
    ) {
      return; // allowed
    }
  }

  throw new Error('DOWNLOAD_URL_NOT_ALLOWED');
}

// ── pip Validation ──────────────────────────────

export function validatePipEntries(entries: readonly string[]): void {
  for (const entry of entries) {
    if (PIP_FORBIDDEN_RE.test(entry)) {
      throw new Error(`FORBIDDEN_PIP_ENTRY: ${sanitizeForError(entry)}`);
    }
    if (!PIP_ENTRY_RE.test(entry) && !SIMPLE_PIP_RE.test(entry)) {
      throw new Error(`INVALID_PIP_ENTRY: ${sanitizeForError(entry)}`);
    }
    // Reject shell metacharacters
    if (/[;&|`$()]/.test(entry)) {
      throw new Error(`FORBIDDEN_PIP_ENTRY: shell metacharacters in ${sanitizeForError(entry)}`);
    }
  }
}

// ── Helpers ──────────────────────────────────────

function sanitizeForError(value: string): string {
  return value.slice(0, 100).replace(/[\n\r\t]/g, ' ');
}
