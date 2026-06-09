/**
 * ContextConfirmDialog — pre-send context confirmation dialog.
 *
 * Shows a summary of what would be sent to a cloud provider before
 * the actual API call. Includes file count, total tokens, provider, model.
 * User chooses per-request vs per-session confirmation scope.
 *
 * Key invariants:
 * - Shows fileCount, totalTokens, provider, model ONLY
 * - Shows truncated file count (truncated files marked)
 * - NO file content, NO file paths, NO API keys, NO secrets
 * - Confirm/Cancel buttons that work
 * - Logs confirmation metadata on confirm
 * - No actual context sends
 * - No fake buttons
 */

import { useCallback, useState, type ReactElement } from 'react';

export interface ContextConfirmSummary {
  readonly fileCount: number;
  readonly totalTokens: number;
  readonly truncatedFileCount: number;
  readonly providerId: string;
  readonly model: string;
  readonly providerDisplayName: string;
}

export interface ContextConfirmResult {
  readonly confirmed: boolean;
  readonly scope: 'per-request' | 'per-session';
}

export interface ContextConfirmDialogProps {
  readonly summary: ContextConfirmSummary;
  readonly onConfirm: (result: ContextConfirmResult) => void;
  readonly onCancel: () => void;
}

export function ContextConfirmDialog({
  summary,
  onConfirm,
  onCancel,
}: ContextConfirmDialogProps): ReactElement {
  const [scope, setScope] = useState<'per-request' | 'per-session'>('per-request');
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = useCallback(() => {
    setConfirming(true);
    // Log confirmation metadata (no content, no paths, no secrets)
    if (process.env.NODE_ENV === 'development') {
      // Development-only confirmation metadata logging
      // (no content, no paths, no secrets)
      console.debug('[ContextConfirmDialog] confirmed', {
        fileCount: summary.fileCount,
        totalTokens: summary.totalTokens,
        providerId: summary.providerId,
        model: summary.model,
        scope,
        timestamp: new Date().toISOString(),
      });
    }
    onConfirm({ confirmed: true, scope });
  }, [summary, scope, onConfirm]);

  return (
    <div
      className="settings-dialog-overlay"
      data-testid="context-confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="context-confirm-title"
    >
      <div className="settings-dialog">
        <div className="settings-dialog-header">
          <span className="settings-dialog-icon">{'\uD83D\uDCE4'}</span>
          <h2 id="context-confirm-title" className="settings-dialog-title">
            上下文发送确认
          </h2>
        </div>

        <div className="settings-dialog-body">
          <p className="settings-dialog-lead">
            即将向 <strong>{summary.providerDisplayName}</strong>（{summary.model}）发送以下上下文：
          </p>

          <div className="settings-context-summary">
            <div className="settings-context-row">
              <span className="settings-context-label">文件数量</span>
              <span className="settings-context-value">{summary.fileCount}</span>
            </div>
            <div className="settings-context-row">
              <span className="settings-context-label">预估 Token</span>
              <span className="settings-context-value">
                {'\u2248'} {summary.totalTokens.toLocaleString()}
              </span>
            </div>
            {summary.truncatedFileCount > 0 && (
              <div className="settings-context-row settings-context-truncated">
                <span className="settings-context-label">已截断文件</span>
                <span className="settings-context-value">
                  {summary.truncatedFileCount}
                </span>
              </div>
            )}
          </div>

          <p className="settings-dialog-note">
            仅发送选中文件的内容摘要，不包含文件路径、API Key 或其他敏感信息。
          </p>

          <div className="settings-dialog-options" role="radiogroup" aria-label="确认范围">
            <p className="settings-dialog-options-title">确认范围：</p>
            <label className="settings-dialog-radio">
              <input
                type="radio"
                name="confirm-scope"
                value="per-request"
                checked={scope === 'per-request'}
                onChange={() => setScope('per-request')}
                data-testid="context-scope-per-request"
              />
              <span className="settings-dialog-radio-label">
                仅本次请求
              </span>
            </label>
            <label className="settings-dialog-radio">
              <input
                type="radio"
                name="confirm-scope"
                value="per-session"
                checked={scope === 'per-session'}
                onChange={() => setScope('per-session')}
                data-testid="context-scope-per-session"
              />
              <span className="settings-dialog-radio-label">
                本次会话内不再询问
              </span>
            </label>
          </div>
        </div>

        <div className="settings-dialog-footer">
          <button
            type="button"
            className="settings-btn settings-btn-secondary"
            onClick={onCancel}
            disabled={confirming}
            data-testid="context-confirm-cancel"
          >
            取消
          </button>
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleConfirm}
            disabled={confirming}
            data-testid="context-confirm-confirm"
          >
            {confirming ? '处理中...' : '确认发送'}
          </button>
        </div>
      </div>
    </div>
  );
}
