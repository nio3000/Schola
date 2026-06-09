import { useState, type ReactElement } from 'react';
import type { VaultInfo } from '../../lib/contracts/vault.types';
import type { HelpOpenResult } from '../../lib/contracts/app.types';

export interface WelcomePageProps {
  readonly isOpening: boolean;
  readonly recentVaults: readonly VaultInfo[];
  readonly onOpenVault: () => Promise<void>;
  readonly onCreateVault: () => Promise<void>;
  readonly onOpenVaultByPath: (rootPath: string) => Promise<void>;
  readonly onOpenHelp: () => Promise<HelpOpenResult>;
}

export function WelcomePage({
  isOpening,
  onOpenVault,
  onCreateVault,
  onOpenVaultByPath,
  onOpenHelp,
  recentVaults,
}: WelcomePageProps): ReactElement {
  const [helpContent, setHelpContent] = useState<HelpOpenResult | null>(null);

  const handleOpenHelp = async (): Promise<void> => {
    const result = await onOpenHelp();
    setHelpContent(result);
  };

  const handleCloseHelp = (): void => {
    setHelpContent(null);
  };

  // If help is open, show help panel
  if (helpContent) {
    return (
      <div className="welcome-page" data-testid="welcome-page">
        <section className="welcome-help-panel" data-testid="help-placeholder">
          <div className="welcome-help-header">
            <h2 className="welcome-help-title">{helpContent.title}</h2>
            <button
              type="button"
              className="welcome-help-close"
              data-testid="help-close"
              onClick={handleCloseHelp}
              aria-label="关闭帮助"
            >
              ✕
            </button>
          </div>
          <div className="welcome-help-body">
            <p className="welcome-help-message">{helpContent.message}</p>
            <div className="welcome-help-topics">
              <h3>即将涵盖的主题</h3>
              <ul>
                <li>打开知识库 — 选择已有的本地 Markdown 文件夹</li>
                <li>创建知识库 — 新建一个本地 Markdown 知识库</li>
                <li>Markdown 编辑 — 使用 wikilink 双向链接组织知识</li>
                <li>图谱 — 可视化你的知识网络</li>
                <li>导入导出 — 引入 PDF / DOCX，导出为论文格式</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="welcome-page" data-testid="welcome-page">
      <section className="welcome-launcher" aria-label="Schola 知识库启动器">
        <aside className="welcome-recent-panel" aria-labelledby="welcome-recent-title">
          <div className="welcome-panel-kicker">本地工作台</div>
          <h2 id="welcome-recent-title" className="welcome-panel-title">
            最近知识库
          </h2>

          {recentVaults.length > 0 ? (
            <ul className="welcome-recent-list" aria-label="最近知识库列表">
              {recentVaults.map((vault) => (
                <li key={vault.id} className="welcome-recent-item">
                  <button
                    type="button"
                    className="welcome-recent-btn"
                    data-testid={`recent-vault-${vault.name}`}
                    disabled={isOpening}
                    onClick={() => void onOpenVaultByPath(vault.rootPath)}
                  >
                    <span className="welcome-recent-name">{vault.name}</span>
                    <span className="welcome-recent-path">{vault.rootPath}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="welcome-empty-state">暂无最近打开的知识库。</p>
          )}
        </aside>

        <div className="welcome-brand-panel">
          <div className="welcome-brand-copy">
            <h1 className="welcome-title">Schola</h1>
            <p className="welcome-subtitle">
              面向高校科研人员与教育工作者的本地化 Markdown 知识工作平台。
            </p>
          </div>

          <div className="welcome-actions" aria-label="知识库操作">
            <article className="welcome-action-card">
              <div>
                <h2>打开知识库</h2>
                <p>选择一个已经存在的本地 Markdown 知识库。</p>
              </div>
              <button
                type="button"
                className="welcome-action welcome-action-primary"
                data-testid="welcome-open-vault"
                disabled={isOpening}
                onClick={onOpenVault}
              >
                {isOpening ? '正在打开' : '打开'}
              </button>
            </article>

            <article className="welcome-action-card">
              <div>
                <h2>创建知识库</h2>
                <p>新建一个本地文件夹作为 Schola 知识库。</p>
              </div>
              <button
                type="button"
                className="welcome-action"
                data-testid="welcome-create-vault"
                disabled={isOpening}
                onClick={onCreateVault}
              >
                {isOpening ? '正在创建' : '创建'}
              </button>
            </article>

            <article className="welcome-action-card">
              <div>
                <h2>打开帮助</h2>
                <p>查看使用说明和常见问题。</p>
              </div>
              <button
                type="button"
                className="welcome-action welcome-action-secondary"
                data-testid="welcome-open-help"
                onClick={handleOpenHelp}
              >
                帮助
              </button>
            </article>
          </div>

          <p className="welcome-lang-hint">语言：简体中文</p>
        </div>
      </section>
    </div>
  );
}
