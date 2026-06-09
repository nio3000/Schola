/**
 * Runtime Pack status store — Phase 3-4-G3-B.
 *
 * Manages runtime-status.json persistence with atomic writes and corruption recovery.
 * All status changes go through this module — never write status directly.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import type {
  RuntimePackId,
  RuntimePackStatus,
  RuntimePackPhase,
} from '../../../src/lib/contracts/runtime-pack.types';
import { getStatusStorePath, getPackDir } from './runtime-pack-path.service';

// ── Types ───────────────────────────────────────

interface StatusStoreData {
  readonly version: 1;
  updatedAt: number;
  readonly packs: Record<string, RuntimePackStatus>;
}

// ── State ────────────────────────────────────────

let store: StatusStoreData = { version: 1, updatedAt: Date.now(), packs: {} };

// ── Public API ───────────────────────────────────

export function getStatus(packId: RuntimePackId): RuntimePackStatus | null {
  return store.packs[packId] ?? null;
}

export function getAllStatuses(): Record<string, RuntimePackStatus> {
  return { ...store.packs };
}

export function setStatus(packId: RuntimePackId, status: RuntimePackStatus): void {
  store.packs[packId] = status;
  store.updatedAt = Date.now();
}

export function removeStatus(packId: RuntimePackId): void {
  delete store.packs[packId];
  store.updatedAt = Date.now();
}

export async function persist(): Promise<void> {
  const storePath = getStatusStorePath();
  const tmpPath = storePath + '.tmp';
  const data = JSON.stringify(store, null, 2);
  await fs.writeFile(tmpPath, data, 'utf-8');
  await fs.rename(tmpPath, storePath);
}

export async function load(): Promise<void> {
  const storePath = getStatusStorePath();
  try {
    const raw = await fs.readFile(storePath, 'utf-8');
    const parsed = JSON.parse(raw) as StatusStoreData;
    if (parsed && typeof parsed === 'object' && parsed.version === 1 && typeof parsed.packs === 'object') {
      store = parsed;
      return;
    }
    console.warn('[runtime-pack] Status store corrupted, resetting');
  } catch {
    // File not found or unreadable — start fresh
  }
  store = { version: 1, updatedAt: Date.now(), packs: {} };
}

/**
 * Reconcile status with on-disk state.
 * Called after app ready — checks if installed packs still exist on disk.
 */
export function reconcile(): void {
  for (const [packId, status] of Object.entries(store.packs)) {
    if (
      status.phase === 'installed' ||
      status.phase === 'enabled' ||
      status.phase === 'disabled' ||
      status.phase === 'error'
    ) {
      try {
        // Directory existence checked later by async background probe
        void getPackDir(packId);
      } catch {
        store.packs[packId] = {
          ...status,
          phase: 'uninstalled',
          enabled: false,
          lastErrorMessage: 'Pack directory missing',
          updatedAt: Date.now(),
        } as RuntimePackStatus;
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────

export function createStatus(packId: RuntimePackId, partial: Partial<RuntimePackStatus> = {}): RuntimePackStatus {
  const now = Date.now();
  return {
    packId,
    phase: 'discovered' as RuntimePackPhase,
    installedVersion: null,
    enabled: false,
    installedAt: null,
    updatedAt: now,
    lastProbeAt: null,
    lastProbeOk: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    consecutiveFailures: 0,
    progress: null,
    ...partial,
  };
}
