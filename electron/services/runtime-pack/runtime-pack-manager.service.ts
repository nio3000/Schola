/**
 * Runtime Pack Manager service — Phase 3-4-G3-B.
 *
 * Main orchestrator for Runtime Pack lifecycle:
 * install / cancel / retry / cleanup / uninstall / enable / disable / probe / diagnose.
 *
 * ⚠️  G3-B: Empty-shell manifest only. No real download, no pip install, no venv creation.
 */

import fs from 'node:fs/promises';
import type {
  RuntimePackId,
  RuntimePackPhase,
  RuntimePackStatus,
  InstallRuntimePackResult,
  CancelInstallRuntimePackResult,
  UninstallRuntimePackResult,
  ToggleRuntimePackResult,
  ProbeRuntimePackResult,
  DiagnoseRuntimePackResult,
  ClearRuntimePackCacheResult,
  RuntimePackSummary,
} from '../../../src/lib/contracts/runtime-pack.types';
import { loadManifest, validateManifestStructure, validateManifestBusiness } from './runtime-pack-manifest.service';
import { validatePublisher, validatePackId } from './runtime-pack-security.service';
import { diagnose } from './runtime-pack-diagnostics.service';
import {
  getStatus,
  setStatus,
  removeStatus,
  getAllStatuses,
  createStatus,
} from './runtime-pack-status-store.service';
import {
  getPackDir,
  getPackManifestPath,
  getCacheDir,
  getTempDir,
  getLogsDir,
} from './runtime-pack-path.service';

// ── Public API ───────────────────────────────────

export function listPacks(): RuntimePackSummary[] {
  const all = getAllStatuses();
  const result: RuntimePackSummary[] = [];
  for (const [, status] of Object.entries(all)) {
    // Only include packs that are discoverable
    if (status.phase === 'undiscovered' || status.phase === 'uninstalled') continue;
    result.push(statusToSummary(status));
  }
  return result;
}

export function getPackStatus(packId: RuntimePackId): RuntimePackStatus | null {
  return getStatus(packId) ?? null;
}

// ── Install ──────────────────────────────────────

