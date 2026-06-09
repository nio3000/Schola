/**
 * RuntimeProgressDialog — Phase 3-4-G3-C.
 */

import type { ReactElement } from 'react';
import type { RuntimePackStatus } from '../../lib/contracts/runtime-pack.types';

interface RuntimeProgressDialogProps {
  readonly packId: string;
  readonly displayName: string;
  readonly status: RuntimePackStatus | null;
  readonly onCancel: (packId: string) => void;
  readonly onRetry?: () => void;
}

const PROGRESS_PHASE_LABELS: Record<string, string> = {
  'checking-platform': '正在检查系统环境',
  'downloading': '正在下载',
  'verifying': '正在校验完整性',
  'installing': '正在安装',
  'probing': '正在验证可用性',
  'cleaning': '正在清理',
  'uninstalling': '正在卸载',
};

export function RuntimeProgressDialog({ packId, displayName, status, onCancel, onRetry }: RuntimeProgressDialogProps): ReactElement {
  const hasProgress = status?.progress != null;
  const pct = status?.progress?.percent ?? 0;
  const phaseLabel = status?.progress?.phase
    ? (PROGRESS_PHASE_LABELS[status.progress.phase] ?? '正在加载')
    : '正在准备';

  const isError = status?.phase === 'error' || status?.phase === 'failed';
  const canCancel = hasProgress && (status!.progress!.phase === 'checking-platform' || status!.progress!.phase === 'downloading');

  if (isError) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">加载失败</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{displayName}</p>
          {status?.lastErrorMessage && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-4 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              {status.lastErrorMessage.slice(0, 150)}
            </p>
          )}
          <div className="flex justify-center gap-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                重试
              </button>
            )}
            <button
              onClick={() => onCancel(packId)}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">正在加载增强模块</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{displayName}</p>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
          {hasProgress ? (
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          ) : (
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }} />
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          <span className="font-medium">阶段：</span>{phaseLabel}{hasProgress ? ` (${pct}%)` : '...'}
        </p>
        {canCancel && (
          <div className="flex justify-center">
            <button
              onClick={() => onCancel(packId)}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              取消
            </button>
          </div>
        )}
        {!canCancel && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">请稍候，此阶段不可取消</p>
        )}
      </div>
    </div>
  );
}
