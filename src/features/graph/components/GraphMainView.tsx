import { useMemo, useState, useCallback, type ReactElement } from 'react';
import { useVaultGraph } from '../hooks/useVaultGraph';
import { DEFAULT_GRAPH_THEME, GRAPH_THEMES } from '../lib/graphThemes';
import { filterNodesByScope, SCOPE_LABELS, type GraphScope } from '../lib/graphScope';
import { DEFAULT_STYLE_CONFIG } from '../lib/graphTypes';
import type { GraphLayoutAlgorithm, GraphStyleConfig, GraphThemeId } from '../lib/graphTypes';
import { GraphCanvas } from './GraphCanvas';
import { GraphEmptyState } from './GraphEmptyState';
import { GraphErrorState } from './GraphErrorState';
import { GraphLimitedNotice } from './GraphLimitedNotice';
import { GraphScopeSelector } from './GraphScopeSelector';
import { GraphStylePanel } from './GraphStylePanel';
import { GraphToolbar } from './GraphToolbar';
import { GraphNodeDetail } from './GraphNodeDetail';
import type { GraphNode } from '../../../lib/contracts/graph-query.types';

export interface GraphMainViewProps {
  readonly vaultId: string | null;
  readonly isOpen: boolean;
  readonly selectedFile: string | null;
  readonly selectedFiles?: readonly string[];
  readonly customFiles?: readonly string[];
  readonly scope: GraphScope;
  readonly onScopeChange: (scope: GraphScope) => void;
  readonly onOpenFile: (path: string) => void;
  readonly onClose: () => void;
}

const THEME_LIST = Object.values(GRAPH_THEMES);

