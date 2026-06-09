/**
 * PrivacyPage — privacy & consent settings panel.
 *
 * Shows current consent status, policy settings, and confirmation log.
 *
 * Key invariants:
 * - Displays consent status with version info
 * - Shows context send policy with read-only display
 * - Shows recent confirmation log entries
 * - No API keys or personal data displayed
 */

import type { ReactElement } from 'react';
import type {
  ConfirmationLogEntry,
  PrivacyConsentState,
} from '../../../lib/contracts/settings.types';

export interface PrivacyPageProps {
  readonly privacyConsent: PrivacyConsentState | null;
  readonly confirmationLog: readonly ConfirmationLogEntry[];
}

function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function PrivacyPage({ privacyConsent, confirmationLog }: PrivacyPageProps): ReactElement {
  return (
    <div className="settings-page-content" data-testid="settings-privacy-page">
      <h2 className="settings-page-title">隐私</h2>
      <p className="settings-section-desc">
        Schola 坚持本地优先与 BYOK（自带密钥）原则：默认不会上传你的 Vault 内容，
        远程上下文发送始终以用户确认和当前策略为准。
      </p>

      <section className="settings-section" data-testid="settings-section-consent">
        <h3 className="settings-section-title">{'\uD83D\uDCCB'} 同意管理</h3>
        {privacyConsent ? (
          <div className="settings-consent-info">
            <div className="settings-field">
              <span className="settings-field-label">隐私同意</span>
              <span
                className={`settings-field-value ${privacyConsent.privacyConsentAccepted ? 'settings-field-enabled' : 'settings-field-disabled'}`}
              >
                {privacyConsent.privacyConsentAccepted ? '已同意' : '未同意'}
              </span>
            </div>
            <div className="settings-field">
              <span className="settings-field-label">同意版本</span>
              <span className="settings-field-value">
                {privacyConsent.privacyConsentVersion || '—'}
              </span>
            </div>
            <div className="settings-field">
              <span className="settings-field-label">同意时间</span>
              <span className="settings-field-value">
                {privacyConsent.privacyConsentAcceptedAt
                  ? formatTimestamp(privacyConsent.privacyConsentAcceptedAt)
                  : '—'}
              </span>
            </div>
            <div className="settings-field">
              <span className="settings-field-label">远程 AI</span>
              <span
                className={`settings-field-value ${privacyConsent.allowRemoteProvider ? 'settings-field-enabled' : 'settings-field-disabled'}`}
              >
                {privacyConsent.allowRemoteProvider ? '已允许' : '未允许'}
              </span>
            </div>
          </div>
        ) : (
          <p className="settings-section-desc">尚未配置隐私同意。首次使用时将弹出同意对话框。</p>
        )}
      </section>

      <section className="settings-section" data-testid="settings-section-policy">
        <h3 className="settings-section-title">{'\uD83D\uDEE1\uFE0F'} 发送策略</h3>
        {privacyConsent ? (
          <div className="settings-consent-info">
            <div className="settings-field">
              <span className="settings-field-label">上下文发送策略</span>
              <span className="settings-field-value">
                {privacyConsent.defaultContextSendPolicy === 'never'
                  ? '永不发送'
                  : privacyConsent.defaultContextSendPolicy === 'always-ask'
                    ? '每次询问'
                    : '允许本地'}
              </span>
            </div>
          </div>
        ) : (
          <p className="settings-section-desc">尚未配置发送策略。</p>
        )}
      </section>

      <section className="settings-section" data-testid="settings-section-confirm-log">
        <h3 className="settings-section-title">{'\uD83D\uDCDD'} 确认日志</h3>
        {confirmationLog.length === 0 ? (
          <p className="settings-section-desc">暂无上下文发送确认记录。</p>
        ) : (
          <div className="settings-confirm-log">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>提供者</th>
                  <th>模型</th>
                  <th>文件数</th>
                  <th>Token</th>
                  <th>范围</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                {confirmationLog.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatTimestamp(entry.confirmedAt)}</td>
                    <td>{entry.providerId}</td>
                    <td>{entry.model}</td>
                    <td>{entry.fileCount}</td>
                    <td>{entry.totalTokens}</td>
                    <td>{entry.confirmationScope === 'per-request' ? '每次请求' : '每次会话'}</td>
                    <td>
                      <span
                        className={
                          entry.confirmed ? 'settings-log-confirmed' : 'settings-log-cancelled'
                        }
                      >
                        {entry.confirmed ? '已确认' : '已取消'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
