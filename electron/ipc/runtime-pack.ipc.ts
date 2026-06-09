/**
 * Runtime Pack IPC handlers — Phase 3-4-G3-B.
 *
 * Registers 11 fixed-function IPC channels for Runtime Pack management.
 *
 * ⚠️  ALL inputs are validated. ALL outputs are sanitized.
 * ⚠️  No path, downloadUrl, command, or script is accepted from renderer.
 * ⚠️  Banned channels (run-command, run-shell, etc.) are NEVER registered.
 */

import { ipcMain, dialog } from 'electron';
import fs from 'node:fs/promises';
import {
  RUNTIME_LIST_PACKS_CHANNEL,
  RUNTIME_GET_STATUS_CHANNEL,
  RUNTIME_INSTALL_CHANNEL,
  RUNTIME_CANCEL_INSTALL_CHANNEL,
  RUNTIME_UNINSTALL_CHANNEL,
  RUNTIME_ENABLE_CHANNEL,
  RUNTIME_DISABLE_CHANNEL,
  RUNTIME_PROBE_CHANNEL,
  RUNTIME_DIAGNOSE_CHANNEL,
  RUNTIME_CLEAR_CACHE_CHANNEL,
  RUNTIME_EXPORT_DIAGNOSTICS_CHANNEL,
} from '../../src/lib/contracts/runtime-pack.types';
import type {
  InstallRuntimePackInput,
  InstallRuntimePackResult,
  CancelInstallRuntimePackResult,
  UninstallRuntimePackInput,
  UninstallRuntimePackResult,
  ToggleRuntimePackResult,
  ProbeRuntimePackResult,
  DiagnoseRuntimePackInput,
  DiagnoseRuntimePackResult,
  ClearRuntimePackCacheResult,
  ExportDiagnosticsInput,
  ExportDiagnosticsResult,
} from '../../src/lib/contracts/runtime-pack.types';
import {
  listPacks,
  getPackStatus,
  installPack,
  cancelInstall,
  uninstallPack,
  enablePack,
  disablePack,
  probePack,
  diagnosePack,
  clearCache,
} from '../services/runtime-pack/runtime-pack-manager.service';
import { diagnose } from '../services/runtime-pack/runtime-pack-diagnostics.service';
import { loadManifest } from '../services/runtime-pack/runtime-pack-manifest.service';
import { getLogsDir } from '../services/runtime-pack/runtime-pack-path.service';

// ── Helpers ──────────────────────────────────────

function assertString(val: unknown, name: string): string {
  if (typeof val !== 'string' || val.trim().length === 0) {
    throw new Error(`INVALID_INPUT: ${name} must be a non-empty string`);
  }
  return val;
}

function assertBoolean(val: unknown, name: string): boolean {
  if (typeof val !== 'boolean') {
    throw new Error(`INVALID_INPUT: ${name} must be a boolean`);
  }
  return val;
}

function assertNumber(val: unknown, name: string): number {
  if (typeof val !== 'number' || isNaN(val)) {
    throw new Error(`INVALID_INPUT: ${name} must be a number`);
  }
  return val;
}

function sanitizeForRenderer(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 200).replace(/[\n\r\t]/g, ' ').replace(/[\\]/g, '/');
}

// ── Registration ─────────────────────────────────