export async function installPack(packId: RuntimePackId): Promise<InstallRuntimePackResult> {
  let status = createStatus(packId, { phase: 'installing' as RuntimePackPhase, progress: { phase: 'checking-platform', percent: 5, bytesDownloaded: null, bytesTotal: null } });
  setStatus(packId, status);

  try {
    // Phase 1: Load and validate manifest
    status = updateProgress(status, 'checking-platform', 10);
    const manifest = await loadManifest(packId);
    validatePublisher(manifest);
    validatePackId(manifest);
    const struct = validateManifestStructure(manifest);
    if (!struct.ok) throw new Error('MANIFEST_VALIDATION_ERROR');
    const business = validateManifestBusiness(manifest);
    if (!business.ok) throw new Error('MANIFEST_VALIDATION_ERROR');

    // Phase 2: Platform check
    status = updateProgress(status, 'checking-platform', 30);
    // platformRequirements checked via validateManifestBusiness + diagnose

    // Phase 3: Create runtime directories (empty shell)
    status = updateProgress(status, 'installing', 60);
    const packDir = getPackDir(packId);
    await fs.mkdir(packDir, { recursive: true });
    const cacheDir = getCacheDir(packId);
    await fs.mkdir(cacheDir, { recursive: true });
    const logsDir = getLogsDir(packId);
    await fs.mkdir(logsDir, { recursive: true });

    // Phase 4: Copy manifest
    status = updateProgress(status, 'installing', 80);
    const sourceManifestPath = getPackManifestPath(packId);
    const destManifestPath = `${packDir}/schola-pack.json`;
    // The manifest is already at the source path (resources/runtimes/...)
    // For empty-shell, we just verify it exists
    await fs.access(sourceManifestPath);
    await fs.copyFile(sourceManifestPath, destManifestPath);

    // Phase 5: Probe
    status = updateProgress(status, 'probing', 95);
    const probeResult = await probePack(packId);

    // Phase 6: Done
    status = {
      ...status,
      phase: 'enabled' as RuntimePackPhase,
      enabled: true,
      installedVersion: manifest.version,
      installedAt: Date.now(),
      lastProbeAt: Date.now(),
      lastProbeOk: probeResult.available,
      lastErrorCode: null,
      lastErrorMessage: null,
      consecutiveFailures: 0,
      progress: null,
      updatedAt: Date.now(),
    };
    setStatus(packId, status);

    return { ok: true, status, message: '安装完成' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    status = {
      ...status,
      phase: 'failed' as RuntimePackPhase,
      lastErrorCode: mapErrorToCode(msg) as RuntimePackStatus['lastErrorCode'],
      lastErrorMessage: msg.slice(0, 200),
      lastProbeOk: false,
      consecutiveFailures: (status.consecutiveFailures || 0) + 1,
      progress: null,
      updatedAt: Date.now(),
    };
    setStatus(packId, status);
    return { ok: false, status, message: msg.slice(0, 200) };
  }
}

// ── Cancel ───────────────────────────────────────

export function cancelInstall(packId: RuntimePackId): CancelInstallRuntimePackResult {
  const status = getStatus(packId);
  if (!status) {
    return { ok: false, status: createStatus(packId) };
  }
  if (status.phase !== 'installing') {
    return { ok: false, status };
  }
  const cancelled: RuntimePackStatus = {
    ...status,
    phase: 'failed' as RuntimePackPhase,
    lastErrorCode: 'DOWNLOAD_CANCELLED',
    lastErrorMessage: '安装已取消',
    progress: null,
    updatedAt: Date.now(),
  };
  setStatus(packId, cancelled);
  return { ok: true, status: cancelled };
}

// ── Uninstall ────────────────────────────────────

export async function uninstallPack(
  packId: RuntimePackId,
  removeModelCache: boolean,
  removeLogs: boolean,
): Promise<UninstallRuntimePackResult> {
  const status = getStatus(packId);
  if (!status) {
    return { ok: false, status: createStatus(packId, { phase: 'uninstalled' as RuntimePackPhase }), freedDiskMb: 0 };
  }

  const uninstalling: RuntimePackStatus = {
    ...status,
    phase: 'uninstalling' as RuntimePackPhase,
    progress: { phase: 'uninstalling', percent: 10, bytesDownloaded: null, bytesTotal: null },
    updatedAt: Date.now(),
  };
  setStatus(packId, uninstalling);

  let freedMb = 0;

  try {
    // Remove runtime directory
    const packDir = getPackDir(packId);
    await fs.rm(packDir, { recursive: true, force: true });

    if (removeModelCache) {
      const cacheDir = getCacheDir(packId);
      await fs.rm(cacheDir, { recursive: true, force: true });
    }
    if (removeLogs) {
      const logsDir = getLogsDir(packId);
      await fs.rm(logsDir, { recursive: true, force: true });
    }

    removeStatus(packId);
    const finalStatus = createStatus(packId, { phase: 'uninstalled' as RuntimePackPhase });

    return { ok: true, status: finalStatus, freedDiskMb: freedMb };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: uninstalling, freedDiskMb: 0 };
  }
}

// ── Enable / Disable ─────────────────────────────

export function enablePack(packId: RuntimePackId): ToggleRuntimePackResult {
  const status = getStatus(packId);
  if (!status) return { ok: false, status: createStatus(packId) };
  if (!status.lastProbeOk) return { ok: false, status };

  const updated: RuntimePackStatus = { ...status, phase: 'enabled' as RuntimePackPhase, enabled: true, updatedAt: Date.now() };
  setStatus(packId, updated);
  return { ok: true, status: updated };
}

export function disablePack(packId: RuntimePackId): ToggleRuntimePackResult {
  const status = getStatus(packId);
  if (!status) return { ok: false, status: createStatus(packId) };

  const updated: RuntimePackStatus = { ...status, phase: 'disabled' as RuntimePackPhase, enabled: false, updatedAt: Date.now() };
  setStatus(packId, updated);
  return { ok: true, status: updated };
}

// ── Probe ────────────────────────────────────────

export async function probePack(packId: RuntimePackId): Promise<ProbeRuntimePackResult> {
  const status = getStatus(packId);
  const now = Date.now();

  try {
    // Empty-shell probe: just check manifest exists and validates
    await loadManifest(packId);
    const updated: RuntimePackStatus = {
      ...(status ?? createStatus(packId)),
      lastProbeAt: now,
      lastProbeOk: true,
      updatedAt: now,
    };
    if (status) setStatus(packId, updated);
    return { ok: true, available: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 200) : 'PROBE_FAILED';
    const updated: RuntimePackStatus = {
      ...(status ?? createStatus(packId)),
      lastProbeAt: now,
      lastProbeOk: false,
      lastErrorCode: mapErrorToCode(reason) as RuntimePackStatus['lastErrorCode'],
      lastErrorMessage: reason,
      updatedAt: now,
    };
    if (status) setStatus(packId, updated);
    return { ok: false, available: false, reason };
  }
}

