import { useMemo, type ReactElement } from 'react';
import { useVaultGraph } from '../hooks/useVaultGraph';
import { filterNodesByScope, SCOPE_LABELS, type GraphScope } from '../lib/graphScope';

export interface GraphSidebarSummaryProps {
  readonly vaultId: string | null;
  readonly isOpen: boolean;
  readonly selectedFile: string | null;
  readonly selectedFiles?: readonly string[];
  readonly customFiles?: readonly string[];
  readonly scope: GraphScope;
  readonly onOpenMainView: () => void;
}

function scopeDescription(scope: GraphScope, selectedFile: string | null): string {
  if (scope === 'current-file') return selectedFile ? `聚焦 ${selectedFile}` : '选择文件后显示一跳关系。';
  if (scope === 'selected-files') return '聚焦已打开或已选文件的一跳关系。';
  if (scope === 'folder-project') return '聚焦当前文件所在文件夹。';
  if (scope === 'custom') return '等待自定义文件集接入。';
  return '显示知识库索引返回的完整图谱。';
}

export function GraphSidebarSummary({
  vaultId,
  isOpen,
  selectedFile,
  selectedFiles = [],
  customFiles = [],
  scope,
  onOpenMainView,
}: GraphSidebarSummaryProps): ReactElement {
  const { status, nodes, edges, truncated, totalNodes } = useVaultGraph({ vaultId, isOpen });
  const scopedGraph = useMemo(
    () => filterNodesByScope(nodes, edges, scope, selectedFile, selectedFiles, customFiles),
    [nodes, edges, scope, selectedFile, selectedFiles, customFiles],
  );

  return (
    <section
      className="graph-sidebar-summary"
      data-testid="graph-sidebar-summary"
      data-graph-status={status}
      data-graph-scope={scope}
      data-graph-node-count={scopedGraph.nodes.length}
      data-graph-edge-count={scopedGraph.edges.length}
    >
      <header className="workspace-sidebar-header graph-sidebar-summary-header">
        <p className="workspace-sidebar-kicker">关系图谱</p>
        <h2 className="workspace-sidebar-title">关系图谱</h2>
        <p className="workspace-sidebar-copy">侧栏只显示轻量摘要，完整画布在编辑区打开。</p>
      </header>

      <div className="graph-sidebar-summary-card">
        <p className="graph-sidebar-summary-label">当前范围</p>
        <strong className="graph-sidebar-summary-scope">{SCOPE_LABELS[scope]}</strong>
        <p className="graph-sidebar-summary-copy">{scopeDescription(scope, selectedFile)}</p>
      </div>

      <div className="graph-sidebar-summary-stats" aria-label="图谱摘要">
        <div className="graph-sidebar-summary-stat">
          <span className="graph-sidebar-summary-value">{scopedGraph.nodes.length}</span>
          <span className="graph-sidebar-summary-label">节点</span>
        </div>
        <div className="graph-sidebar-summary-stat">
          <span className="graph-sidebar-summary-value">{scopedGraph.edges.length}</span>
          <span className="graph-sidebar-summary-label">边</span>
        </div>
      </div>

      {truncated && (
        <p className="graph-sidebar-summary-copy" data-testid="graph-sidebar-truncated">
          索引返回已截断，共 {totalNodes} 个节点；主视图将沿用当前范围过滤。
        </p>
      )}

      <button
        type="button"
        className="graph-sidebar-open-button"
        data-testid="graph-open-main-view"
        onClick={onOpenMainView}
      >
        在编辑区打开完整图谱
      </button>
    </section>
  );
}
