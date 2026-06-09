import type { ReactElement, ReactNode } from 'react';

export interface AIResearchDrawerProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
}

export function AIResearchDrawer({ title, children, onClose }: AIResearchDrawerProps): ReactElement {
  return (
    <div className="workspace-ai-research-drawer-overlay" data-testid="ai-research-drawer" role="dialog" aria-modal="true" aria-labelledby="ai-research-drawer-title">
      <aside className="workspace-ai-research-drawer">
        <header className="workspace-ai-research-drawer-header">
          <h2 id="ai-research-drawer-title">{title}</h2>
          <button type="button" className="workspace-ai-research-icon-button" onClick={onClose} aria-label="关闭抽屉">×</button>
        </header>
        <div className="workspace-ai-research-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
