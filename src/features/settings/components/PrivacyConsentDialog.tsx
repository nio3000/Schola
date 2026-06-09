/**
 * PrivacyConsentDialog — first-use privacy consent modal dialog.
 *
 * Content:
 * - BVOK explanation
 * - Local-first policy
 * - No auto-upload guarantee
 * - Radio: allow remote AI (BYOK) vs local-only mode
 * - Save consent via schola-api
 *
 * Key invariants:
 * - Must display: "Schola 是本地优先的知识工作台。您的文件内容默认不会上传。"
 * - No API key collection in this dialog
 * - Calls setPrivacyConsent on confirm
 */

import { useCallback, useState, type ReactElement } from 'react';
import {
  createAcceptedPrivacyConsentState,
} from '../../../lib/contracts/settings.types';
import { setPrivacyConsent } from '../../../lib/platform/settings-api';

export interface PrivacyConsentDialogProps {
  readonly onConsentSaved: () => void;
  readonly onDismiss: () => void;
}

export function PrivacyConsentDialog({
  onConsentSaved,
  onDismiss,
}: PrivacyConsentDialogProps): ReactElement {
  const [allowRemote, setAllowRemote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const consent = createAcceptedPrivacyConsentState(allowRemote);
      await setPrivacyConsent(consent);
      onConsentSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '保存隐私同意失败',
      );
    } finally {
      setSaving(false);
    }
  }, [allowRemote, onConsentSaved]);

  return (
    <div
      className="settings-dialog-overlay"
      data-testid="privacy-consent-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-consent-title"
    >
      <div className="settings-dialog">
        <div className="settings-dialog-header">
          <span className="settings-dialog-icon">{'\uD83D\uDD12'}</span>
          <h2 id="privacy-consent-title" className="settings-dialog-title">
            隐私与数据使用说明
          </h2>
        </div>

        <div className="settings-dialog-body">
          <p className="settings-dialog-lead">
            Schola 是本地优先的知识工作台。您的文件内容默认不会上传。
          </p>

          <div className="settings-dialog-section">
            <h3 className="settings-dialog-section-title">{'\uD83D\uDEE1\uFE0F'} 本地优先</h3>
            <p>
              所有笔记、文献、资料默认存储在您的本地设备上。Schola
              不会自动将您的文件内容上传到任何远程服务器。
            </p>
          </div>

          <div className="settings-dialog-section">
            <h3 className="settings-dialog-section-title">{'\uD83D\uDD11'} 自带密钥（BYOK）</h3>
            <p>
              如您选择使用远程 AI 功能，需要自行提供 API Key（如 OpenAI、DeepSeek
              等）。您的 API Key 将加密存储在本地系统安全存储中。Schola
              不会收集、存储或转发您的 API Key。
            </p>
          </div>

          <div className="settings-dialog-section">
            <h3 className="settings-dialog-section-title">{'\u2705'} 明确授权</h3>
            <p>
              每次将笔记内容发送到远程 AI 之前，Schola
              会向您展示即将发送的内容摘要（文件数量、Token
              估算），并需要您明确确认。您可以随时在设置中撤销此授权。
            </p>
          </div>

          <div className="settings-dialog-options" role="radiogroup" aria-label="远程 AI 选择">
            <p className="settings-dialog-options-title">
              请选择您的远程 AI 偏好：
            </p>
            <label className="settings-dialog-radio">
              <input
                type="radio"
                name="remote-ai"
                value="allow"
                checked={allowRemote}
                onChange={() => setAllowRemote(true)}
                data-testid="privacy-radio-allow"
              />
              <span className="settings-dialog-radio-label">
                允许远程 AI（需自行提供 API Key）
              </span>
            </label>
            <label className="settings-dialog-radio">
              <input
                type="radio"
                name="remote-ai"
                value="local-only"
                checked={!allowRemote}
                onChange={() => setAllowRemote(false)}
                data-testid="privacy-radio-local"
              />
              <span className="settings-dialog-radio-label">
                仅本地模式（不使用远程 AI）
              </span>
            </label>
          </div>

          {error && (
            <div className="settings-dialog-error" data-testid="privacy-consent-error">
              {error}
            </div>
          )}
        </div>

        <div className="settings-dialog-footer">
          <button
            type="button"
            className="settings-btn settings-btn-secondary"
            onClick={onDismiss}
            disabled={saving}
            data-testid="privacy-consent-cancel"
          >
            稍后决定
          </button>
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleConfirm}
            disabled={saving}
            data-testid="privacy-consent-confirm"
          >
            {saving ? '保存中...' : '确认并保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
