import type { ReactElement } from 'react';

export interface PrivacyConsentModalProps {
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

export function PrivacyConsentModal({ onConfirm, onClose }: PrivacyConsentModalProps): ReactElement {
  return (
    <div className="settings-dialog-overlay" data-testid="ai-research-privacy-consent-modal" role="dialog" aria-modal="true" aria-labelledby="ai-research-privacy-consent-title">
      <div className="settings-dialog">
        <div className="settings-dialog-header">
          <span className="settings-dialog-icon">§</span>
          <h2 id="ai-research-privacy-consent-title" className="settings-dialog-title">隐私同意确认</h2>
        </div>
        <div className="settings-dialog-body">
          <p className="settings-dialog-lead">Schola 是本地优先的知识工作台。远程 AI 任务只会在你明确确认上下文并点击运行后开始。</p>
          <div className="settings-dialog-section">
            <h3 className="settings-dialog-section-title">草稿边界</h3>
            <p>AI 输出仅为草稿，需要人工审查，不会自动覆盖原文，也不会自动写入 Vault。</p>
          </div>
          <div className="settings-dialog-section">
            <h3 className="settings-dialog-section-title">数据边界</h3>
            <p>界面不会收集 API 密钥，不展示密钥内容，不执行后台上下文发送。</p>
          </div>
        </div>
        <div className="settings-dialog-footer">
          <button type="button" className="settings-dialog-btn settings-dialog-btn-secondary" onClick={onClose}>取消</button>
          <button type="button" className="settings-dialog-btn settings-dialog-btn-primary" onClick={onConfirm}>我已理解并同意</button>
        </div>
      </div>
    </div>
  );
}
