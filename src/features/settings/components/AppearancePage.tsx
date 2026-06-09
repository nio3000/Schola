import type { ReactElement } from 'react';
import { AppThemeSelector } from '../../theme/AppThemeSelector';

export function AppearancePage(): ReactElement {
  return (
    <div className="settings-page-content" data-testid="settings-appearance-page">
      <h2 className="settings-page-title">外观设置</h2>
      <p className="settings-page-desc">
        选择 Schola 工作台的全局主题。所有界面区域（菜单栏、侧栏、编辑器、预览、
        图谱、设置面板等）会同步变化。
      </p>

      <section className="settings-section" data-testid="settings-section-theme-selector">
        <h3 className="settings-section-title">全局主题</h3>
        <p className="settings-section-desc">
          主题保存在本机，不会写入 Vault，也不会发送给远程服务。
        </p>
        <div className="settings-theme-selector-row">
          <AppThemeSelector />
        </div>
      </section>
    </div>
  );
}
