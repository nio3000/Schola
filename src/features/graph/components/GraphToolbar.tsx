import { type ReactElement } from 'react';
import type { GraphLayoutAlgorithm, GraphThemeId, GraphTheme } from '../lib/graphTypes';
import { LAYOUT_LABELS } from '../lib/graphTypes';

interface GraphToolbarProps {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly truncated: boolean;
  readonly totalNodes: number;
  readonly themeId: GraphThemeId;
  readonly themes: readonly GraphTheme[];
  readonly layoutAlgorithm: GraphLayoutAlgorithm;
  readonly isStylePanelOpen: boolean;
  readonly searchQuery: string;
  readonly onThemeChange: (id: GraphThemeId) => void;
  readonly onLayoutAlgorithmChange: (algorithm: GraphLayoutAlgorithm) => void;
  readonly onFitToScreen: () => void;
  readonly onResetLayout: () => void;
  readonly onRecenter: () => void;
  readonly onToggleStylePanel: () => void;
  readonly onSearchChange: (query: string) => void;
}

const LAYOUT_OPTIONS: readonly GraphLayoutAlgorithm[] = ['force-directed', 'hierarchical', 'circular'];

export function GraphToolbar({
  nodeCount,
  edgeCount,
  truncated,
  totalNodes,
  themeId,
  themes,
  layoutAlgorithm,
  isStylePanelOpen,
  searchQuery,
  onThemeChange,
  onLayoutAlgorithmChange,
  onFitToScreen,
  onResetLayout,
  onRecenter,
  onToggleStylePanel,
  onSearchChange,
}: GraphToolbarProps): ReactElement {
  const selectedTheme = themes.find((theme) => theme.id === themeId) ?? themes[0];
  const currentThemeIndex = Math.max(0, themes.findIndex((theme) => theme.id === themeId));
  const nextTheme = (): void => {
    if (themes.length === 0) return;
    onThemeChange(themes[(currentThemeIndex + 1) % themes.length].id);
  };

  return (
    <div className="graph-toolbar" data-testid="graph-toolbar">
      <span className="graph-toolbar-stats">
        {nodeCount} 节点 · {edgeCount} 边
        {truncated && ` (共 ${totalNodes}，已截断)`}
      </span>
      <div className="graph-toolbar-controls">
        <label className="graph-search-field">
          <span>搜索</span>
          <input
            type="text"
            className="graph-search-input"
            data-testid="graph-search-input"
            aria-label="搜索实体"
            placeholder="实体..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>
        <div className="graph-layout-segment" data-testid="graph-layout-segment" aria-label="图谱布局">
          {LAYOUT_OPTIONS.map((algorithm) => (
            <button
              key={algorithm}
              type="button"
              className={
                algorithm === layoutAlgorithm
                  ? 'graph-layout-segment-button graph-layout-segment-button-active'
                  : 'graph-layout-segment-button'
              }
              aria-pressed={algorithm === layoutAlgorithm}
              onClick={() => onLayoutAlgorithmChange(algorithm)}
            >
              {LAYOUT_LABELS[algorithm]}
            </button>
          ))}
        </div>
        <button type="button" className="graph-toolbar-button" onClick={onFitToScreen}>
          适配
        </button>
        <button type="button" className="graph-toolbar-button" onClick={onResetLayout}>
          重排
        </button>
        <button type="button" className="graph-toolbar-button" onClick={onRecenter}>
          居中
        </button>
        <button
          type="button"
          className={isStylePanelOpen ? 'graph-toolbar-button graph-toolbar-button-active' : 'graph-toolbar-button'}
          aria-pressed={isStylePanelOpen}
          onClick={onToggleStylePanel}
        >
          样式
        </button>
        <button
          type="button"
          className="graph-toolbar-button graph-theme-button"
          data-testid="graph-theme-select"
          aria-label="图谱主题"
          onClick={nextTheme}
        >
          {selectedTheme?.name ?? '主题'}
        </button>
      </div>
    </div>
  );
}
