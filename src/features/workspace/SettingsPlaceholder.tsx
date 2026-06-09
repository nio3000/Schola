/**
 * SettingsPlaceholder.
 *
 * Read-only placeholder for the Settings Center.
 * Displays "coming soon" message with no interactive elements.
 *
 * Key invariants:
 * - Read-only: no buttons, no inputs, no toggles, no actions
 * - No runtime: does not invoke any Settings/Provider/API Key functionality
 * - Clear messaging: user knows this is a future feature
 */
import type { ReactElement } from 'react';

export function SettingsPlaceholder(): ReactElement {
  return (
    <div className="settings-placeholder" data-testid="settings-placeholder">
      <div className="settings-placeholder-content">
        <span className="settings-placeholder-icon">{'\u2699\uFE0F'}</span>
        <h2 className="settings-placeholder-title">设置</h2>
        <p className="settings-placeholder-subtitle">后续完成</p>
        <p className="settings-placeholder-desc">
          Settings Center、Provider 配置、API Key 安全存储、Context 发送确认
          等功能将在后续完成。
        </p>
      </div>
    </div>
  );
}
