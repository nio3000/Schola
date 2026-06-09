import { useCallback, useEffect, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import type { SearchMatch, SearchMatchType } from "../lib/searchIndex";

export interface SearchPanelProps {
  readonly matches: readonly SearchMatch[];
  readonly query: string;
  readonly onOpenFile: (relativePath: string) => void;
  readonly onClose: () => void;
  /** Data source for E2E observability. Not visible in UI. */
  readonly searchSource?: "sqlite" | "memory";
  /** Fallback reason for E2E observability. Not visible in UI. */
  readonly searchFallbackReason?: string;
  /** Whether the memory search index is ready (E2E observability). */
  readonly searchIndexReady?: boolean;
}

const MATCH_LABELS: Record<SearchMatchType, string> = {
  fileName: "File",
  path: "Path",
  heading: "Heading",
  wikilink: "Link",
};

export function SearchPanel({ matches, query, onOpenFile, onClose, searchSource, searchFallbackReason, searchIndexReady }: SearchPanelProps): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when matches change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [matches.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, matches.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const match = matches[selectedIndex];
        if (match) {
          onOpenFile(match.relativePath);
          onClose();
        }
      }
    },
    [matches, selectedIndex, onOpenFile, onClose],
  );

  return (
    <div className="search-overlay search-results-overlay" onMouseDown={onClose} data-testid="search-overlay">
      <div
        className="search-panel search-results-panel schola-scrollbar"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        data-testid="search-panel"
        data-search-source={searchSource}
        data-search-fallback-reason={searchFallbackReason}
        data-search-index-ready={searchIndexReady ? "true" : "false"}
        data-search-role="results-panel"
      >
        <div className="search-results-header">
          <h2 className="search-results-title">搜索结果</h2>
          <button
            type="button"
            className="search-close-btn"
            onClick={onClose}
            aria-label="关闭搜索"
            data-testid="search-close"
          >
            ✕
          </button>
        </div>

        <div className="search-query-summary" data-testid="search-query-summary">
          <span className="search-query-label">关键词</span>
          <strong className="search-query-value">{query.trim() || "在 Command Center 输入关键词"}</strong>
        </div>

        <div className="search-filter-strip" data-testid="search-filter-strip">
          <span className="search-filter-pill">来源: {searchSource ?? "sqlite"}</span>
          <span className="search-filter-pill">结果: {matches.length}</span>
          {searchFallbackReason ? <span className="search-filter-pill">降级: {searchFallbackReason}</span> : null}
        </div>

        {!query.trim() ? (
          <div className="search-empty search-empty-guidance" data-testid="search-empty">
            在 Command Center 输入关键词开始搜索
          </div>
        ) : matches.length > 0 ? (
          <ul className="search-results" role="listbox" data-testid="search-results">
            {matches.map((match, idx) => (
              <li
                key={`${match.relativePath}-${match.matchType}`}
                className={`search-result-item${idx === selectedIndex ? " search-result-selected" : ""}`}
                role="option"
                aria-selected={idx === selectedIndex}
                data-testid={`search-result-${idx}`}
                onMouseDown={() => {
                  onOpenFile(match.relativePath);
                  onClose();
                }}
              >
                <span className="search-result-name">{match.relativePath.split("/").pop()}</span>
                <span className="search-result-path">{match.relativePath}</span>
                <span className="search-result-matched">{match.matchedText}</span>
                <span className={`search-result-type search-result-type-${match.matchType}`}>
                  {MATCH_LABELS[match.matchType]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="search-empty" data-testid="search-empty">
            未找到匹配文件
          </div>
        )}
      </div>
    </div>
  );
}
