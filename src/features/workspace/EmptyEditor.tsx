import type { ReactElement } from 'react';

export function EmptyEditor(): ReactElement {
  return (
    <div className="empty-editor" data-testid="empty-editor">
      <div className="empty-editor-content">
        <p className="empty-editor-text">未打开文件</p>
        <p className="empty-editor-hint">从左侧文件树选择一个 Markdown 文件开始编辑。</p>
      </div>
    </div>
  );
}
