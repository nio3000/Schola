/**
 * AboutPage — application information panel.
 *
 * Displays Schola app info retrieved via schola.app.getInfo().
 * Shows name, version, platform, and current phase.
 *
 * Key invariants:
 * - Uses getAppInfo from existing schola-api
 * - Shows app metadata only, no user data
 * - Consistent with Schola dark theme
 */

import { useEffect, useState, type ReactElement } from 'react';
import type { AppInfo } from '../../../lib/contracts/app.types';
import { getAppInfo } from '../../../lib/platform/schola-api';

export function AboutPage(): ReactElement {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const info = await getAppInfo();
        if (!cancelled) setAppInfo(info);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : '获取应用信息失败');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="settings-page-content" data-testid="settings-about-page">
      <h2 className="settings-page-title">关于</h2>

      {loadError && (
        <div className="settings-error-banner" data-testid="settings-about-error">
          <span>{loadError}</span>
        </div>
      )}

      {appInfo ? (
        <div className="settings-about-info" data-testid="settings-about-info">
          <div className="settings-about-brand">
            <span className="settings-about-icon">{'\uD83C\uDF93'}</span>
            <span className="settings-about-name">{appInfo.name}</span>
          </div>

          <div className="settings-field">
            <span className="settings-field-label">版本</span>
            <span className="settings-field-value">V{appInfo.version}</span>
          </div>
          <div className="settings-field">
            <span className="settings-field-label">平台</span>
            <span className="settings-field-value">{appInfo.platform}</span>
          </div>
          <div className="settings-field">
            <span className="settings-field-label">阶段</span>
            <span className="settings-field-value">{appInfo.phase}</span>
          </div>
        </div>
      ) : (
        !loadError && (
          <div className="settings-loading" data-testid="settings-about-loading">
            <p>加载中...</p>
          </div>
        )
      )}

      <section className="settings-section settings-about-footer">
        <p className="settings-section-desc">
          Schola 是面向高校科研人员与教育工作者的本地优先知识工作台。
        </p>
        <p className="settings-section-desc settings-about-copyright">
          Schola 是面向高校科研人员与教育工作者的本地优先知识工作台。
        </p>
      </section>
    </div>
  );
}
