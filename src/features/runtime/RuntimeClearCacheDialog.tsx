/**
 * RuntimeClearCacheDialog — Phase 3-4-G3-C.
 */

import type { ReactElement } from 'react';

interface RuntimeClearCacheDialogProps {
  readonly displayName: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function RuntimeClearCacheDialog({ displayName, onConfirm, onCancel }: RuntimeClearCacheDialogProps): ReactElement {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">确认清理缓存</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          即将清理「{displayName}」的缓存文件。
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          清理缓存只会删除该增强模块的临时文件或模型缓存，不会删除你的 Vault 文件、导入生成的 Markdown 或手动整理的笔记。
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">取消</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors">确认清理</button>
        </div>
      </div>
    </div>
  );
}
