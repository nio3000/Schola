import type { ReactElement } from 'react';

export interface SearchTriggerProps {
  readonly onOpenSearch: () => void;
}

export function SearchTrigger({ onOpenSearch }: SearchTriggerProps): ReactElement {
  return (
    <button
      type="button"
      className="search-trigger-btn"
      data-testid="search-trigger"
      title="搜索 (Ctrl+K)"
      aria-label="搜索文件"
      onClick={onOpenSearch}
    >
      <span className="search-trigger-icon" aria-hidden="true">🔍</span>
      <span className="search-trigger-label">搜索</span>
    </button>
  );
}
