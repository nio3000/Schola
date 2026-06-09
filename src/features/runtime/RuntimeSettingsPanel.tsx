/**
 * RuntimeSettingsPanel — Phase 3-4-G3-C.
 *
 * Settings > 增强能力 main panel.  Lists installed and available packs.
 * Uses only window.schola.runtime API — no backend access, no paths, no URLs.
 */

import { useState, useCallback, type ReactElement } from 'react';
import { useRuntimePacks } from './useRuntimePacks';
import { RuntimePackCard } from './RuntimePackCard';
import { RuntimeInstallDialog } from './RuntimeInstallDialog';
import { RuntimeProgressDialog } from './RuntimeProgressDialog';
import { RuntimeDiagnosticsDialog } from './RuntimeDiagnosticsDialog';
import { RuntimeUninstallDialog } from './RuntimeUninstallDialog';
import { RuntimeClearCacheDialog } from './RuntimeClearCacheDialog';

type DialogState =
  | { kind: 'none' }
  | { kind: 'install'; packId: string; displayName: string; networkRequired: 'never' | 'install' | 'firstUse' | 'always'; diskSizeMb: number | null }
  | { kind: 'progress'; packId: string; displayName: string }
  | { kind: 'diagnostics'; packId: string; displayName: string }
  | { kind: 'uninstall'; packId: string; displayName: string }
  | { kind: 'clearCache'; packId: string; displayName: string };

