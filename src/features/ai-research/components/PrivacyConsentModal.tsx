import type { ReactElement } from 'react';

export interface PrivacyConsentModalProps {
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

export function PrivacyConsentModal({
  onConfirm,
  onClose,
}: PrivacyConsentModalProps): ReactElement {
  return (
    <div
      className="settings-dialog-overlay"
      data-testid="ai-research-privacy-consent-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-research-privacy-consent-title"
    >
      <div className="settings-dialog">
        <div className="settings-dialog-header">
          <span className="settings-dialog-icon">§</span>
          <h2 id="ai-research-privacy-consent-title" className="settings-dialog-title">
            隐私同意确认
          </h2>
        </div>
        <div className="settings-dialog-body">
          <p className="settings-dialog-lead">
            请确认本次请求会把已确认 ContextPack 中的内容发送给当前 AI
            provider。用户取消后不会发送请求。
          </p>
          <div className="settings-dialog-section">
            <h3 className="settings-dialog-section-title">发送范围</h3>
            <p>
              仅发送你已选择并确认的资源，不发送整个 Vault，不发送未选择文件。PDF / Office
              metadata-only 文件不会发送正文。
            </p>
          </div>
          <div className="settings-dialog-section">
            <h3 className="settings-dialog-section-title">安全边界</h3>
            <p>
              不会发送 API key，不显示密钥内容。生成结果不会自动写入 Vault，Artifact 不会自动保存。
            </p>
          </div>
        </div>
        <div className="settings-dialog-footer">
          <button
            type="button"
            className="settings-dialog-btn settings-dialog-btn-secondary"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="settings-dialog-btn settings-dialog-btn-primary"
            onClick={onConfirm}
          >
            我已理解并同意
          </button>
        </div>
      </div>
    </div>
  );
}
