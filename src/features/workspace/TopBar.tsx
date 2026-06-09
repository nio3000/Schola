import type { ReactElement } from 'react';
import { WindowControls } from './WindowControls';

export interface TopBarProps {
  readonly fileName: string | null;
  readonly onOpenSearch?: () => void;
  readonly searchQuery?: string;
  readonly onSearchQueryChange?: (query: string) => void;
}

/**
 * Top Command Bar — Phase 5-UX-REBASE-VSCODE-SHELL-REPLACE.
 * VS Code-like title bar with central Command Center placeholder.
 * Security: no provider invocation, no context send, no Vault write, no IPC.
 */
export function TopBar({
  fileName,
  onOpenSearch,
  searchQuery = '',
  onSearchQueryChange,
}: TopBarProps): ReactElement {
  const canSearch = Boolean(onOpenSearch);
  return (
    <header className="schola-topbar" data-testid="topbar">
      <div className="topbar-left">
        <span className="topbar-app-name">Schola</span>
      </div>
      <div className="topbar-center">
        <label
          className={`topbar-command-center${canSearch ? ' topbar-command-center-active' : ''}`}
          data-testid="topbar-command-center"
          aria-label="全局搜索"
          onClick={canSearch ? onOpenSearch : undefined}
        >
          <span className="topbar-command-icon">⌘</span>
          <input
            className="topbar-command-input"
            data-testid="topbar-command-input"
            type="search"
            value={searchQuery}
            placeholder="搜索文件、命令或内容…"
            aria-label="输入全局搜索关键词"
            disabled={!canSearch}
            onFocus={canSearch ? onOpenSearch : undefined}
            onChange={(event) => {
              onSearchQueryChange?.(event.currentTarget.value);
              onOpenSearch?.();
            }}
          />
        </label>
      </div>
      <div className="topbar-right">
        {fileName ? (
          <div className="topbar-tab topbar-tab-active" data-testid="topbar-tab">
            <span className="topbar-tab-name">{fileName}</span>
          </div>
        ) : (
          <span className="topbar-tab-name topbar-dimmed">未打开文件</span>
        )}
        <WindowControls />
      </div>
    </header>
  );
}