export function registerRuntimePackIpc(): void {
  // ── runtime:list-packs ───────────────────────
  ipcMain.handle(RUNTIME_LIST_PACKS_CHANNEL, async () => {
    try {
      const packs = listPacks();
      return { ok: true, packs };
    } catch (err) {
      return { ok: true, packs: [] };
    }
  });

  // ── runtime:get-status ───────────────────────
  ipcMain.handle(RUNTIME_GET_STATUS_CHANNEL, async (_event, input: unknown) => {
    try {
      const packId = assertString((input as Record<string, unknown>)?.packId, 'packId');
      const status = getPackStatus(packId);
      return { ok: true, status };
    } catch (err) {
      return { ok: false, status: null, message: sanitizeForRenderer(err) };
    }
  });

  // ── runtime:install ──────────────────────────
  ipcMain.handle(RUNTIME_INSTALL_CHANNEL, async (_event, input: unknown) => {
    try {
      const i = input as Record<string, unknown>;
      const packId = assertString(i.packId, 'packId');
      assertBoolean(i.acceptedNetworkDownload, 'acceptedNetworkDownload');
      assertNumber(i.acceptedDiskUsageMb, 'acceptedDiskUsageMb');

      return await installPack(packId);
    } catch (err) {
      return { ok: false, status: null as unknown as InstallRuntimePackResult['status'], message: sanitizeForRenderer(err) } as InstallRuntimePackResult;
    }
  });

  // ── runtime:cancel-install ───────────────────
  ipcMain.handle(RUNTIME_CANCEL_INSTALL_CHANNEL, async (_event, input: unknown) => {
    try {
      const packId = assertString((input as Record<string, unknown>)?.packId, 'packId');
      return cancelInstall(packId);
    } catch (err) {
      return { ok: false, status: null as unknown as CancelInstallRuntimePackResult['status'], message: sanitizeForRenderer(err) } as CancelInstallRuntimePackResult;
    }
  });

  // ── runtime:uninstall ────────────────────────
  ipcMain.handle(RUNTIME_UNINSTALL_CHANNEL, async (_event, input: unknown) => {
    try {
      const i = input as Record<string, unknown>;
      const packId = assertString(i.packId, 'packId');
      const removeModelCache = Boolean(i.removeModelCache);
      const removeLogs = Boolean(i.removeLogs);

      return await uninstallPack(packId, removeModelCache, removeLogs);
    } catch (err) {
      return { ok: false, status: null as unknown as UninstallRuntimePackResult['status'], freedDiskMb: 0, message: sanitizeForRenderer(err) } as UninstallRuntimePackResult;
    }
  });

  // ── runtime:enable ───────────────────────────
  ipcMain.handle(RUNTIME_ENABLE_CHANNEL, async (_event, input: unknown) => {
    try {
      const packId = assertString((input as Record<string, unknown>)?.packId, 'packId');
      return enablePack(packId);
    } catch (err) {
      return { ok: false, status: null as unknown as ToggleRuntimePackResult['status'] } as ToggleRuntimePackResult;
    }
  });

  // ── runtime:disable ──────────────────────────
  ipcMain.handle(RUNTIME_DISABLE_CHANNEL, async (_event, input: unknown) => {
    try {
      const packId = assertString((input as Record<string, unknown>)?.packId, 'packId');
      return disablePack(packId);
    } catch (err) {
      return { ok: false, status: null as unknown as ToggleRuntimePackResult['status'] } as ToggleRuntimePackResult;
    }
  });

  // ── runtime:probe ────────────────────────────
  ipcMain.handle(RUNTIME_PROBE_CHANNEL, async (_event, input: unknown) => {
    try {
      const packId = assertString((input as Record<string, unknown>)?.packId, 'packId');
      return await probePack(packId);
    } catch (err) {
      return { ok: false, available: false, reason: sanitizeForRenderer(err) } as ProbeRuntimePackResult;
    }
  });

  // ── runtime:diagnose ─────────────────────────
  ipcMain.handle(RUNTIME_DIAGNOSE_CHANNEL, async (_event, input: unknown) => {
    try {
      const i = input as Record<string, unknown>;
      const packId = assertString(i.packId, 'packId');
      return await diagnosePack(packId);
    } catch (err) {
      return {
        ok: false,
        checks: [{ id: 'error', label: '诊断失败', ok: false, message: sanitizeForRenderer(err) }],
        suggestion: '请重试或检查增强模块状态',
      } as DiagnoseRuntimePackResult;
    }
  });

  // ── runtime:clear-cache ──────────────────────
  ipcMain.handle(RUNTIME_CLEAR_CACHE_CHANNEL, async (_event, input: unknown) => {
    try {
      const packId = assertString((input as Record<string, unknown>)?.packId, 'packId');
      return await clearCache(packId);
    } catch (err) {
      return { ok: false, freedDiskMb: 0, message: sanitizeForRenderer(err) } as ClearRuntimePackCacheResult;
    }
  });

  // ── runtime:export-diagnostics ───────────────
  ipcMain.handle(RUNTIME_EXPORT_DIAGNOSTICS_CHANNEL, async (_event, input: unknown) => {
    try {
      const i = input as Record<string, unknown>;
      const packId = (i.packId ?? null) as string | null;

      // 1. Gather diagnostics
      const packs = packId ? [packId] : [];
      const diagData: Record<string, unknown> = {};
      for (const pid of packs) {
        try {
          const manifest = await loadManifest(pid);
          diagData[pid] = {
            diagnose: diagnose(manifest, pid),
            timestamp: new Date().toISOString(),
          };
        } catch {
          diagData[pid] = { error: sanitizeForRenderer('MANIFEST_NOT_FOUND'), timestamp: new Date().toISOString() };
        }
      }

      // 2. Show save dialog (main process only)
      const result = await dialog.showSaveDialog({
        title: '导出诊断日志',
        defaultPath: `schola-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) {
        return { ok: true, saved: false, message: '已取消导出' } as ExportDiagnosticsResult;
      }

      // 3. Write sanitized JSON
      const sanitized = sanitizeDiagnostics(diagData);
      await fs.writeFile(result.filePath, JSON.stringify(sanitized, null, 2), 'utf-8');

      return { ok: true, saved: true } as ExportDiagnosticsResult;
    } catch (err) {
      return { ok: false, saved: false, message: sanitizeForRenderer(err) } as ExportDiagnosticsResult;
    }
  });
}

// ── Diagnostics sanitize ─────────────────────────

function sanitizeDiagnostics(data: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(data);
  // Replace common path patterns
  let sanitized = json
    .replace(/C:\\Users\\[^\\"]+/gi, '<system>/Users/<user>')
    .replace(/\/home\/[^/"]+/gi, '<system>/home/<user>')
    .replace(/\/Users\/[^/"]+/gi, '<system>/Users/<user>')
    .replace(/[A-Za-z]:\\[^"\\]+/g, '<system-path>');
  return JSON.parse(sanitized) as Record<string, unknown>;
}
