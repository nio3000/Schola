import type { ReactElement } from 'react';
import type { PreviewMode } from '../graph/lib/graphTypes';

interface PreviewModeTabsProps {
  readonly previewMode: PreviewMode;
  readonly onChange: (mode: PreviewMode) => void;
}

export function PreviewModeTabs({ previewMode, onChange }: PreviewModeTabsProps): ReactElement {
  return (
    <div className="preview-mode-tabs" role="tablist" aria-label="预览模式">
      <button
        type="button"
        role="tab"
        className={`preview-mode-tab${previewMode === 'markdown' ? ' preview-mode-tab-active' : ''}`}
        data-testid="preview-mode-markdown"
        data-preview-mode="markdown"
        aria-selected={previewMode === 'markdown'}
        onClick={() => onChange('markdown')}
      >
        预览
      </button>
      <button
        type="button"
        role="tab"
        className={`preview-mode-tab${previewMode === 'graph' ? ' preview-mode-tab-active' : ''}`}
        data-testid="preview-mode-graph"
        data-preview-mode="graph"
        aria-selected={previewMode === 'graph'}
        onClick={() => onChange('graph')}
      >
        图谱
      </button>
    </div>
  );
}
