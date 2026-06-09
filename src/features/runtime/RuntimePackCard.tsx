/**
 * RuntimePackCard — Phase 3-4-G3-C.
 *
 * Individual Runtime Pack status card. Shows status, version, actions.
 * No system paths, no download URLs, no engine names.
 */

import type { ReactElement } from 'react';
import type { RuntimePackStatus, RuntimePackSummary, RuntimePackPhase } from '../../lib/contracts/runtime-pack.types';

interface RuntimePackCardProps {
  readonly pack: RuntimePackSummary;
  readonly status: RuntimePackStatus | null;
  readonly onInstall: (packId: string, displayName: string, networkRequired: 'never' | 'install' | 'firstUse' | 'always', diskSizeMb: number | null) => void;
  readonly onUninstall: (packId: string, displayName: string) => void;
  readonly onEnable: (packId: string) => void;
  readonly onDisable: (packId: string) => void;
  readonly onRetry: () => void;
  readonly onDiagnose: (packId: string, displayName: string) => void;
  readonly onClearCache: (packId: string, displayName: string) => void;
  readonly onExportDiagnostics: (packId: string) => void;
}

const PHASE_LABELS: Record<RuntimePackPhase, { label: string; color: string }> = {
  undiscovered: { label: '未发现', color: 'text-gray-400' },
  discovered: { label: '已发现', color: 'text-gray-400' },
  'available-to-install': { label: '可加载', color: 'text-blue-600 dark:text-blue-400' },
  unavailable: { label: '暂不可用', color: 'text-gray-400' },
  'probe-failed': { label: '检测失败', color: 'text-amber-600' },
  installing: { label: '正在加载', color: 'text-blue-600 dark:text-blue-400' },
  installed: { label: '已安装', color: 'text-gray-500' },
  enabled: { label: '已启用', color: 'text-green-600 dark:text-green-400' },
  running: { label: '正在运行', color: 'text-blue-600 dark:text-blue-400' },
  error: { label: '运行异常', color: 'text-red-600 dark:text-red-400' },
  disabled: { label: '已禁用', color: 'text-gray-400' },
  uninstalling: { label: '正在卸载', color: 'text-gray-400' },
  uninstalled: { label: '未安装', color: 'text-gray-400' },
  failed: { label: '操作失败', color: 'text-red-600 dark:text-red-400' },
};

function displayName(pack: RuntimePackSummary): string {
  if (pack.displayName && pack.displayName !== pack.packId) return pack.displayName;
  // Map known pack IDs to user-friendly names (no engine names!)
  const KNOWN: Record<string, string> = {
    'schola.import.quick-plus': 'PDF 增强导入',
    'schola.import.formula-pack': '公式识别增强',
    'schola.import.precision': '论文导入增强',
    'schola.import.chinese': '中文版面解析',
    'schola.import.ocr': 'OCR 扫描件识别',
  };
  return KNOWN[pack.packId] ?? '增强模块';
}

export function RuntimePackCard({ pack, status, onInstall, onUninstall, onEnable, onDisable, onRetry, onDiagnose, onClearCache, onExportDiagnostics }: RuntimePackCardProps): ReactElement {
  const phase: RuntimePackPhase = status?.phase ?? 'available-to-install';
  const phaseInfo = PHASE_LABELS[phase] ?? { label: phase, color: 'text-gray-400' };
  const name = displayName(pack);
  const desc = pack.description || '提升文档解析和处理效果';
  const version = status?.installedVersion ?? pack.version;
  const disk = status?.progress ? `${status.progress.percent}%` : (pack.diskSizeMb ? `${pack.diskSizeMb} MB` : null);
  const isInstalling = phase === 'installing';
  const isUninstalling = phase === 'uninstalling';
  const canInstall = phase === 'available-to-install' || phase === 'discovered';
  const canEnable = phase === 'installed' || phase === 'disabled';
  const canDisable = phase === 'enabled';
  const canUninstall = phase === 'installed' || phase === 'enabled' || phase === 'disabled' || phase === 'error' || phase === 'failed';
  const canDiagnose = phase !== 'undiscovered' && phase !== 'uninstalled' && phase !== 'installing' && phase !== 'uninstalling';
  const hasError = phase === 'error' || phase === 'failed';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100">{name}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${phaseInfo.color} bg-gray-100 dark:bg-gray-700`}>
          {phaseInfo.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500 mb-3">
        {version && <span>版本 {version}</span>}
        {disk && <span>占用 {disk}</span>}
        {pack.networkRequired && pack.networkRequired !== 'never' && (
          <span>需要联网</span>
        )}
      </div>

      {status?.lastErrorMessage && hasError && (
        <div className="text-xs text-red-600 dark:text-red-400 mb-3 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {status.lastErrorMessage.slice(0, 150)}
        </div>
      )}

      {status?.lastProbeOk != null && (
        <div className={`text-xs mb-3 ${status.lastProbeOk ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {status.lastProbeOk ? '上次检测通过' : '上次检测失败'}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canInstall && (
          <>
            <button
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              了解更多
            </button>
            <button
              onClick={() => onInstall(pack.packId, name, pack.networkRequired, pack.diskSizeMb)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              加载
            </button>
          </>
        )}
        {canEnable && (
          <button
            onClick={() => onEnable(pack.packId)}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            启用
          </button>
        )}
        {canDisable && (
          <button
            onClick={() => onDisable(pack.packId)}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            禁用
          </button>
        )}
        {hasError && (
          <button
            onClick={onRetry}
            className="px-3 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
          >
            重试
          </button>
        )}
        {canDiagnose && (
          <button
            onClick={() => onDiagnose(pack.packId, name)}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            诊断
          </button>
        )}
        {canDiagnose && (
          <button
            onClick={() => onClearCache(pack.packId, name)}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            清理缓存
          </button>
        )}
        {canDiagnose && (
          <button
            onClick={() => onExportDiagnostics(pack.packId)}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            导出诊断
          </button>
        )}
        {canUninstall && (
          <button
            onClick={() => onUninstall(pack.packId, name)}
            className="px-3 py-1 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            卸载
          </button>
        )}
        {isInstalling && (
          <button
            disabled
            className="px-3 py-1 text-sm bg-blue-300 text-white rounded cursor-not-allowed"
          >
            加载中...
          </button>
        )}
        {isUninstalling && (
          <button
            disabled
            className="px-3 py-1 text-sm bg-gray-300 text-white rounded cursor-not-allowed"
          >
            卸载中...
          </button>
        )}
      </div>
    </div>
  );
}