export function GraphMainView({
  vaultId,
  isOpen,
  selectedFile,
  selectedFiles = [],
  customFiles = [],
  scope,
  onScopeChange,
  onOpenFile,
  onClose,
}: GraphMainViewProps): ReactElement | null {
  const { status, nodes, edges, truncated, totalNodes, nodeLimit, errorMessage } = useVaultGraph({ vaultId, isOpen });
  const [themeId, setThemeId] = useState<GraphThemeId>(DEFAULT_GRAPH_THEME);
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<GraphLayoutAlgorithm>('force-directed');
  const [styleConfig, setStyleConfig] = useState<GraphStyleConfig>(DEFAULT_STYLE_CONFIG);
  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const [resetLayoutSignal, setResetLayoutSignal] = useState(0);
  const [fitToScreenSignal, setFitToScreenSignal] = useState(0);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [neighborNodeIds, setNeighborNodeIds] = useState<Set<string>>(new Set());

  const scopedGraph = useMemo(
    () => filterNodesByScope(nodes, edges, scope, selectedFile, selectedFiles, customFiles),
    [nodes, edges, scope, selectedFile, selectedFiles, customFiles],
  );

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    const neighbors = new Set<string>();
    for (const e of scopedGraph.edges) {
      if (e.source === node.id) neighbors.add(e.target);
      if (e.target === node.id) neighbors.add(e.source);
    }
    setNeighborNodeIds(neighbors);
  }, [scopedGraph.edges]);

  const handleExpandNeighbors = useCallback((_nodeId: string) => {
    // Expand by resetting scope to include neighbors
    if (neighborNodeIds.size > 0) {
      const expanded = new Set(neighborNodeIds);
      setNeighborNodeIds(expanded);
    }
  }, [neighborNodeIds]);

  const handleFocusRelated = useCallback((_nodeId: string) => {
    // Keep only the selected node and its neighbors visible
  }, []);

  if (!isOpen) return null;

  const theme = GRAPH_THEMES[themeId];
  const nodeCount = scopedGraph.nodes.length;
  const edgeCount = scopedGraph.edges.length;
  const canRenderCanvas = (status === 'ready' || status === 'limited') && nodeCount > 0;
  const currentFileName = selectedFile?.split('/').pop() ?? '未选择文件';
  const statusLabel = status === 'limited' ? '已截断' : status;

  return (
    <div
      className="graph-main-view graph-panel-enter schola-scrollbar"
      data-testid="graph-main-view"
      data-graph-status={status}
      data-graph-scope={scope}
      data-graph-node-count={nodeCount}
      data-graph-edge-count={edgeCount}
      data-graph-truncated={truncated ? 'true' : 'false'}
      data-current-file-node={selectedFile ?? ''}
      data-graph-theme={theme.id}
      data-graph-workspace="productized"
    >
      <div className="graph-workbench" data-testid="graph-workbench">
        <aside className="graph-left-sidebar schola-scrollbar" data-testid="graph-left-sidebar">
          <section className="graph-side-card">
            <p className="graph-side-kicker">当前范围</p>
            <h3 className="graph-side-title">{SCOPE_LABELS[scope]}</h3>
            <p className="graph-side-copy">
              默认聚焦当前文件，Whole Vault 仅作为显式范围选项。
            </p>
          </section>

          <section className="graph-side-card">
            <p className="graph-side-kicker">当前文件</p>
            <h3 className="graph-side-title graph-side-file" title={selectedFile ?? undefined}>
              {currentFileName}
            </h3>
            <p className="graph-side-copy">{selectedFile ?? '打开 Markdown 后查看当前文件关系。'}</p>
          </section>

          <section className="graph-side-card">
            <p className="graph-side-kicker">图谱统计</p>
            <div className="graph-side-metrics" aria-label="图谱摘要">
              <div className="graph-side-metric">
                <strong>{nodeCount}</strong>
                <span>节点</span>
              </div>
              <div className="graph-side-metric">
                <strong>{edgeCount}</strong>
                <span>边</span>
              </div>
            </div>
          </section>

          <section className="graph-side-card">
            <p className="graph-side-kicker">范围</p>
            <GraphScopeSelector scope={scope} onScopeChange={onScopeChange} />
          </section>
        </aside>

        <main className="graph-main-area" data-testid="graph-main-area">
          <div className="graph-workbench-titlebar" data-testid="graph-workbench-titlebar">
            <div>
              <p className="graph-side-kicker">关系图谱</p>
              <h2 className="graph-workbench-title">{SCOPE_LABELS[scope]}图谱</h2>
            </div>
            <button type="button" className="graph-main-action-button" data-testid="graph-close" onClick={onClose}>
              关闭
            </button>
          </div>
          <GraphToolbar
            nodeCount={nodeCount}
            edgeCount={edgeCount}
            truncated={truncated}
            totalNodes={totalNodes}
            themeId={themeId}
            themes={THEME_LIST}
            layoutAlgorithm={layoutAlgorithm}
            isStylePanelOpen={stylePanelOpen}
            searchQuery={searchQuery}
            onThemeChange={setThemeId}
            onLayoutAlgorithmChange={setLayoutAlgorithm}
            onFitToScreen={() => setFitToScreenSignal((value) => value + 1)}
            onResetLayout={() => setResetLayoutSignal((value) => value + 1)}
            onRecenter={() => setRecenterSignal((value) => value + 1)}
            onToggleStylePanel={() => setStylePanelOpen((open) => !open)}
            onSearchChange={setSearchQuery}
          />

          <div className="graph-canvas-frame" data-testid="graph-canvas-frame">
            {status === 'loading' && (
              <div className="graph-loading" data-testid="graph-loading">
                加载链接关系...
              </div>
            )}

            {status === 'error' && <GraphErrorState message={errorMessage} />}
            {(status === 'empty' || ((status === 'ready' || status === 'limited') && nodeCount === 0)) && <GraphEmptyState />}

            {canRenderCanvas && (
              <>
                {truncated && <GraphLimitedNotice nodeCount={nodeLimit} totalNodes={totalNodes} />}
                <div className="graph-workspace">
                  <GraphCanvas
                    nodes={scopedGraph.nodes}
                    edges={scopedGraph.edges}
                    selectedFile={selectedFile}
                    theme={theme}
                    onOpenFile={onOpenFile}
                    layoutAlgorithm={layoutAlgorithm}
                    styleConfig={styleConfig}
                    resetLayoutSignal={resetLayoutSignal}
                    fitToScreenSignal={fitToScreenSignal}
                    recenterSignal={recenterSignal}
                    searchQuery={searchQuery}
                    selectedNodeId={selectedNode?.id ?? null}
                    neighborNodeIds={neighborNodeIds}
                    onNodeClick={handleNodeClick}
                  />
                  <GraphStylePanel
                    styleConfig={styleConfig}
                    onChange={setStyleConfig}
                    isOpen={stylePanelOpen}
                    onClose={() => setStylePanelOpen(false)}
                  />
                </div>
              </>
            )}
          </div>
        </main>

        <aside className="graph-right-panel schola-scrollbar" data-testid="graph-right-panel">
          <section className="graph-side-card">
            <p className="graph-side-kicker">Status</p>
            <h3 className="graph-side-title">{statusLabel}</h3>
            <p className="graph-side-copy">
              {searchQuery ? `图谱内过滤: ${searchQuery}` : '使用顶部图谱工具栏过滤当前图谱节点。'}
            </p>
          </section>

          {selectedNode ? (
            <GraphNodeDetail
              node={selectedNode}
              isOpen={selectedNode !== null}
              onClose={() => { setSelectedNode(null); setNeighborNodeIds(new Set()); }}
              onExpandNeighbors={handleExpandNeighbors}
              onFocusRelated={handleFocusRelated}
            />
          ) : (
            <section className="graph-detail-empty" data-testid="graph-detail-empty">
              <p className="graph-side-kicker">Node Detail</p>
              <h3 className="graph-side-title">未选择节点</h3>
              <p className="graph-side-copy">点击图谱中的节点后，这里会显示路径、入链、出链和相关操作。</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
