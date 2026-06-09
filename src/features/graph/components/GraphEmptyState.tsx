import type { ReactElement } from 'react';

export function GraphEmptyState(): ReactElement {
  return (
    <div className="graph-empty" data-testid="graph-empty">
      <p className="graph-empty-title">暂未发现 wikilink 关系</p>
      <p className="graph-empty-hint">在 Markdown 中添加 [[链接]] 后，图谱会显示文件之间的关系。</p>
    </div>
  );
}
