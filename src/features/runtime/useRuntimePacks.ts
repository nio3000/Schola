/**
 * useRuntimePacks — Phase 3-4-G3-C.
 *
 * React hook for Runtime Pack state management.
 * Calls window.schola.runtime APIs via schola-api wrappers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  RuntimePackStatus,
  RuntimePackSummary,
  RuntimePackPhase,
} from '../../lib/contracts/runtime-pack.types';
import {
  listRuntimePacks,
  getRuntimePackStatus,
  installRuntimePack,
  cancelInstallRuntimePack,
  uninstallRuntimePack,
  enableRuntimePack,
  disableRuntimePack,
  diagnoseRuntimePack,
  clearRuntimePackCache,
  exportRuntimePackDiagnostics,
} from '../../lib/platform/schola-api';

export interface RuntimeUIState {
  readonly packs: readonly RuntimePackSummary[];
  readonly statuses: Map<string, RuntimePackStatus>;
  readonly loading: boolean;
  readonly error: string | null;
}

export interface ClearCacheResult {
  readonly ok: boolean;
  readonly freedDiskMb: number;
}

export interface RuntimeActions {
  readonly refresh: () => Promise<void>;
  readonly install: (packId: string, diskUsageMb?: number, acceptedNetworkDownload?: boolean) => Promise<boolean>;
  readonly cancelInstall: (packId: string) => Promise<boolean>;
  readonly uninstall: (packId: string, removeModelCache: boolean, removeLogs: boolean) => Promise<boolean>;
  readonly enable: (packId: string) => Promise<boolean>;
  readonly disable: (packId: string) => Promise<boolean>;
  readonly diagnose: (packId: string) => Promise<string | null>;
  readonly clearCache: (packId: string) => Promise<ClearCacheResult>;
  readonly exportDiagnostics: (packId: string | null) => Promise<boolean>;
  readonly isAvailable: boolean;
}

const POLL_INTERVAL_MS = 3000;
const TRANSIENT_PHASES: ReadonlySet<RuntimePackPhase> = new Set([
  'installing', 'uninstalling', 'running',
]);

export function useRuntimePacks(): [RuntimeUIState, RuntimeActions] {
  const [packs, setPacks] = useState<RuntimePackSummary[]>([]);
  const [statuses, setStatuses] = useState<Map<string, RuntimePackStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const fetchStatus = useCallback(async (packId: string) => {
    try {
      const r = await getRuntimePackStatus(packId);
      if (r.ok && r.status) {
        setStatuses(prev => { const n = new Map(prev); n.set(packId, r.status!); return n; });
        return r.status;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      let hasTransient = false;
      for (const [, s] of statuses) {
        if (TRANSIENT_PHASES.has(s.phase)) { hasTransient = true; break; }
      }
      if (!hasTransient) { stopPolling(); return; }
      for (const [id] of statuses) { await fetchStatus(id); }
    }, POLL_INTERVAL_MS);
  }, [statuses, fetchStatus, stopPolling]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listRuntimePacks();
      if (r.ok) {
        setPacks([...r.packs]);
        for (const p of r.packs) {
          const s = await fetchStatus(p.packId);
          if (s && TRANSIENT_PHASES.has(s.phase)) startPolling();
        }
      } else {
        setPacks([]);
      }
    } catch {
      setIsAvailable(false);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [fetchStatus, startPolling]);

  useEffect(() => {
    refresh();
    return stopPolling;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const actions: RuntimeActions = {
    refresh,
    isAvailable,
    install: useCallback(async (packId: string, diskUsageMb = 500, acceptedNetworkDownload = false) => {
      try {
        const r = await installRuntimePack({ packId, acceptedNetworkDownload, acceptedDiskUsageMb: diskUsageMb });
        if (r.ok) { await fetchStatus(packId); startPolling(); return true; }
        setError(r.message ?? '安装失败');
        return false;
      } catch (e) { setError(e instanceof Error ? e.message : '安装失败'); return false; }
    }, [fetchStatus, startPolling]),
    cancelInstall: useCallback(async (packId: string) => {
      try {
        const r = await cancelInstallRuntimePack(packId);
        if (r.ok) { await fetchStatus(packId); stopPolling(); return true; }
        return false;
      } catch { return false; }
    }, [fetchStatus, stopPolling]),
    uninstall: useCallback(async (packId: string, removeModelCache: boolean, removeLogs: boolean) => {
      try {
        const r = await uninstallRuntimePack({ packId, removeModelCache, removeLogs });
        if (r.ok) { await refresh(); return true; }
        setError('卸载失败');
        return false;
      } catch (e) { setError(e instanceof Error ? e.message : '卸载失败'); return false; }
    }, [refresh]),
    enable: useCallback(async (packId: string) => {
      try {
        const r = await enableRuntimePack(packId);
        if (r.ok) { await fetchStatus(packId); return true; }
        return false;
      } catch { return false; }
    }, [fetchStatus]),
    disable: useCallback(async (packId: string) => {
      try {
        const r = await disableRuntimePack(packId);
        if (r.ok) { await fetchStatus(packId); return true; }
        return false;
      } catch { return false; }
    }, [fetchStatus]),
    diagnose: useCallback(async (packId: string) => {
      try {
        const r = await diagnoseRuntimePack({ packId, includeSanitizedLogs: true });
        if (r.ok) {
          const lines = r.checks.map(c => `${c.ok ? '✓' : '✗'} ${c.label}: ${c.message}`);
          return lines.join('\n');
        }
        return r.suggestion ?? '诊断未完成';
      } catch { return null; }
    }, []),
    clearCache: useCallback(async (packId: string) => {
      try {
        const r = await clearRuntimePackCache(packId);
        return { ok: r.ok, freedDiskMb: r.freedDiskMb ?? 0 };
      } catch { return { ok: false, freedDiskMb: 0 }; }
    }, []),
    exportDiagnostics: useCallback(async (packId: string | null) => {
      try {
        const r = await exportRuntimePackDiagnostics({ packId });
        return r.saved;
      } catch { return false; }
    }, []),
  };

  return [{ packs, statuses, loading, error }, actions];
}
