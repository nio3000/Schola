/**
 * Secure Provider Key Store — Phase 5-1-IMP-3.
 *
 * Manages AI provider API keys with Electron safeStorage encryption.
 *
 * Primary backend: Electron safeStorage (OS-level encryption).
 *   Stores encrypted buffers to: <userData>/schola-keys/<providerId>.enc
 * Fallback: when safeStorage.isEncryptionAvailable() === false,
 *   uses in-memory Map only (no disk write).
 *
 * NEVER exposes raw API keys via any IPC path.
 * Error messages are sanitized (no key content in errors).
 */
import { safeStorage, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type {
  MaskedSecretStatus,
  SecretStorageType,
} from '../../src/lib/contracts/settings.types';
import {
  createNotConfiguredStatus,
  createConfiguredStatus,
  createMemoryOnlyStatus,
  createUnavailableStatus,
  maskApiKey,
} from '../../src/lib/contracts/settings.types';
import { assertString } from '../lib/ipc-validation';

// ── Constants ──────────────────────────────────

const KEYS_DIRNAME = 'schola-keys';

function getKeysDir(): string {
  return path.join(app.getPath('userData'), KEYS_DIRNAME);
}

function getKeyFilePath(providerId: string): string {
  // Sanitize: only allow alphanumeric, hyphen, underscore
  const sanitized = providerId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getKeysDir(), `${sanitized}.enc`);
}

// ── State ──────────────────────────────────────

/** In-memory cache: providerId → decrypted key string. */
const keyCache = new Map<string, string>();

/** Track which storage backend each provider uses. */
const storageTypeCache = new Map<string, SecretStorageType>();

/** Whether safeStorage encryption is available. Checked once at module load. */
let encryptionAvailable: boolean | null = null;

function isEncryptionAvailable(): boolean {
  if (encryptionAvailable === null) {
    encryptionAvailable = safeStorage.isEncryptionAvailable();
  }
  return encryptionAvailable;
}

// ── Helpers ────────────────────────────────────

function ensureKeysDir(): void {
  const dir = getKeysDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Validate a key string without exposing contents in error messages. */
function validateKey(key: string): void {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('INVALID_INPUT: API key must not be empty.');
  }
  if (key.trim().length < 8) {
    throw new Error('INVALID_INPUT: API key is too short (minimum 8 characters).');
  }
}

/** Write encrypted key to disk. Returns true on success. */
function writeEncryptedKey(providerId: string, key: string): boolean {
  if (!isEncryptionAvailable()) return false;

  try {
    ensureKeysDir();
    const encrypted = safeStorage.encryptString(key);
    const filePath = getKeyFilePath(providerId);
    fs.writeFileSync(filePath, encrypted);
    return true;
  } catch {
    // Disk write failed — key stays in memory only
    return false;
  }
}

/** Read encrypted key from disk. Returns decrypted string or null. */
function readEncryptedKey(providerId: string): string | null {
  if (!isEncryptionAvailable()) return null;

  try {
    const filePath = getKeyFilePath(providerId);
    if (!fs.existsSync(filePath)) return null;

    const encrypted = fs.readFileSync(filePath);
    return safeStorage.decryptString(encrypted);
  } catch {
    // Decryption failed — file may be corrupted
    return null;
  }
}