export function RuntimeSettingsPanel(): ReactElement {
  const [state, actions] = useRuntimePacks();
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [message, setMessage] = useState<string | null>(null);

  const clearMessage = useCallback(() => setMessage(null), []);

  const handleInstall = useCallback((packId: string, displayName: string, networkRequired: 'never' | 'install' | 'firstUse' | 'always', diskSizeMb: number | null) => {
    setDialog({ kind: 'install', packId, displayName, networkRequired, diskSizeMb });
  }, []);

  const handleConfirmInstall = useCallback(async (acceptedNetworkDownload: boolean) => {
    if (dialog.kind !== 'install') return;
    setDialog({ kind: 'progress', packId: dialog.packId, displayName: dialog.displayName });
    const diskUsage = (dialog.diskSizeMb ?? 0) > 0 ? Math.round((dialog.diskSizeMb ?? 100) * 1.5) : undefined;
    const ok = await actions.install(dialog.packId, diskUsage, acceptedNetworkDownload);
    if (ok) {
      setMessage('加载完成');
    } else {
      setMessage('加载失败，请重试');
    }
    setDialog({ kind: 'none' });
  }, [dialog, actions]);

  const handleCancelInstall = useCallback(async (packId: string) => {
    await actions.cancelInstall(packId);
    setDialog({ kind: 'none' });
  }, [actions]);

  const handleUninstall = useCallback((packId: string, displayName: string) => {
    setDialog({ kind: 'uninstall', packId, displayName });
  }, []);

  const handleConfirmUninstall = useCallback(async (removeModelCache: boolean, removeLogs: boolean) => {
    if (dialog.kind !== 'uninstall') return;
    const ok = await actions.uninstall(dialog.packId, removeModelCache, removeLogs);
    setDialog({ kind: 'none' });
    setMessage(ok ? '已卸载' : '卸载失败');
  }, [dialog, actions]);

  const handleEnable = useCallback(async (packId: string) => {
    await actions.enable(packId);
  }, [actions]);

  const handleDisable = useCallback(async (packId: string) => {
    await actions.disable(packId);
  }, [actions]);

  const handleDiagnose = useCallback((packId: string, displayName: string) => {
    setDialog({ kind: 'diagnostics', packId, displayName });
  }, []);

  const handleClearCache = useCallback((packId: string, displayName: string) => {
    setDialog({ kind: 'clearCache', packId, displayName });
  }, []);

  const handleConfirmClearCache = useCallback(async () => {
    if (dialog.kind !== 'clearCache') return;
    const result = await actions.clearCache(dialog.packId);
    setDialog({ kind: 'none' });
    if (result.ok && result.freedDiskMb > 0) {
      setMessage(`缓存已清理，释放空间：${result.freedDiskMb} MB`);
    } else if (result.ok) {
      setMessage('缓存清理完成');
    } else {
      setMessage('缓存清理失败');
    }
  }, [dialog, actions]);

  const handleExportDiagnostics = useCallback(async (packId: string | null) => {
    const saved = await actions.exportDiagnostics(packId);
    setMessage(saved ? '诊断日志已导出' : '已取消导出');
  }, [actions]);

  const handleRetry = useCallback(() => {
    // Retry triggers install for whichever pack is in error/failed state.
    // Bypasses the install dialog since the user already went through it.
    for (const pack of state.packs) {
      const s = state.statuses.get(pack.packId);
      if (s && (s.phase === 'error' || s.phase === 'failed')) {
        void actions.install(pack.packId, undefined, false);
        return;
      }
    }
  }, [state.packs, state.statuses, actions]);

  // API not available
  if (!actions.isAvailable) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg mb-2">增强能力管理暂不可用</p>
        <p className="text-sm">基础功能仍可正常使用</p>
      </div>
    );
  }

  // Loading
  if (state.loading) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p>正在加载...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">增强能力</h2>

      {message && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-800 dark:text-green-200 flex justify-between items-center">
          <span>{message}</span>
          <button onClick={clearMessage} className="text-green-600 dark:text-green-400 hover:underline">关闭</button>
        </div>
      )}

      {state.error && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
          <p>操作未完成。你可以重试，或继续使用基础功能。</p>
        </div>
      )}

      {/* Installed / enabled packs */}
      {state.packs.filter(p => {
        const s = state.statuses.get(p.packId);
        return s && (s.phase === 'installed' || s.phase === 'enabled' || s.phase === 'disabled' || s.phase === 'error' || s.phase === 'failed');
      }).length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">已安装</h3>
          <div className="space-y-3">
            {state.packs.filter(p => {
              const s = state.statuses.get(p.packId);
              return s && (s.phase === 'installed' || s.phase === 'enabled' || s.phase === 'disabled' || s.phase === 'error' || s.phase === 'failed');
            }).map(p => (
              <RuntimePackCard
                key={p.packId}
                pack={p}
                status={state.statuses.get(p.packId) ?? null}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onEnable={handleEnable}
                onDisable={handleDisable}
                onRetry={handleRetry}
                onDiagnose={handleDiagnose}
                onClearCache={handleClearCache}
                onExportDiagnostics={handleExportDiagnostics}
              />
            ))}
          </div>
        </section>
      )}

      {/* Available to install */}
      {state.packs.filter(p => {
        const s = state.statuses.get(p.packId);
        return !s || s.phase === 'available-to-install' || s.phase === 'discovered';
      }).length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">可加载</h3>
          <div className="space-y-3">
            {state.packs.filter(p => {
              const s = state.statuses.get(p.packId);
              return !s || s.phase === 'available-to-install' || s.phase === 'discovered';
            }).map(p => (
              <RuntimePackCard
                key={p.packId}
                pack={p}
                status={state.statuses.get(p.packId) ?? null}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onEnable={handleEnable}
                onDisable={handleDisable}
                onRetry={handleRetry}
                onDiagnose={handleDiagnose}
                onClearCache={handleClearCache}
                onExportDiagnostics={handleExportDiagnostics}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {state.packs.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          <p>当前没有可加载的增强模块</p>
          <p className="text-sm mt-1">基础功能仍可正常使用</p>
        </div>
      )}

      {/* Tools */}
      <section className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">工具</h3>
        <button
          onClick={() => handleExportDiagnostics(null)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          导出所有诊断日志
        </button>
      </section>

      {/* Dialogs */}
      {dialog.kind === 'install' && (
        <RuntimeInstallDialog
          packId={dialog.packId}
          displayName={dialog.displayName}
          networkRequired={dialog.networkRequired}
          diskSizeMb={dialog.diskSizeMb}
          onConfirm={handleConfirmInstall}
          onCancel={() => setDialog({ kind: 'none' })}
        />
      )}
      {dialog.kind === 'progress' && (
        <RuntimeProgressDialog
          packId={dialog.packId}
          displayName={dialog.displayName}
          status={state.statuses.get(dialog.packId) ?? null}
          onCancel={handleCancelInstall}
          onRetry={handleRetry}
        />
      )}
      {dialog.kind === 'diagnostics' && (
        <RuntimeDiagnosticsDialog
          packId={dialog.packId}
          displayName={dialog.displayName}
          onDiagnose={actions.diagnose}
          onExportDiagnostics={handleExportDiagnostics}
          onClose={() => setDialog({ kind: 'none' })}
        />
      )}
      {dialog.kind === 'uninstall' && (
        <RuntimeUninstallDialog
          displayName={dialog.displayName}
          onConfirm={handleConfirmUninstall}
          onCancel={() => setDialog({ kind: 'none' })}
        />
      )}
      {dialog.kind === 'clearCache' && (
        <RuntimeClearCacheDialog
          displayName={dialog.displayName}
          onConfirm={handleConfirmClearCache}
          onCancel={() => setDialog({ kind: 'none' })}
        />
      )}
    </div>
  );
}
