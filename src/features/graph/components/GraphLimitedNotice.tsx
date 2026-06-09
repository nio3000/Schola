import type { ReactElement } from 'react';

interface GraphLimitedNoticeProps {
  readonly nodeCount: number;
  readonly totalNodes: number;
}

export function GraphLimitedNotice({ nodeCount, totalNodes }: GraphLimitedNoticeProps): ReactElement {
  return (
    <div className="graph-limited-notice" data-testid="graph-limited-notice">
      仅显示前 {nodeCount} 个文件（共 {totalNodes} 个）。请使用搜索或反向链接查看特定文件。
    </div>
  );
}
