import type { ReactElement } from 'react';

export interface SearchBarProps {
  readonly onOpenSearch: () => void;
}

export function SearchBar({ onOpenSearch }: SearchBarProps): ReactElement {
  return (
    <button
      type="button"
      className="search-bar-trigger"
      data-testid="search-bar-trigger"
      title="搜索 (Ctrl+K)"
      aria-label="搜索文件"
      onClick={onOpenSearch}
    >
      <span className="search-bar-icon" aria-hidden="true">🔍</span>
      <span className="search-bar-placeholder">搜索...</span>
      <span className="search-bar-shortcut">Ctrl+K</span>
    </button>
  );
}