// ── Diagnose ─────────────────────────────────────

export async function diagnosePack(packId: RuntimePackId): Promise<DiagnoseRuntimePackResult> {
  try {
    const manifest = await loadManifest(packId);
    return diagnose(manifest, packId);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : 'DIAGNOSE_FAILED';
    return {
      ok: false,
      checks: [{ id: 'manifest', label: '模块文件', ok: false, message: msg }],
      suggestion: '请检查增强模块是否正确安装',
    };
  }
}

// ── Clear Cache ──────────────────────────────────

export async function clearCache(packId: RuntimePackId): Promise<ClearRuntimePackCacheResult> {
  try {
    const cacheDir = getCacheDir(packId);
    const tempDir = getTempDir(packId);
    await fs.rm(cacheDir, { recursive: true, force: true });
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(cacheDir, { recursive: true });
    return { ok: true, freedDiskMb: 0, message: '缓存已清理' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, freedDiskMb: 0, message: msg.slice(0, 200) };
  }
}

// ── Helpers ──────────────────────────────────────

function updateProgress(status: RuntimePackStatus, phase: 'checking-platform' | 'downloading' | 'verifying' | 'installing' | 'probing', percent: number): RuntimePackStatus {
  return {
    ...status,
    progress: { phase, percent, bytesDownloaded: null, bytesTotal: null },
    updatedAt: Date.now(),
  };
}

function statusToSummary(status: RuntimePackStatus): RuntimePackSummary {
  return {
    packId: status.packId,
    displayName: status.packId, // placeholder; real name comes from manifest
    description: '',
    version: status.installedVersion,
    capabilities: [],
    networkRequired: 'never',
    diskSizeMb: null,
  };
}

function mapErrorToCode(message: string): string {
  if (message.includes('PUBLISHER_NOT_OFFICIAL')) return 'PUBLISHER_NOT_OFFICIAL';
  if (message.includes('PACK_NOT_IN_ALLOWLIST')) return 'PACK_NOT_IN_ALLOWLIST';
  if (message.includes('PACK_ID_INVALID')) return 'PACK_ID_INVALID';
  if (message.includes('PACK_ID_UNSAFE')) return 'PACK_ID_UNSAFE';
  if (message.includes('MANIFEST_NOT_FOUND')) return 'MANIFEST_NOT_FOUND';
  if (message.includes('MANIFEST_PARSE_ERROR')) return 'MANIFEST_PARSE_ERROR';
  if (message.includes('MANIFEST_VALIDATION_ERROR')) return 'MANIFEST_VALIDATION_ERROR';
  if (message.includes('DOWNLOAD_URL_NOT_ALLOWED')) return 'DOWNLOAD_URL_NOT_ALLOWED';
  if (message.includes('DOWNLOAD_CANCELLED')) return 'DOWNLOAD_CANCELLED';
  if (message.includes('OS_MISMATCH')) return 'OS_MISMATCH';
  if (message.includes('ARCH_MISMATCH')) return 'ARCH_MISMATCH';
  if (message.includes('DISK_SPACE_INSUFFICIENT')) return 'DISK_SPACE_INSUFFICIENT';
  if (message.includes('GPU_REQUIRED_BUT_UNAVAILABLE')) return 'GPU_REQUIRED_BUT_UNAVAILABLE';
  if (message.includes('SCHOLA_VERSION_INCOMPATIBLE')) return 'SCHOLA_VERSION_INCOMPATIBLE';
  if (message.includes('INTEGRITY_CHECK_FAILED')) return 'INTEGRITY_CHECK_FAILED';
  if (message.includes('INSTALL_FAILED')) return 'INSTALL_FAILED';
  if (message.includes('PROBE_FAILED')) return 'PROBE_FAILED';
  if (message.includes('PACK_NOT_FOUND')) return 'PACK_NOT_FOUND';
  return 'INTERNAL_ERROR';
}
