/**
 * RuntimeDiagnosticsDialog — Phase 3-4-G3-C.
 *
 * No system paths, no raw traceback, no API keys, no download URLs.
 */

import { useState, useEffect, type ReactElement } from 'react';

interface RuntimeDiagnosticsDialogProps {
  readonly packId: string;
  readonly displayName: string;
  readonly onDiagnose: (packId: string) => Promise<string | null>;
  readonly onExportDiagnostics?: (packId: string) => void;
  readonly onClose: () => void;
}

export function RuntimeDiagnosticsDialog({ packId, displayName, onDiagnose, onExportDiagnostics, onClose }: RuntimeDiagnosticsDialogProps): ReactElement {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    onDiagnose(packId).then(r => { setResult(r); setLoading(false); });
  }, [packId, onDiagnose]);

  const handleExport = () => {
    if (onExportDiagnostics) {
      onExportDiagnostics(packId);
      setExportMessage('诊断日志已导出');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">诊断：{displayName}</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 max-h-96 overflow-y-auto">
          {loading ? '正在运行诊断...' : (result ?? '诊断未返回结果')}
        </div>
        {!loading && (
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            诊断信息已自动脱敏，不包含系统路径或个人文件路径。
          </div>
        )}
        {exportMessage && (
          <div className="text-sm text-green-600 dark:text-green-400 mb-3">{exportMessage}</div>
        )}
        <div className="flex justify-end gap-3">
          {!loading && onExportDiagnostics && (
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              导出诊断日志
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
