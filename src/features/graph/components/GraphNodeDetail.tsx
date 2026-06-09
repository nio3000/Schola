import type { ReactElement } from 'react';
import type { GraphNode } from '../../../lib/contracts/graph-query.types';

export interface GraphNodeDetailProps {
  readonly node: GraphNode | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onExpandNeighbors: (nodeId: string) => void;
  readonly onFocusRelated: (nodeId: string) => void;
}

export function GraphNodeDetail({
  node,
  isOpen,
  onClose,
  onExpandNeighbors,
  onFocusRelated,
}: GraphNodeDetailProps): ReactElement | null {
  if (!isOpen || !node) return null;

  return (
    <aside
      className="graph-node-detail"
      data-testid="graph-node-detail"
      aria-label={`节点详情: ${node.label}`}
    >
      <div className="graph-node-detail-header">
        <h3 className="graph-node-detail-title">{node.label}</h3>
        <button
          type="button"
          className="graph-node-detail-close"
          onClick={onClose}
          aria-label="关闭节点详情"
          data-testid="graph-node-detail-close"
        >
          ×
        </button>
      </div>

      <div className="graph-node-detail-body schola-scrollbar">
        <div className="graph-detail-section">
          <span className="graph-detail-label">类型</span>
          <span className="graph-detail-value">
            {node.kind === 'file' ? '文件' : '未解析'}
          </span>
        </div>

        {node.relativePath && (
          <div className="graph-detail-section">
            <span className="graph-detail-label">路径</span>
            <span className="graph-detail-value graph-detail-path">{node.relativePath}</span>
          </div>
        )}

        <div className="graph-detail-section">
          <span className="graph-detail-label">出链</span>
          <span className="graph-detail-value">{node.linkCount}</span>
        </div>

        <div className="graph-detail-section">
          <span className="graph-detail-label">入链</span>
          <span className="graph-detail-value">{node.backlinkCount}</span>
        </div>

        <div className="graph-detail-actions">
          <button
            type="button"
            className="graph-detail-action-btn"
            data-testid="graph-expand-neighbors"
            onClick={() => onExpandNeighbors(node.id)}
          >
            展开邻居
          </button>
          <button
            type="button"
            className="graph-detail-action-btn"
            data-testid="graph-focus-related"
            onClick={() => onFocusRelated(node.id)}
          >
            只看相关关系
          </button>
        </div>

        {node.kind === 'file' && node.relativePath && (
          <div className="graph-detail-section">
            <span className="graph-detail-hint">点击打开文件</span>
          </div>
        )}
      </div>
    </aside>
  );
}
