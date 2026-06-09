import type { ReactElement } from 'react';

interface GraphErrorStateProps {
  readonly message: string | null;
}

export function GraphErrorState({ message }: GraphErrorStateProps): ReactElement {
  return (
    <div className="graph-error" data-testid="graph-error">
      <p className="graph-error-title">索引不可用</p>
      <p className="graph-error-message" data-testid="graph-error-message">
        {message ?? '无法加载链接关系图。'}
      </p>
      <p className="graph-error-hint">请在状态栏点击 [🔄 重建索引] 按钮修复。</p>
    </div>
  );
}