/** Delete encrypted key file from disk. */
function deleteEncryptedKeyFile(providerId: string): void {
  try {
    const filePath = getKeyFilePath(providerId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Best-effort cleanup — ignore errors
  }
}

/** Build MaskedSecretStatus from cache. */
function buildStatus(providerId: string): MaskedSecretStatus {
  // Check if encryption is available
  if (!isEncryptionAvailable()) {
    const decrypted = keyCache.get(providerId);
    if (!decrypted) {
      return createUnavailableStatus(providerId);
    }
    // Key exists in memory only, safeStorage unavailable
    const maskedSuffix = maskApiKey(decrypted);
    return createMemoryOnlyStatus(providerId, maskedSuffix);
  }

  const decrypted = keyCache.get(providerId);
  const storageType = storageTypeCache.get(providerId);

  if (!decrypted) {
    return createNotConfiguredStatus(providerId);
  }

  const maskedSuffix = maskApiKey(decrypted);
  if (storageType === 'memory') {
    // Key was stored but disk write failed — memory-only fallback
    return createMemoryOnlyStatus(providerId, maskedSuffix);
  }
  return createConfiguredStatus(
    providerId,
    maskedSuffix,
    storageType ?? 'safeStorage',
  );
}

// ═══════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════

/**
 * Get the decrypted API key for a provider.
 * MAIN PROCESS ONLY. NEVER expose via IPC.
 */
export function getProviderKey(providerId: string): string | null {
  assertString(providerId, 'providerId');

  // Check memory cache first
  if (keyCache.has(providerId)) {
    return keyCache.get(providerId) ?? null;
  }

  // Try disk (safeStorage)
  const fromDisk = readEncryptedKey(providerId);
  if (fromDisk !== null) {
    keyCache.set(providerId, fromDisk);
    storageTypeCache.set(providerId, 'safeStorage');
    return fromDisk;
  }

  return null;
}

/**
 * Get masked key status for a provider (or all providers if no providerId).
 * RENDERER-SAFE: returns MaskedSecretStatus only, NEVER the raw key.
 */
export function getProviderKeyStatus(providerId?: string): readonly MaskedSecretStatus[] {
  if (providerId) {
    // Ensure cache is populated from disk
    getProviderKey(providerId);
    return [buildStatus(providerId)];
  }

  // Collect all known provider IDs from disk files + in-memory cache
  const allIds = new Set<string>();

  // From memory cache
  for (const id of keyCache.keys()) {
    allIds.add(id);
  }

  // From disk (list .enc files)
  if (isEncryptionAvailable()) {
    try {
      const dir = getKeysDir();
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.enc')) {
            const id = file.slice(0, -4); // Remove .enc extension
            allIds.add(id);
          }
        }
      }
    } catch {
      // Ignore readdir errors
    }
  }

  // Populate cache for disk-only IDs
  for (const id of allIds) {
    if (!keyCache.has(id)) {
      getProviderKey(id);
    }
  }

  return Array.from(allIds)
    .map((id) => buildStatus(id))
    .sort((a, b) => a.providerId.localeCompare(b.providerId));
}

/**
 * Store a provider API key (encrypted, main-process-only).
 * Returns MaskedSecretStatus (renderer-safe).
 */
export function setProviderKey(
  providerId: string,
  key: string,
): MaskedSecretStatus {
  assertString(providerId, 'providerId');
  validateKey(key);

  const trimmedKey = key.trim();

  // Always store in memory
  keyCache.set(providerId, trimmedKey);

  // Try disk persistence via safeStorage
  if (isEncryptionAvailable()) {
    const ok = writeEncryptedKey(providerId, trimmedKey);
    storageTypeCache.set(providerId, ok ? 'safeStorage' : 'memory');
  } else {
    storageTypeCache.set(providerId, 'memory');
  }

  return buildStatus(providerId);
}

/**
 * Delete a provider API key from both disk and memory.
 * Returns MaskedSecretStatus (always 'not-configured').
 */
export function deleteProviderKey(providerId: string): MaskedSecretStatus {
  assertString(providerId, 'providerId');

  keyCache.delete(providerId);
  storageTypeCache.delete(providerId);
  deleteEncryptedKeyFile(providerId);

  return createNotConfiguredStatus(providerId);
}

/**
 * Check if a provider has a configured API key.
 * Safe for renderer — returns boolean only, NEVER the key.
 */
export function hasProviderKey(providerId: string): boolean {
  return getProviderKey(providerId) !== null;
}

/**
 * Load all keys from disk on startup.
 * Should be called once during app initialization.
 */
export function loadAllKeys(): void {
  if (!isEncryptionAvailable()) return;

  try {
    const dir = getKeysDir();
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith('.enc')) continue;

      const providerId = file.slice(0, -4); // Remove .enc extension
      const decrypted = readEncryptedKey(providerId);
      if (decrypted !== null) {
        keyCache.set(providerId, decrypted);
        storageTypeCache.set(providerId, 'safeStorage');
      }
    }
  } catch {
    // Ignore disk read errors during startup
  }
}

/**
 * Clear all stored keys (memory + disk).
 */
export function clearAllKeys(): void {
  // Clear disk
  if (isEncryptionAvailable()) {
    try {
      const dir = getKeysDir();
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.enc')) {
            const filePath = path.join(dir, file);
            try {
              fs.unlinkSync(filePath);
            } catch {
              // Best-effort
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  keyCache.clear();
  storageTypeCache.clear();
}
