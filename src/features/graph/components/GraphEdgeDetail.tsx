import type { ReactElement } from 'react';
import type { GraphEdge } from '../../../lib/contracts/graph-query.types';

export interface GraphEdgeDetailProps {
  readonly edge: GraphEdge | null;
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function GraphEdgeDetail({
  edge,
  sourceLabel,
  targetLabel,
  isOpen,
  onClose,
}: GraphEdgeDetailProps): ReactElement | null {
  if (!isOpen || !edge) return null;

  return (
    <aside
      className="graph-node-detail"
      data-testid="graph-edge-detail"
      aria-label="关系详情"
    >
      <div className="graph-node-detail-header">
        <h3 className="graph-node-detail-title">关系详情</h3>
        <button
          type="button"
          className="graph-node-detail-close"
          onClick={onClose}
          aria-label="关闭关系详情"
          data-testid="graph-edge-detail-close"
        >
          ×
        </button>
      </div>

      <div className="graph-node-detail-body schola-scrollbar">
        <div className="graph-detail-section">
          <span className="graph-detail-label">类型</span>
          <span className="graph-detail-value">
            {edge.kind === 'wikilink' ? 'Wiki 链接' : '未解析'}
          </span>
        </div>

        <div className="graph-detail-section">
          <span className="graph-detail-label">来源</span>
          <span className="graph-detail-value">{sourceLabel}</span>
        </div>

        <div className="graph-detail-section">
          <span className="graph-detail-label">目标</span>
          <span className="graph-detail-value">{targetLabel}</span>
        </div>
      </div>
    </aside>
  );
}
