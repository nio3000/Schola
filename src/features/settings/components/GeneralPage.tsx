/**
 * GeneralPage — general settings panel.
 *
 * Phase 5-RECONNECT: Merged appearance, real editor & vault settings.
 *
 * Sections: Appearance (theme), Editor (font/size/line), Vault (info).
 */

import { type ReactElement } from 'react';
import { AppThemeSelector } from '../../theme/AppThemeSelector';

const FONT_FAMILIES = [
  { value: 'ui-monospace, Cascadia Code, Source Code Pro, Menlo, Consolas, monospace', label: 'System Monospace' },
  { value: '"Cascadia Code", ui-monospace, Consolas, monospace', label: 'Cascadia Code' },
  { value: '"Fira Code", ui-monospace, Consolas, monospace', label: 'Fira Code' },
  { value: '"JetBrains Mono", ui-monospace, Consolas, monospace', label: 'JetBrains Mono' },
  { value: '"Source Code Pro", ui-monospace, Consolas, monospace', label: 'Source Code Pro' },
  { value: 'Consolas, "Courier New", monospace', label: 'Consolas' },
];

function readStored(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function GeneralPage(): ReactElement {
  return (
    <div className="settings-page-content" data-testid="settings-general-page">
      <h2 className="settings-page-title">通用设置</h2>

      <section className="settings-section" data-testid="settings-section-appearance">
        <h3 className="settings-section-title">{String.fromCharCode(0x1F3A8)} 外观</h3>
        <p className="settings-section-desc">
          选择 Schola 工作台的全局主题。所有界面区域（菜单栏、侧栏、编辑器、预览、
          图谱、设置面板等）会同步变化。主题保存在本机，不会写入 Vault，也不会发送给远程服务。
        </p>
        <div className="settings-theme-selector-row">
          <AppThemeSelector />
        </div>
      </section>

      <section className="settings-section" data-testid="settings-section-editor">
        <div className="settings-section-heading">
          <div>
            <h3 className="settings-section-title">{String.fromCharCode(0x270F, 0xFE0F)} 编辑器</h3>
            <p className="settings-section-desc">
              编辑器偏好设置。字体、字号与行距只作用于 Markdown 编辑区，实时生效。
            </p>
          </div>
          <span className="settings-section-badge">Local</span>
        </div>
        <div className="settings-editor-controls">
          <label className="settings-control" data-testid="editor-font-family">
            <span className="settings-control-label">字体</span>
            <span className="settings-control-hint">用于 CodeMirror 正文</span>
            <select
              className="settings-select"
              defaultValue={readStored('schola.editorFontFamily', FONT_FAMILIES[0].value)}
              onChange={(e) => {
                document.documentElement.style.setProperty('--editor-font-family', e.target.value);
                try { localStorage.setItem('schola.editorFontFamily', e.target.value); } catch {}
              }}
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.label} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>
          <label className="settings-control" data-testid="editor-font-size">
            <span className="settings-control-label">字号</span>
            <span className="settings-control-hint">调整编辑区文本大小</span>
            <select
              className="settings-select"
              defaultValue={readStored('schola.editorFontSize', '14')}
              onChange={(e) => {
                const size = e.target.value + 'px';
                document.documentElement.style.setProperty('--editor-font-size', size);
                try { localStorage.setItem('schola.editorFontSize', e.target.value); } catch {}
              }}
            >
              <option value="12">12px</option>
              <option value="13">13px</option>
              <option value="14">14px</option>
              <option value="15">15px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
              <option value="20">20px</option>
            </select>
          </label>
          <label className="settings-control" data-testid="editor-line-height">
            <span className="settings-control-label">行距</span>
            <span className="settings-control-hint">控制长文阅读密度</span>
            <select
              className="settings-select"
              defaultValue={readStored('schola.editorLineHeight', '1.7')}
              onChange={(e) => {
                const lh = e.target.value;
                document.documentElement.style.setProperty('--editor-line-height', lh);
                try { localStorage.setItem('schola.editorLineHeight', lh); } catch {}
              }}
            >
              <option value="1.3">1.3</option>
              <option value="1.4">1.4</option>
              <option value="1.5">1.5</option>
              <option value="1.6">1.6</option>
              <option value="1.7">1.7</option>
              <option value="1.8">1.8</option>
              <option value="2.0">2.0</option>
            </select>
          </label>
        </div>
      </section>

      <section className="settings-section" data-testid="settings-section-vault">
        <h3 className="settings-section-title">{String.fromCharCode(0x1F4C2)} Vault</h3>
        <p className="settings-section-desc">当前知识库信息。Vault 设置可通过菜单栏 / 知识库访问。</p>
        <div className="settings-vault-info" id="settings-vault-info">
          <p className="settings-vault-placeholder">打开知识库后将在此显示 Vault 路径与文件统计。</p>
        </div>
      </section>
    </div>
  );
}
