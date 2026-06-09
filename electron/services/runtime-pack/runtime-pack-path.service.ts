/**
 * Runtime Pack path utilities — Phase 3-4-G3-B.
 *
 * Manages safe directory name conversion and runtime pack storage paths.
 * All paths are under app.getPath('userData') — never in user Vault.
 */

import path from 'node:path';
import { app } from 'electron';
import type { RuntimePackId, RuntimePackSafeDirName } from '../../../src/lib/contracts/runtime-pack.types';

// ── Constants ───────────────────────────────────

const PACK_ID_RE = /^schola\.[a-z0-9][a-z0-9.-]*[a-z0-9]$/;

/** Maximum packId length to prevent path-too-long issues */
const MAX_PACK_ID_LENGTH = 255;

// ── Public API ───────────────────────────────────

export function packIdToDirName(packId: RuntimePackId): RuntimePackSafeDirName {
  if (!PACK_ID_RE.test(packId)) {
    throw new Error('PACK_ID_INVALID');
  }

  if (packId.length > MAX_PACK_ID_LENGTH) {
    throw new Error('PACK_ID_INVALID');
  }

  if (
    packId.includes('..') ||
    packId.includes('/') ||
    packId.includes('\\') ||
    packId.includes(':') ||
    packId.includes('\0') ||
    /\s/.test(packId)
  ) {
    throw new Error('PACK_ID_UNSAFE');
  }

  return packId.replace(/\./g, '-') as RuntimePackSafeDirName;
}

export function getRuntimeRootDir(): string {
  return path.join(app.getPath('userData'), 'runtimes');
}

export function getPackDir(packId: RuntimePackId): string {
  const dirName = packIdToDirName(packId);
  const resolved = path.resolve(getRuntimeRootDir(), dirName);
  if (!resolved.startsWith(path.resolve(getRuntimeRootDir()))) {
    throw new Error('PATH_ESCAPES_RUNTIME_ROOT');
  }
  return resolved;
}

export function getPackManifestPath(packId: RuntimePackId): string {
  return path.join(getPackDir(packId), 'schola-pack.json');
}

export function getPackLockPath(packId: RuntimePackId): string {
  return path.join(getPackDir(packId), '.schola-pack-lock');
}

export function getCacheDir(packId: RuntimePackId): string {
  const dirName = packIdToDirName(packId);
  return path.join(app.getPath('userData'), 'runtime-cache', dirName);
}

export function getTempDir(packId: RuntimePackId): string {
  const dirName = packIdToDirName(packId);
  return path.join(app.getPath('userData'), 'runtime-temp', dirName);
}

export function getLogsDir(packId: RuntimePackId): string {
  const dirName = packIdToDirName(packId);
  return path.join(app.getPath('userData'), 'runtime-logs', dirName);
}

export function getStatusStorePath(): string {
  return path.join(app.getPath('userData'), 'runtime-status.json');
}
