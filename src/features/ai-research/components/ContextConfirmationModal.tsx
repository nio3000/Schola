import type { ReactElement } from 'react';
import type { ResearchContextPreview } from '../../../lib/contracts/ai-research.types';

export interface ContextConfirmationModalProps {
  readonly preview: ResearchContextPreview | null;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

export function ContextConfirmationModal({ preview, onConfirm, onClose }: ContextConfirmationModalProps): ReactElement {
  return (
    <div className="settings-dialog-overlay" data-testid="ai-research-context-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="ai-research-context-confirmation-title">
      <div className="settings-dialog">
        <div className="settings-dialog-header">
          <span className="settings-dialog-icon">⇄</span>
          <h2 id="ai-research-context-confirmation-title" className="settings-dialog-title">确认上下文发送摘要</h2>
        </div>
        <div className="settings-dialog-body">
          <p className="settings-dialog-lead">请确认本次仅发送下列元数据对应的上下文包草稿。不会显示或保存 API 密钥。</p>
          {preview ? (
            <div className="settings-dialog-options">
              <p className="settings-dialog-options-title">发送摘要</p>
              <div className="workspace-ai-research-modal-grid">
                <span>文件数</span><strong>{preview.fileCount}</strong>
                <span>预计 Token</span><strong>{preview.tokenEstimate.totalTokens}</strong>
                <span>提供者</span><strong>{preview.providerId}</strong>
                <span>模型</span><strong>{preview.model}</strong>
                <span>截断文件</span><strong>{preview.truncatedFileCount}</strong>
              </div>
              {preview.warnings.length > 0 && (
                <div className="workspace-ai-research-modal-warnings">
                  <p className="settings-dialog-options-title">注意事项</p>
                  <ul className="workspace-ai-research-warning-list">
                    {preview.warnings.map((warning, idx) => (
                      <li key={idx} className="workspace-ai-research-warning-item">{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="settings-dialog-note">尚未构建上下文包草稿。</p>
          )}
        </div>
        <div className="settings-dialog-footer">
          <button type="button" className="settings-dialog-btn settings-dialog-btn-secondary" onClick={onClose}>取消</button>
          <button type="button" className="settings-dialog-btn settings-dialog-btn-primary" onClick={onConfirm} disabled={!preview}>确认上下文</button>
        </div>
      </div>
    </div>
  );
}
