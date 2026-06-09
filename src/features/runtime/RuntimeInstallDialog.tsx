/**
 * RuntimeInstallDialog — Phase 3-4-G3-C / G3-D0 delta.
 *
 * Installation confirmation dialog. No URLs, no paths, no engine names.
 * G3-D0: added acceptedNetworkDownload explicit confirmation checkbox.
 */

import { useState, type ReactElement } from 'react';

interface RuntimeInstallDialogProps {
  readonly packId: string;
  readonly displayName: string;
  readonly networkRequired: 'never' | 'install' | 'firstUse' | 'always';
  readonly diskSizeMb: number | null;
  readonly onConfirm: (acceptedNetworkDownload: boolean) => void;
  readonly onCancel: () => void;
}

export function RuntimeInstallDialog({ displayName, networkRequired, diskSizeMb, onConfirm, onCancel }: RuntimeInstallDialogProps): ReactElement {
  const needsNetwork = networkRequired !== 'never';
  const requiresExplicitConsent = networkRequired === 'install' || networkRequired === 'firstUse' || networkRequired === 'always';
  const [acceptedNetworkDownload, setAcceptedNetworkDownload] = useState(false);

  const canConfirm = !requiresExplicitConsent || acceptedNetworkDownload;

  const handleConfirm = () => {
    onConfirm(requiresExplicitConsent ? acceptedNetworkDownload : false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">加载增强模块</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          即将加载「{displayName}」。该模块在本地运行，用于提升文档解析效果。
        </p>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 space-y-1.5 mb-4">
          <div><span className="font-medium">来源：</span>Schola 官方</div>
          <div>
            <span className="font-medium">网络需求：</span>
            {needsNetwork ? '可能需要联网' : '无需联网'}
          </div>
          {diskSizeMb != null && diskSizeMb > 0 && (
            <>
              <div><span className="font-medium">预计下载大小：</span>{diskSizeMb} MB</div>
              <div><span className="font-medium">预计安装后占用：</span>{Math.round(diskSizeMb * 1.5)} MB</div>
            </>
          )}
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            加载该增强模块不会上传你的文档。除非你单独启用云端 AI 并确认发送范围，否则 Schola 不会上传你的 Vault 内容。
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            加载完成后可随时在设置中禁用或卸载。
          </div>
        </div>

        {requiresExplicitConsent && (
          <label className="flex items-start gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedNetworkDownload}
              onChange={e => setAcceptedNetworkDownload(e.target.checked)}
              className="mt-0.5"
              data-testid="network-consent-checkbox"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              我确认允许 Schola 联网下载该增强模块所需文件
            </span>
          </label>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            data-testid="confirm-install-btn"
            className={`px-4 py-2 text-sm rounded transition-colors ${
              canConfirm
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-300 text-white cursor-not-allowed'
            }`}
          >
            确认加载
          </button>
        </div>
      </div>
    </div>
  );
}
