/**
 * RuntimeUninstallDialog — Phase 3-4-G3-C.
 */

import { useState, type ReactElement } from 'react';

interface RuntimeUninstallDialogProps {
  readonly displayName: string;
  readonly onConfirm: (removeModelCache: boolean, removeLogs: boolean) => void;
  readonly onCancel: () => void;
}

export function RuntimeUninstallDialog({ displayName, onConfirm, onCancel }: RuntimeUninstallDialogProps): ReactElement {
  const [removeModelCache, setRemoveModelCache] = useState(true);
  const [removeLogs, setRemoveLogs] = useState(true);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">确认卸载</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          即将卸载「{displayName}」。
        </p>
        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={removeModelCache} onChange={e => setRemoveModelCache(e.target.checked)} />
            同时删除模型缓存
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={removeLogs} onChange={e => setRemoveLogs(e.target.checked)} />
            同时删除诊断日志
          </label>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          你的 Vault 文件、笔记和附件不会被删除。
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">取消</button>
          <button onClick={() => onConfirm(removeModelCache, removeLogs)} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors">确认卸载</button>
        </div>
      </div>
    </div>
  );
}
