/**
 * AIPage — AI settings panel.
 *
 * Displays AI preferences and a notice about future integration.
 *
 * Key invariants:
 * - Must display: "真实 AI 调用将在后续完成"
 * - No real provider calls
 * - Shows current AI preferences (read-only)
 */

import type { ReactElement } from 'react';
import type { AIPreferences } from '../../../lib/contracts/settings.types';

export interface AIPageProps {
  readonly aiPrefs: AIPreferences;
}

export function AIPage({ aiPrefs }: AIPageProps): ReactElement {
  return (
    <div className="settings-page-content" data-testid="settings-ai-page">
      <h2 className="settings-page-title">AI 设置</h2>

      <div className="settings-notice" data-testid="settings-ai-notice">
        <span className="settings-notice-icon">{'\u2139\uFE0F'}</span>
        <div className="settings-notice-body">
          <p className="settings-notice-title">AI 调用将在后续完成</p>
          <p className="settings-notice-desc">
            真实 AI 调用将在后续完成。当前仅支持 Provider 配置与隐私偏好。
          </p>
        </div>
      </div>

      <section className="settings-section" data-testid="settings-section-ai-general">
        <h3 className="settings-section-title">{'\uD83E\uDD16'} 通用</h3>
        <div className="settings-field">
          <span className="settings-field-label">AI 功能</span>
          <span className={`settings-field-value ${aiPrefs.aiEnabled ? 'settings-field-enabled' : 'settings-field-disabled'}`}>
            {aiPrefs.aiEnabled ? '已启用' : '已禁用'}
          </span>
        </div>
        <div className="settings-field">
          <span className="settings-field-label">默认提供者</span>
          <span className="settings-field-value">
            {aiPrefs.defaultProviderId ?? '未设置'}
          </span>
        </div>
        <div className="settings-field">
          <span className="settings-field-label">默认模型</span>
          <span className="settings-field-value">
            {aiPrefs.defaultModel ?? '未设置'}
          </span>
        </div>
      </section>

      <section className="settings-section" data-testid="settings-section-ai-defaults">
        <h3 className="settings-section-title">{'\uD83C\uDFAF'} 默认设置</h3>
        <p className="settings-section-desc">
          配置默认的 AI 提供者和模型偏好。这些设置将在后续完成。
        </p>
        <span className="settings-section-badge">后续完成</span>
      </section>
    </div>
  );
}
